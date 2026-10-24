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
		// a player who has given their email: their whole saved game, kept so it can be opened on another device
		// (key: for the link that turns their notifications off; quiet: they did)
		db.prepare("CREATE TABLE IF NOT EXISTS players (pid TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, save TEXT, made INTEGER NOT NULL, seen INTEGER NOT NULL, country TEXT, device TEXT, key TEXT, quiet INTEGER NOT NULL DEFAULT 0)"),
		// the links in emails that open a player's game: the welcome's keeps working, the one asked for works once, for an hour
		db.prepare("CREATE TABLE IF NOT EXISTS links (token TEXT PRIMARY KEY, pid TEXT NOT NULL, exp INTEGER NOT NULL, once INTEGER NOT NULL)"),
		// and every email sent, or tried
		// (about: what it was about, as the level a "new level" email was for)
		db.prepare("CREATE TABLE IF NOT EXISTS mails (id INTEGER PRIMARY KEY AUTOINCREMENT, pid TEXT, email TEXT NOT NULL, kind TEXT NOT NULL, subject TEXT, at INTEGER NOT NULL, ok INTEGER NOT NULL, rid TEXT, error TEXT, about TEXT)"),
	]);
	// the columns added since the tables were first made (there already, the database says so, and that is all)
	for (const q of ["ALTER TABLE players ADD COLUMN key TEXT", "ALTER TABLE players ADD COLUMN quiet INTEGER NOT NULL DEFAULT 0", "ALTER TABLE mails ADD COLUMN about TEXT"]) {
		try { await db.prepare(q).run(); } catch (e) {}
	}
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

async function tooMany(db, request, what = "", most = PER_HOUR) {
	const ip = request.headers.get("CF-Connecting-IP") || "?";
	const hour = Math.floor(Date.now() / 3600000);
	// the address is never stored, only a hash of it with the hour
	const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(what + ip + "|" + hour));
	const k = Array.from(new Uint8Array(bytes).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
	const r = await db.prepare(
		"INSERT INTO rate (k, n, exp) VALUES (?, 1, ?) ON CONFLICT (k) DO UPDATE SET n = n + 1 RETURNING n"
	).bind(k, (hour + 2) * 3600).first();
	if (r && r.n === 1 && Math.random() < 0.05) await db.prepare("DELETE FROM rate WHERE exp < ?").bind(Math.floor(Date.now() / 1000)).run();
	return r && r.n > most;
}

async function submit(db, request, env, ctx) {
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
	const standing = () => db.prepare(`SELECT n, m, t FROM (${TOTALS}) WHERE pid = ?`).bind(...NAMES, pid).first();
	const before = await standing();
	await db.batch([
		// a player has one row a level, and it only ever gets better: fewer moves, or the same in less time
		db.prepare(
			"INSERT INTO scores (level, pid, name, t, m, at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (level, pid) DO UPDATE SET t = excluded.t, m = excluded.m, at = excluded.at WHERE excluded.m < scores.m OR (excluded.m = scores.m AND excluded.t < scores.t)"
		).bind(level.name, pid, name, t, m, now),
		db.prepare("UPDATE scores SET name = ? WHERE pid = ?").bind(name, pid),
	]);
	const after = await standing();
	if (after && (!before || ahead(after, before))) later(ctx, passed(db, env, pid, name, before, after));
	return json(await board(db, pid));
}

