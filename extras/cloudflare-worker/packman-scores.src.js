// ---------------------------------------------------------------------------
// The leaderboard itself. Everything above this line is the game's own
// geom.js and levels.js, pasted in by packman/tools/build-worker.py so a
// score can be checked here with the very code that judges it in the game.
// ---------------------------------------------------------------------------

const G = PackmanGeom, LEVELS = PackmanLevels;
const BY_NAME = new Map(LEVELS.map((l) => [l.name, l]));
const NAMES = LEVELS.map((l) => l.name);
const TOP = 10;            // rows returned for a board, unless more are asked for
const MOST = 100;          // and the most that can be
const PER_HOUR = 60;       // scores one address may send in an hour
const BLOCKED = /fuck|shit|cunt|nigg|fag|bitch|whore|rape|nazi|hitler|porn|penis|vagina/i;

const CORS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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
	// (a level with two boxes lists them as containers; its shapes are judged each by the box it is in)
	const C = level.containers ? G.makeBoxes(level.containers) : G.makeContainer(level.container);
	// and a level with rules of its own (a pivot to balance on, guests with wishes) has them kept too
	return G.evaluate(pieces, C).solved && G.verdict(level, pieces, C).ok;
}

// Is this the end of a duel won against Packman (Rival)? Nothing turns there, and everything in the box is on its
// squares: the shapes in it have to be where the game could have put them, side by side, each side's the first of its
// queue, in turn, with Packman to play next and nowhere for its next shape (or none left to play).
function duelWon(level, spots) {
	if (!Array.isArray(spots) || spots.length !== level.pieces.length) return false;
	const R = level.rival, B = level.container, xs = B.map((q) => q[0]), ys = B.map((q) => q[1]);
	const x0 = Math.min(...xs), y0 = Math.min(...ys), W = Math.round(Math.max(...xs) - x0), H = Math.round(Math.max(...ys) - y0);
	const stands = (i) => R.stand ? R.stand.includes(i) : level.pieces[i] === "domino" && R.sam.includes(i);
	const size = (i) => level.pieces[i] === "domino" ? (stands(i) ? [1, 2] : [2, 1]) : [1, 1];
	const cells = (c, r, w, h) => { let m = 0n; for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) m |= 1n << BigInt((r + j) * W + c + i); return m; };
	let occ = 0n;
	for (const q of R.rocks || []) occ |= cells(q[0], q[1], 1, 1);
	const placed = [];
	for (let i = 0; i < spots.length; i++) {
		const s = spots[i];
		if (!Array.isArray(s) || s.length !== 3 || !s.every((v) => typeof v === "number" && isFinite(v) && Math.abs(v) < 1e4)) return false;
		const [w, h] = size(i), c = s[0] - w / 2 - x0, r = s[1] - h / 2 - y0;
		if (s[0] < x0 || s[0] > x0 + W || s[1] < y0 || s[1] > y0 + H) { placed[i] = false; continue; }   // still in its tray
		if (Math.abs(c - Math.round(c)) > 0.01 || Math.abs(r - Math.round(r)) > 0.01 || ((s[2] % 360) + 360) % 360 !== (stands(i) ? 90 : 0)) return false;
		const C = Math.round(c), Rr = Math.round(r);
		if (C < 0 || Rr < 0 || C + w > W || Rr + h > H) return false;
		const m = cells(C, Rr, w, h);
		if (m & occ) return false;
		occ |= m; placed[i] = true;
	}
	const mine = level.pieces.map((_, i) => i).filter((i) => !R.sam.includes(i));
	const run = (q) => { let k = 0; while (k < q.length && placed[q[k]]) k++; return q.slice(k).some((i) => placed[i]) ? -1 : k; };   // how many of a queue are in, from its start
	const a = run(mine), b = run(R.sam);
	if (a < 1 || b < 0 || a - b !== (R.first ? 0 : 1)) return false;   // Packman to play next
	if (b === R.sam.length) return true;   // and it has nothing left
	const [w, h] = size(R.sam[b]);
	for (let r = 0; r + h <= H; r++) for (let c = 0; c + w <= W; c++) if (!(cells(c, r, w, h) & occ)) return false;   // its next shape would still fit
	return true;
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

// One board. A player's line is everything they have packed: how many levels,
// and the moves and time those took at their best. More levels ranks higher;
// then fewer moves; then less time.
const row = (r) => ({ name: r.name, n: r.n, m: r.m, t: Math.round(r.t * 10) / 10, a: hash(r.pid) });
const TOTALS = `SELECT pid, MAX(name) AS name, COUNT(*) AS n, SUM(m) AS m, SUM(t) AS t FROM scores
	WHERE level IN (${NAMES.map(() => "?").join(",")}) GROUP BY pid`;

