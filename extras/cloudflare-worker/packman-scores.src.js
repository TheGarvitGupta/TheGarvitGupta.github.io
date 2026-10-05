// ---------------------------------------------------------------------------
// The leaderboard itself. Everything above this line is the game's own
// geom.js and levels.js, pasted in by tools/build-packman-worker.py so a
// score can be checked here with the very code that judges it in the game.
// ---------------------------------------------------------------------------

const G = PackmanGeom, LEVELS = PackmanLevels;
const BY_NAME = new Map(LEVELS.map((l) => [l.name, l]));
const MAIN = LEVELS.filter((l) => !l.bonus).map((l) => l.name);
const TOP = 10;            // rows returned for a board
const PER_HOUR = 60;       // scores one address may send in an hour
const BLOCKED = /fuck|shit|cunt|nigg|fag|bitch|whore|rape|nazi|hitler|porn|penis|vagina/i;

const CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
	"Content-Type": "application/json",
};
const json = (body, status = 200, extra = {}) =>
	new Response(JSON.stringify(body), { status, headers: { ...CORS, ...extra } });

// The same hash the game uses to pick a player's block and animal name from
// their id, so nobody chooses their own picture.
function hash(s) {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
	return h >>> 0;
}

function cleanName(s) {
	return String(s || "").replace(/[\u0000-\u001f\u007f<>&"'`\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 18);
}

// Is this really a packing of that level? The level's own pieces, put where
// the player left them, judged by the game's rules.
function packed(level, spots) {
	if (!Array.isArray(spots) || spots.length !== level.pieces.length) return false;
	const pieces = [];
	for (let i = 0; i < spots.length; i++) {
		const s = spots[i];
		if (!Array.isArray(s) || s.length !== 3 || !s.every((v) => typeof v === "number" && isFinite(v) && Math.abs(v) < 1e4)) return false;
		pieces.push({ type: level.pieces[i], size: 1, x: s[0], y: s[1], angle: s[2] });
	}
	return G.evaluate(pieces, G.makeContainer(level.container)).solved;
}

let ready = false;
async function tables(db) {
	if (ready) return;
	await db.batch([
		db.prepare("CREATE TABLE IF NOT EXISTS scores (level TEXT NOT NULL, pid TEXT NOT NULL, name TEXT NOT NULL, t REAL NOT NULL, m INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (level, pid))"),
		db.prepare("CREATE INDEX IF NOT EXISTS scores_rank ON scores (level, t, m, at)"),
		db.prepare("CREATE TABLE IF NOT EXISTS rate (k TEXT PRIMARY KEY, n INTEGER NOT NULL, exp INTEGER NOT NULL)"),
	]);
	ready = true;
}

const row = (r) => ({ name: r.name, t: r.t, m: r.m, a: hash(r.pid) });

async function board(db, level) {
	if (level === "all") {
		// only players who have packed every one of the seventeen, by their combined best times
		const marks = MAIN.map(() => "?").join(",");
		const top = await db.prepare(
			`SELECT pid, MAX(name) AS name, SUM(t) AS t, SUM(m) AS m FROM scores WHERE level IN (${marks})
			 GROUP BY pid HAVING COUNT(*) = ${MAIN.length} ORDER BY t, m LIMIT ${TOP}`
		).bind(...MAIN).all();
		const n = await db.prepare(
			`SELECT COUNT(*) AS n FROM (SELECT pid FROM scores WHERE level IN (${marks}) GROUP BY pid HAVING COUNT(*) = ${MAIN.length})`
		).bind(...MAIN).first();
		return { level, top: top.results.map(row), of: n ? n.n : 0 };
	}
	const top = await db.prepare(`SELECT pid, name, t, m FROM scores WHERE level = ? ORDER BY t, m, at LIMIT ${TOP}`).bind(level).all();
	const n = await db.prepare("SELECT COUNT(*) AS n FROM scores WHERE level = ?").bind(level).first();
	return { level, top: top.results.map(row), of: n ? n.n : 0 };
}

async function tooMany(db, request) {
	const ip = request.headers.get("CF-Connecting-IP") || "?";
	const hour = Math.floor(Date.now() / 3600000);
	// the address is never stored, only a hash of it with the hour
	const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip + "|" + hour));
	const k = Array.from(new Uint8Array(bytes).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
	const r = await db.prepare(
		"INSERT INTO rate (k, n, exp) VALUES (?, 1, ?) ON CONFLICT (k) DO UPDATE SET n = n + 1 RETURNING n"
	).bind(k, (hour + 2) * 3600).first();
	if (r && r.n === 1 && Math.random() < 0.05) await db.prepare("DELETE FROM rate WHERE exp < ?").bind(Math.floor(Date.now() / 1000)).run();
	return r && r.n > PER_HOUR;
}

async function submit(db, request) {
	let b;
	try { b = await request.json(); } catch (e) { return json({ error: "body" }, 400); }
	const level = BY_NAME.get(b && b.level);
	if (!level) return json({ error: "level" }, 400);
	const pid = String(b.pid || "");
	if (!/^[A-Za-z0-9-]{16,48}$/.test(pid)) return json({ error: "pid" }, 400);
	const name = cleanName(b.name);
	if (!name || BLOCKED.test(name.replace(/[^a-z]/gi, ""))) return json({ error: "name" }, 400);
	const t = Math.round(Number(b.t) * 10) / 10, m = Math.round(Number(b.m));
	// every piece has to be moved at least once, and nobody does that in under half a second each
	const n = level.pieces.length;
	if (!isFinite(t) || !isFinite(m) || m < n || m > 100000 || t < n * 0.5 || t > 86400) return json({ error: "score" }, 400);
	if (!packed(level, b.p)) return json({ error: "unpacked" }, 400);
	if (await tooMany(db, request)) return json({ error: "slow down" }, 429);

	const now = Math.floor(Date.now() / 1000);
	await db.batch([
		// a player has one row a level, and it only ever gets faster
		db.prepare(
			"INSERT INTO scores (level, pid, name, t, m, at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (level, pid) DO UPDATE SET t = excluded.t, m = excluded.m, at = excluded.at WHERE excluded.t < scores.t"
		).bind(level.name, pid, name, t, m, now),
		db.prepare("UPDATE scores SET name = ? WHERE pid = ?").bind(name, pid),
	]);
	const mine = await db.prepare("SELECT t, m FROM scores WHERE level = ? AND pid = ?").bind(level.name, pid).first();
	const ahead = await db.prepare(
		"SELECT COUNT(*) AS n FROM scores WHERE level = ? AND (t < ? OR (t = ? AND m < ?))"
	).bind(level.name, mine.t, mine.t, mine.m).first();
	return json({ ...(await board(db, level.name)), best: mine, rank: ahead.n + 1 });
}

export default {
	async fetch(request, env) {
		if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
		const db = env.DB || env.db;   // the binding's name, in either case
		if (!db) return json({ error: "no database bound as DB" }, 500);
		try {
			await tables(db);
			if (request.method === "POST") return await submit(db, request);
			if (request.method !== "GET") return json({ error: "method" }, 405);
			const level = new URL(request.url).searchParams.get("level") || "all";
			if (level !== "all" && !BY_NAME.has(level)) return json({ error: "level" }, 400);
			return json(await board(db, level), 200, { "Cache-Control": "public, max-age=20" });
		} catch (err) {
			return json({ error: "exception", detail: String(err) }, 500);
		}
	},
};