// Accounts. There is no password and nothing to verify: a player gives an email, and their saved game is kept under
// it. To open the game on another device they ask for a link, which is emailed to them (through Resend).
const SITE = "https://www.garvitgupta.com/packman/";
const EMAIL = /^[^\s@<>()",;:]{1,64}@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;
const SAVE_MOST = 64 * 1024;   // the size of a saved game, at the most
const HOUR = 3600, YEARS = 50 * 365 * 86400;
const cleanEmail = (s) => String(s || "").trim().toLowerCase().slice(0, 254);
const goodPid = (pid) => /^[A-Za-z0-9-]{16,48}$/.test(pid);
const nowSec = () => Math.floor(Date.now() / 1000);

function token() {
	return Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
}
// a phone or a computer, and which browser: enough to tell players apart in the admin panel, and no more
function device(ua) {
	ua = String(ua || "");
	const kind = /iPad|Tablet/i.test(ua) ? "tablet" : /Mobi|iPhone|Android/i.test(ua) ? "phone" : "computer";
	const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "other";
	return kind + " · " + browser;
}

async function mail(db, env, to, pid, kind, data, about = null) {
	const m = PackmanMail.make(kind, data);
	let ok = 0, rid = null, error = null;
	try {
		if (!env.RESEND_API_KEY) throw new Error("no RESEND_API_KEY");
		const r = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
			body: JSON.stringify({ from: env.MAIL_FROM || "Packman <packman@garvitgupta.com>", to: [to], subject: m.subject, html: m.html, text: m.text,
				headers: data.quiet ? { "List-Unsubscribe": "<" + data.quiet + ">", "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined }),
		});
		const d = await r.json().catch(() => ({}));
		if (r.ok && d.id) { ok = 1; rid = d.id; } else error = (d.message || d.name || "status " + r.status).slice(0, 300);
	} catch (e) { error = String(e.message || e).slice(0, 300); }
	await db.prepare("INSERT INTO mails (pid, email, kind, subject, at, ok, rid, error, about) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
		.bind(pid, to, kind, m.subject, nowSec(), ok, rid, error, about).run();
	return ok;
}
async function link(db, pid, once) {
	const t = token();
	await db.prepare("INSERT INTO links (token, pid, exp, once) VALUES (?, ?, ?, ?)").bind(t, pid, nowSec() + (once ? HOUR : YEARS), once ? 1 : 0).run();
	return SITE + "?signin=" + t;
}

// POST /api/packman/player {pid, name, email, save}: who the player is, and their saved game as it is now. A new
// email gets the welcome; one that another player already has is turned away, so they can ask for a link to it.
async function player(db, env, request, ctx) {
	let b;
	try { b = await request.json(); } catch (e) { return json({ error: "body" }, 400); }
	const pid = String(b.pid || ""), name = cleanName(b.name), email = cleanEmail(b.email);
	if (!goodPid(pid)) return json({ error: "pid" }, 400);
	if (!EMAIL.test(email)) return json({ error: "email" }, 400);
	if (!name) return json({ error: "name" }, 400);
	let save = null;
	if (b.save != null) { save = JSON.stringify(b.save); if (save.length > SAVE_MOST) return json({ error: "too big" }, 413); }
	const other = await db.prepare("SELECT pid FROM players WHERE email = ?").bind(email).first();
	if (other && other.pid !== pid) return json({ error: "taken" }, 409);
	const was = await db.prepare("SELECT email FROM players WHERE pid = ?").bind(pid).first();
	const fresh = !was || was.email !== email;
	if (fresh && await tooMany(db, request, "player|", 10)) return json({ error: "slow down" }, 429);
	const now = nowSec(), where = (request.cf && request.cf.country) || null, on = device(request.headers.get("User-Agent"));
	await db.prepare(
		`INSERT INTO players (pid, name, email, save, made, seen, country, device) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (pid) DO UPDATE SET name = excluded.name, email = excluded.email, save = COALESCE(excluded.save, players.save), seen = excluded.seen, country = excluded.country, device = excluded.device`
	).bind(pid, name, email, save, now, now, where, on).run();
	if (fresh) {
		const send = async () => mail(db, env, email, pid, "welcome", { name, link: await link(db, pid, false) });
		if (ctx && ctx.waitUntil) ctx.waitUntil(send()); else await send();
	}
	return json({ ok: true, fresh });
}

// POST /api/packman/recover {email}: a link to that email's game, if there is one. The answer is the same either way.
async function recover(db, env, request) {
	let b;
	try { b = await request.json(); } catch (e) { return json({ error: "body" }, 400); }
	const email = cleanEmail(b.email);
	if (!EMAIL.test(email)) return json({ error: "email" }, 400);
	if (await tooMany(db, request, "recover|", 10)) return json({ error: "slow down" }, 429);
	const p = await db.prepare("SELECT pid, name FROM players WHERE email = ?").bind(email).first();
	if (p) {
		const recent = await db.prepare("SELECT COUNT(*) AS c FROM mails WHERE email = ? AND kind = 'signin' AND at > ?").bind(email, nowSec() - HOUR).first();
		if (!recent || recent.c < 5) await mail(db, env, email, p.pid, "signin", { name: p.name, link: await link(db, p.pid, true) });
	}
	return json({ ok: true });
}

// One line of the board ahead of another: more levels, then fewer moves, then less time.
const ahead = (a, b) => a.n > b.n || (a.n === b.n && (a.m < b.m || (a.m === b.m && a.t < b.t)));
const AHEAD_OF = "(T.n > ? OR (T.n = ? AND (T.m < ? OR (T.m = ? AND T.t < ?))))";   // T ahead of the one given
const BEHIND = "(T.n < ? OR (T.n = ? AND (T.m > ? OR (T.m = ? AND T.t > ?))))";     // and behind it
const line = (r) => [r.n, r.n, r.m, r.m, r.t];
function later(ctx, job) { if (ctx && ctx.waitUntil) ctx.waitUntil(job.catch(() => {})); else return job; }

// "You've been passed": to whoever was ahead of this player on the board before their win, and is behind them now.
// Only the three just behind them now, and nobody more than once in twelve hours.
const PASSED_EVERY = 12 * HOUR;
async function passed(db, env, pid, by, before, after) {
	const was = before ? `AND ${AHEAD_OF}` : "";
	const them = await db.prepare(
		`SELECT T.pid AS pid, T.n AS n, T.m AS m, T.t AS t, p.name AS name, p.email AS email FROM (${TOTALS}) T JOIN players p ON p.pid = T.pid
		 WHERE T.pid != ? AND p.quiet = 0 AND ${BEHIND} ${was} ORDER BY T.n DESC, T.m, T.t LIMIT 3`
	).bind(...NAMES, pid, ...line(after), ...(before ? line(before) : [])).all();
	if (!them.results.length) return;
	const of = await db.prepare(`SELECT COUNT(*) AS c FROM (${TOTALS})`).bind(...NAMES).first();
	for (const y of them.results) {
		const recent = await db.prepare("SELECT COUNT(*) AS c FROM mails WHERE pid = ? AND kind = 'passed' AND at > ?").bind(y.pid, nowSec() - PASSED_EVERY).first();
		if (recent && recent.c) continue;
		const ahead_ = await db.prepare(`SELECT COUNT(*) AS c FROM (${TOTALS}) T WHERE ${AHEAD_OF}`).bind(...NAMES, ...line(y)).first();
		await mail(db, env, y.email, y.pid, "passed", { name: y.name, by, rank: ahead_.c + 1, of: of.c, link: SITE, quiet: await quietLink(db, y.pid) }, by);
	}
}

// "A new level is open": the morning a level with a day of its own comes out (ten o'clock, UTC: midnight in Hawaii, so it is
// out everywhere), to every player who can play it, which is to say has packed the level before it. Asked every hour, by
// the worker's schedule; a send that failed is tried again, up to three times. It stops asking three days after.
const LEVEL_FROM = 10 * HOUR * 1000, LEVEL_UNTIL = 3 * 86400 * 1000, LEVEL_EACH_GO = 40;
async function announce(db, env, now = Date.now(), wait = 600) {
	const R = LEVELS.filter((l) => l.rival);
	let n = 0;
	for (const l of LEVELS.filter((x) => x.opens)) {
		const at = Date.parse(l.opens + "T00:00:00Z") + LEVEL_FROM;
		if (now < at || now > at + LEVEL_UNTIL) continue;
		const k = R.indexOf(l), before = k > 0 ? R[k - 1] : null;
		const tried = new Map((await db.prepare("SELECT pid, SUM(ok) AS ok, COUNT(*) AS c FROM mails WHERE kind = 'level' AND about = ? AND pid IS NOT NULL GROUP BY pid").bind(l.name).all())
			.results.map((r) => [r.pid, r]));
		const players = (await db.prepare("SELECT pid, name, email, save FROM players WHERE quiet = 0").all()).results;
		for (const p of players) {
			const t = tried.get(p.pid);
			if (t && (t.ok > 0 || t.c >= 3)) continue;
			let done = {};
			try { done = (JSON.parse(p.save) || {}).done || {}; } catch (e) {}
			if (done[l.name] || (before && !done[before.name])) continue;
			if (n++ >= LEVEL_EACH_GO) return n - 1;   // the rest next hour
			await mail(db, env, p.email, p.pid, "level", { name: p.name, level: l.name, intro: l.intro, picture: k >= 0 ? "rival-" + (k + 1) + ".gif" : "",
				link: SITE + "?play=" + encodeURIComponent(l.name), quiet: await quietLink(db, p.pid) }, l.name);
			if (wait) await new Promise((r) => setTimeout(r, wait));   // (Resend takes a few a second)
		}
	}
	return n;
}

// The link at the foot of a notification: it opens a page with one button, which turns them off (a link alone would be
// followed by the mail apps that look at links, and turn them off for nobody's asking). Mail apps that offer their own
// button for it ask by POST, as the List-Unsubscribe-Post header says, and that turns them off straight away.
async function quietLink(db, pid) {
	let r = await db.prepare("SELECT key FROM players WHERE pid = ?").bind(pid).first();
	if (r && !r.key) { await db.prepare("UPDATE players SET key = ? WHERE pid = ? AND key IS NULL").bind(token().slice(0, 32), pid).run(); r = await db.prepare("SELECT key FROM players WHERE pid = ?").bind(pid).first(); }
	return QUIET + "?k=" + (r ? r.key : "");
}
const QUIET = "https://www.garvitgupta.com/api/packman/quiet";
async function quiet(db, request, url) {
	const k = url.searchParams.get("k") || "", on = url.searchParams.get("on") === "1";
	const p = /^[0-9a-f]{32}$/.test(k) ? await db.prepare("SELECT name, quiet FROM players WHERE key = ?").bind(k).first() : null;
	let say, button = "", q = p && p.quiet;
	if (!p) say = "That link isn’t right. Copy the whole of it from the email.";
	else if (request.method === "POST") {
		q = on ? 0 : 1;
		await db.prepare("UPDATE players SET quiet = ? WHERE key = ?").bind(q, k).run();
		say = q ? "Done: no more emails about the leaderboard or new levels." : "They’re back on: you’ll hear when you’re passed, and when a new level opens.";
	} else say = q ? "Emails about the leaderboard and new levels are off." : "Packman emails you when someone passes you on the leaderboard, and when a new level opens.";
	if (p) button = '<form method="post" action="?k=' + k + (q ? "&on=1" : "") + '"><button>' + (q ? "Turn them back on" : "Stop these emails") + "</button></form>";
	const html = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Packman emails</title><style>' +
		"body{margin:0;min-height:100vh;display:grid;place-items:center;background:#FFF6E5;font:17px/1.5 Nunito,Avenir Next,Segoe UI,Arial,sans-serif;color:#2B2140}" +
		"main{max-width:420px;margin:24px;padding:28px;background:#fff;border:3px solid #2B2140;border-radius:24px;text-align:center}h1{margin:0 0 8px;font-size:24px}" +
		"button{margin-top:16px;padding:12px 24px;font:800 17px inherit;font-family:inherit;color:#2B2140;background:#FFC93C;border:3px solid #2B2140;border-radius:16px;box-shadow:0 4px 0 #2B2140;cursor:pointer}" +
		'a{color:#6E6585}</style></head><body><main><h1>Packman emails</h1><p>' + say + "</p>" + button + '<p><a href="' + SITE + '">Play Packman</a></p></main></body></html>';
	return new Response(html, { status: p ? 200 : 404, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

// GET /api/packman/signin?t=<token>: the game the link opens. A link asked for is used up by it.
async function signin(db, t) {
	if (!/^[0-9a-f]{48}$/.test(t)) return json({ error: "link" }, 400);
	const l = await db.prepare("SELECT pid, exp, once FROM links WHERE token = ?").bind(t).first();
	if (!l || l.exp < nowSec()) return json({ error: "link" }, 410);
	if (l.once) {
		const used = await db.prepare("DELETE FROM links WHERE token = ? AND once = 1").bind(t).run();
		if (used.meta && used.meta.changes === 0) return json({ error: "link" }, 410);
	}
	const p = await db.prepare("SELECT pid, name, email, save FROM players WHERE pid = ?").bind(l.pid).first();
	if (!p) return json({ error: "link" }, 410);
	if (Math.random() < 0.05) await db.prepare("DELETE FROM links WHERE exp < ?").bind(nowSec()).run();
	let save = null;
	try { save = JSON.parse(p.save); } catch (e) {}
	return json({ pid: p.pid, name: p.name, email: p.email, save }, 200, { "Cache-Control": "no-store" });
}

export default {
	async fetch(request, env, ctx) {
		if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
		const db = env.DB || env.db;   // the binding's name, in either case
		if (!db) return json({ error: "no database bound as DB" }, 500);
		try {
			await tables(db);
			const url = new URL(request.url), route = url.pathname.replace(/\/+$/, "").split("/").pop();
			if (route === "player" && request.method === "POST") return await player(db, env, request, ctx);
			if (route === "recover" && request.method === "POST") return await recover(db, env, request);
			if (route === "signin" && request.method === "GET") return await signin(db, url.searchParams.get("t") || "");
			if (route === "quiet") return await quiet(db, request, url);
			if (request.method === "POST") return await submit(db, request, env, ctx);
			const query = url.searchParams, pid = query.get("pid") || "";
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
	// every hour (the schedule is in the wrangler config): the emails for a level that has come out
	async scheduled(event, env, ctx) {
		const db = env.DB || env.db;
		await tables(db);
		ctx.waitUntil(announce(db, env));
	},
};