async function board(db, pid, rows = TOP) {
	const top = await db.prepare(`${TOTALS} ORDER BY n DESC, m, t LIMIT ${rows}`).bind(...NAMES).all();
	const all = await db.prepare(`SELECT COUNT(*) AS c FROM (${TOTALS})`).bind(...NAMES).first();
	const out = { top: top.results.map(row), of: all ? all.c : 0, levels: NAMES.length };
	if (!pid) return out;
	// where the one asking stands, for when they are further down than the top few
	const mine = await db.prepare(`SELECT * FROM (${TOTALS}) WHERE pid = ?`).bind(...NAMES, pid).first();
	if (mine) {
		const ahead = await db.prepare(
			`SELECT COUNT(*) AS c FROM (${TOTALS}) WHERE n > ? OR (n = ? AND (m < ? OR (m = ? AND t < ?)))`
		).bind(...NAMES, mine.n, mine.n, mine.m, mine.m, mine.t).first();
		out.mine = row(mine); out.rank = ahead.c + 1;
		// and their place on each level they have packed, where it is among the first three: fewer moves, then less time
		const at = await db.prepare(
			"SELECT s.level AS level, 1 + (SELECT COUNT(*) FROM scores o WHERE o.level = s.level AND (o.m < s.m OR (o.m = s.m AND o.t < s.t))) AS r FROM scores s WHERE s.pid = ?"
		).bind(pid).all();
		out.places = {};
		for (const x of at.results) if (x.r <= 3 && BY_NAME.has(x.level)) out.places[x.level] = x.r;
	}
	return out;
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
	// (on Kaleidoscope only the dealt shapes are moved: the copies go with them; in a duel, as few as one of yours)
	const n = level.rival ? 1 : level.echo || level.pieces.length;
	if (!isFinite(t) || !isFinite(m) || m < n || m > 100000 || t < n * 0.5 || t > 86400) return json({ error: "score" }, 400);
	// A level with powers is taken on trust: a ghost shares a space, and a chameleon is not
	// always the shape the level lists, so the plain rules cannot judge where its shapes ended up.
	if (level.rival ? !duelWon(level, b.p) : !level.powers && !packed(level, b.p)) return json({ error: "unpacked" }, 400);
	// a level that is let out on a day of its own takes no scores before then (a day early anywhere on Earth, at the most)
	if (level.opens && Date.now() < Date.parse(level.opens + "T00:00:00Z") - 14 * 3600000) return json({ error: "not yet" }, 400);
	if (await tooMany(db, request)) return json({ error: "slow down" }, 429);

	const now = Math.floor(Date.now() / 1000);
	await db.batch([
		// a player has one row a level, and it only ever gets better: fewer moves, or the same in less time
		db.prepare(
			"INSERT INTO scores (level, pid, name, t, m, at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (level, pid) DO UPDATE SET t = excluded.t, m = excluded.m, at = excluded.at WHERE excluded.m < scores.m OR (excluded.m = scores.m AND excluded.t < scores.t)"
		).bind(level.name, pid, name, t, m, now),
		db.prepare("UPDATE scores SET name = ? WHERE pid = ?").bind(name, pid),
	]);
	return json(await board(db, pid));
}

export default {
	async fetch(request, env) {
		if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
		const db = env.DB || env.db;   // the binding's name, in either case
		if (!db) return json({ error: "no database bound as DB" }, 500);
		try {
			await tables(db);
			if (request.method === "POST") return await submit(db, request);
			const query = new URL(request.url).searchParams, pid = query.get("pid") || "";
			if (pid && !/^[A-Za-z0-9-]{16,48}$/.test(pid)) return json({ error: "pid" }, 400);
			if (request.method === "DELETE") {
				// A player takes their own line off the board. The id is the only key to it, and only their browser has it.
				if (!pid) return json({ error: "pid" }, 400);
				const gone = await db.prepare("DELETE FROM scores WHERE pid = ?").bind(pid).run();
				return json({ gone: gone.meta ? gone.meta.changes : 0 });
			}
			if (request.method !== "GET") return json({ error: "method" }, 405);
			const rows = Math.min(MOST, Math.max(1, Math.floor(Number(query.get("top")) || TOP)));
			return json(await board(db, pid, rows), 200, { "Cache-Control": pid ? "no-store" : "public, max-age=20" });
		} catch (err) {
			return json({ error: "exception", detail: String(err) }, 500);
		}
	},
};
