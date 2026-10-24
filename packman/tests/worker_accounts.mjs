// The leaderboard worker's accounts and emails (players, links, the welcome, getting a game back, being passed on the
// board, a new level opening, and turning the notifications off), run in Node against a real SQLite in place of D1, with
// Resend answered here. Run by test_accounts.py: node worker_accounts.mjs <the built worker>
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs'; import vm from 'vm'; import path from 'path'; import { fileURLToPath } from 'url';
const W = (await import(process.argv[2])).default;
const game = {}; game.window = game; vm.createContext(game);   // the levels, as the game has them, to play
for (const f of ['geom.js', 'levels.js']) vm.runInContext(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', f), 'utf8'), game);
const PackmanLevels = game.PackmanLevels;
const sql = new DatabaseSync(':memory:');
const stmt = (q, args = []) => ({
  bind: (...a) => stmt(q, a),
  first: async () => sql.prepare(q).get(...args) ?? null,
  all: async () => ({ results: sql.prepare(q).all(...args) }),
  run: async () => { const r = sql.prepare(q).run(...args); return { meta: { changes: r.changes } }; },
});
const DB = { prepare: (q) => stmt(q), batch: async (l) => { for (const s of l) await s.run(); return []; } };
let sent = [], down = false;
globalThis.fetch = async (url, o) => {
  if (down) return new Response(JSON.stringify({ message: 'resend is down' }), { status: 500 });
  sent.push(JSON.parse(o.body)); return new Response(JSON.stringify({ id: 'r' + sent.length }), { status: 200 });
};
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (f, ms, ...a) => realTimeout(f, 0, ...a);   // (the pause between the emails of a run, not waited for)
let clock = Date.parse('2026-10-20T12:00:00Z');
Date.now = () => clock;
const env = { DB, RESEND_API_KEY: 'k' };
let jobs = [];
const ctx = { waitUntil: (p) => jobs.push(p) };
const settle = async () => { while (jobs.length) await jobs.shift(); };
const call = async (path, body, method = body ? 'POST' : 'GET', ip = '1.1.1.1') => {
  const r = await W.fetch(new Request('https://www.garvitgupta.com/api/packman' + path, body || method !== 'GET' ? { method, body: body ? JSON.stringify(body) : undefined,
    headers: { 'User-Agent': 'Mozilla/5.0 (iPhone) Safari/604.1', 'CF-Connecting-IP': ip } } : {}), env, ctx);
  await settle();
  const text = await r.text();
  try { return [r.status, JSON.parse(text)]; } catch (e) { return [r.status, text]; }
};
let failed = 0;
const ok = (c, m) => { if (!c) { console.log('FAIL', m); failed++; } else console.log('ok  ', m); };
const mails = (kind) => sent.filter((m) => m.subject && kinds[kind](m));
const kinds = { welcome: (m) => /is saved/.test(m.subject), signin: (m) => /Your link/.test(m.subject), passed: (m) => /passed you/.test(m.subject), level: (m) => /is open in Packman/.test(m.subject) };
const to = (m) => m.to[0];

// ---- players, the welcome, links ----
const A = 'aaaaaaaa-0000-0000-0000-000000000001', B = 'bbbbbbbb-0000-0000-0000-000000000002', C = 'cccccccc-0000-0000-0000-000000000003';
let [s, d] = await call('/player', { pid: A, name: 'Ada', email: ' Ada@Example.com ', save: { done: { Flip: { t: 9, m: 4 } } } });
ok(s === 200 && d.fresh, 'a new player is kept');
ok(sent.length === 1 && to(sent[0]) === 'ada@example.com' && sent[0].subject === 'Your Packman game is saved', 'and sent the welcome');
ok(/mail\/logo\.png/.test(sent[0].html) && !sent[0].headers, 'with the logo, and no way to turn it off (it is not a notification)');
const welcome = /signin=([0-9a-f]+)/.exec(sent[0].text)[1];
[s, d] = await call('/player', { pid: A, name: 'Ada', email: 'ada@example.com', save: { done: { Flip: { t: 8, m: 4 } } } });
ok(s === 200 && !d.fresh && sent.length === 1, 'a save sent again sends no email');
[s, d] = await call('/player', { pid: B, name: 'Bo', email: 'ADA@example.com' });
ok(s === 409 && d.error === 'taken', 'another player cannot take that email');
[s, d] = await call('/player', { pid: B, name: 'Bo', email: 'not an email' });
ok(s === 400 && d.error === 'email', 'a bad email is turned away');
[s, d] = await call('/recover', { email: 'nobody@example.com' });
ok(s === 200 && sent.length === 1, 'no email for an address with no game, and the same answer');
[s, d] = await call('/recover', { email: 'ada@EXAMPLE.com' });
ok(s === 200 && sent.length === 2 && sent[1].subject === 'Your link to Packman', 'a link for one with a game');
const t = /signin=([0-9a-f]+)/.exec(sent[1].text)[1];
[s, d] = await call('/signin?t=' + t);
ok(s === 200 && d.pid === A && d.name === 'Ada' && d.save.done.Flip.t === 8, 'the link opens the latest save');
[s, d] = await call('/signin?t=' + t);
ok(s === 410, 'and only once');
[s, d] = await call('/signin?t=' + welcome); const again = await call('/signin?t=' + welcome);
ok(s === 200 && again[0] === 200, 'the welcome link keeps working');
clock += 2 * 3600 * 1000;
const t2 = (await call('/recover', { email: 'ada@example.com' }), /signin=([0-9a-f]+)/.exec(sent[sent.length - 1].text)[1]);
clock += 3601 * 1000;
ok((await call('/signin?t=' + t2))[0] === 410, 'a link asked for runs out after an hour');
ok(sql.prepare('SELECT COUNT(*) c FROM mails WHERE ok = 1').get().c === 3, 'every email logged');
const p = sql.prepare('SELECT * FROM players').get(); ok(p.device === 'phone · Safari', 'device: ' + p.device);
env.RESEND_API_KEY = ''; await call('/player', { pid: B, name: 'Bo', email: 'bo@example.com' }); env.RESEND_API_KEY = 'k';
const f = sql.prepare("SELECT * FROM mails WHERE email = 'bo@example.com'").get(); ok(f && f.ok === 0 && /RESEND/.test(f.error), 'a failed send is logged with why');
{ // getting a game back, many times in an hour: the ones that failed to go are not counted, and past five it says so
  const n0 = sent.length;
  down = true; for (let k = 0; k < 3; k++) [s, d] = await call('/recover', { email: 'ada@example.com' }, 'POST', '9.9.9.' + k); down = false;
  ok(s === 502 && d.error === 'send', 'a link that could not be sent says so');
  let got = 0;
  for (let k = 0; k < 5; k++) { [s, d] = await call('/recover', { email: 'ada@example.com' }, 'POST', '8.8.8.' + k); if (s === 200) got++; }
  ok(got === 5 && sent.length === n0 + 5, 'the failed ones take nothing from the five an hour (' + got + ')');
  [s, d] = await call('/recover', { email: 'ada@example.com' }, 'POST', '7.7.7.7');
  ok(s === 429 && d.error === 'slow down' && sent.length === n0 + 5, 'a sixth in the hour is turned down, and says so');
  clock += 3601 * 1000;
}
[s, d] = await call('', null); ok(s === 200 && 'top' in d, 'the board still answers');

// ---- passed on the board ----
const LV = PackmanLevels.filter((l) => !l.powers && !l.rival && !l.opens).slice(0, 6);
const win = (pid, name, l, m, ip) => call('', { level: l.name, pid, name, t: 20, m: m || l.pieces.length, p: l.solution }, 'POST', ip);
await call('/player', { pid: C, name: 'Cy', email: 'cy@example.com' });
sent = [];
for (const l of LV.slice(0, 3)) await win(A, 'Ada', l);   // Ada: three levels
for (const l of LV.slice(0, 2)) await win(B, 'Bo', l);    // Bo: two
ok(!mails('passed').length, 'nobody is passed by climbing to below them');
[s] = await win(B, 'Bo', LV[2], LV[2].pieces.length + 5); ok(s === 200, 'Bo packs a third, in more moves than Ada');
ok(!mails('passed').length, 'level with Ada on levels, behind on moves: nobody passed');
await win(B, 'Bo', LV[3]);
let pm = mails('passed');
ok(pm.length === 1 && to(pm[0]) === 'ada@example.com' && pm[0].subject === 'Bo just passed you in Packman', 'four levels to three: Ada hears Bo passed her');
ok(/You’re 2nd of \d/.test(pm[0].text) && /passed\.gif/.test(pm[0].html) && /Play now/.test(pm[0].html), 'with her new place, the picture, and Play now');
ok(pm[0].headers && /quiet\?k=[0-9a-f]{32}/.test(pm[0].headers['List-Unsubscribe']) && pm[0].headers['List-Unsubscribe-Post'], 'and a way to turn them off, in the headers too');
const quietUrl = /Unsubscribe: (\S+)/.exec(pm[0].text)[1];
for (const l of LV.slice(3, 5)) await win(A, 'Ada', l);   // Ada back ahead: Bo is passed
ok(mails('passed').length === 2 && to(mails('passed')[1]) === 'bo@example.com', 'Ada takes it back: Bo hears');
await win(B, 'Bo', LV[4]); await win(B, 'Bo', LV[5]);
ok(mails('passed').length === 2, 'Ada is not told twice in twelve hours');
clock += 13 * 3600 * 1000;
await win(A, 'Ada', LV[5], LV[5].pieces.length);   // (level with Bo again on everything but time)
// Cy turns them off, then is passed: no email
[s, d] = await call(quietUrl.replace('https://www.garvitgupta.com/api/packman', ''));
ok(s === 200 && />Unsubscribe</.test(d), 'the link opens a page with a button, and changes nothing by itself');
ok(sql.prepare("SELECT quiet FROM players WHERE pid = ?").get(A).quiet === 0, 'still on after only looking');
[s, d] = await call(quietUrl.replace('https://www.garvitgupta.com/api/packman', ''), null, 'POST');
ok(s === 200 && /won’t get/.test(d) && sql.prepare("SELECT quiet FROM players WHERE pid = ?").get(A).quiet === 1, 'the button turns them off');
const before = mails('passed').length;
clock += 13 * 3600 * 1000;   // (Bo was told of Ada a moment ago)
for (const l of LV) await win(C, 'Cy', l, l.pieces.length);
ok(!mails('passed').slice(before).some((m) => to(m) === 'ada@example.com'), 'Ada, turned off, is not told she was passed');
ok(mails('passed').slice(before).some((m) => to(m) === 'bo@example.com' && /Cy just passed/.test(m.subject)), 'Bo is');
[s, d] = await call(quietUrl.replace('https://www.garvitgupta.com/api/packman', '') + '&on=1', null, 'POST');
ok(/subscribed again/.test(d) && sql.prepare("SELECT quiet FROM players WHERE pid = ?").get(A).quiet === 0, 'and they can be turned back on');
ok((await call('/quiet?k=' + '0'.repeat(32)))[0] === 404, 'a made-up key opens nothing');

// ---- a new level is open ----
const run = async () => { await W.scheduled({}, env, ctx); await settle(); };
const R = PackmanLevels.filter((l) => l.rival);
await call('/player', { pid: A, name: 'Ada', email: 'ada@example.com', save: { done: { [R[0].name]: { t: 30, m: 3 } } } });
await call('/player', { pid: B, name: 'Bo', email: 'bo@example.com', save: { done: {} } });
await call('/player', { pid: C, name: 'Cy', email: 'cy@example.com', save: { done: {} } });
sent = [];
clock = Date.parse(R[0].opens + 'T09:00:00Z'); await run();
ok(!mails('level').length, 'nothing before ten, UTC, the day it opens');
clock = Date.parse(R[0].opens + 'T10:30:00Z'); await run();
let lm = mails('level');
ok(lm.length === 2 && lm.every((m) => m.subject === R[0].name + ' is open in Packman') && lm.map(to).sort().join() === 'bo@example.com,cy@example.com',
  'the first Rival: everyone who has not packed it (Ada has): ' + lm.map(to));
ok(/\?play=Opening%20Hand/.test(lm[0].html) && /rival-1\.gif/.test(lm[0].html) && /Play now/.test(lm[0].html) && lm[0].headers['List-Unsubscribe'], 'a link straight to it, its picture, and a way to turn them off');
clock += 3600 * 1000; await run();
ok(mails('level').length === 2, 'nobody hears twice');
clock = Date.parse(R[1].opens + 'T11:00:00Z'); sent = []; await run();
lm = mails('level');
ok(lm.length === 1 && to(lm[0]) === 'ada@example.com' && /rival-2\.gif/.test(lm[0].html), 'the second: only who packed the first');
down = true; await call('/player', { pid: B, name: 'Bo', email: 'bo@example.com', save: { done: { [R[0].name]: { t: 30, m: 3 } } } });
clock += 3600 * 1000; await run(); clock += 3600 * 1000; await run(); clock += 3600 * 1000; await run(); clock += 3600 * 1000; await run();
ok(sql.prepare("SELECT COUNT(*) c FROM mails WHERE kind = 'level' AND about = ? AND pid = ? AND ok = 0").get(R[1].name, B).c === 3, 'a send that fails is tried three times, and no more');
down = false;
clock = Date.parse(R[1].opens + 'T11:00:00Z') + 4 * 86400 * 1000; await run();
ok(!sql.prepare("SELECT COUNT(*) c FROM mails WHERE kind = 'level' AND about = ? AND ok = 1 AND pid = ?").get(R[1].name, B).c, 'and three days on, nobody is told any more');
await call(quietUrl.replace('https://www.garvitgupta.com/api/packman', ''), null, 'POST');   // Ada: off
await call('/player', { pid: A, name: 'Ada', email: 'ada@example.com', save: { done: { [R[0].name]: 1, [R[1].name]: 1 } } });
clock = Date.parse(R[2].opens + 'T11:00:00Z'); sent = []; await run();
ok(!mails('level').length, 'nor anyone who turned them off');

// ---- one player, two devices: what each sends is made one with what the other did ----
const D = 'dddddddd-0000-0000-0000-000000000004', day = '2026-11-01';
await call('/player', { pid: D, name: 'Di', email: 'di@example.com', save: { name: 'Di', email: 'di@example.com', named: 1, done: { Flip: { t: 9, m: 4 } }, sent: { Flip: 1 }, hints: { 'chapter 0': { n: 2, day } }, mute: true } });
// the laptop, which has not heard of the phone's Flip, packs Home, and was renamed before the phone was
[s, d] = await call('/player', { pid: D, name: 'Dee', email: 'di@example.com', save: { name: 'Dee', email: 'di@example.com', named: 0, done: { Home: { t: 30, m: 6 }, Flip: { t: 12, m: 5 } }, hints: { 'chapter 0': { n: 3, day } }, mute: false } });
ok(s === 200 && d.save && d.save.done.Flip.m === 4 && d.save.done.Home.m === 6, 'the laptop hears of the phone\'s level, and keeps its own');
ok(d.save.sent.Flip === 1 && !d.save.sent.Home, 'the phone\'s better Flip is the one on the board; the laptop\'s Home is still to send');
ok(d.save.hints['chapter 0'].n === 2, 'a hint used on the phone is used on the laptop too');
ok(d.save.name === 'Di' && sql.prepare('SELECT name FROM players WHERE pid = ?').get(D).name === 'Di', 'the name given last wins, not the device that spoke last');
ok(d.save.mute === false, 'the laptop keeps its own sound');
const kept = JSON.parse(sql.prepare('SELECT save FROM players WHERE pid = ?').get(D).save);
ok(kept.done.Flip.m === 4 && kept.done.Home.m === 6, 'and the server keeps both');
[s, d] = await call('/player', { pid: D, name: 'Di', email: 'di@example.com', save: { name: 'Di', email: 'di@example.com', named: 1, done: { Flip: { t: 9, m: 4 } }, sent: { Flip: 1 } } });
ok(d.save.done.Home && d.save.done.Home.m === 6, 'the phone, sending what it had, loses nothing the laptop did');
[s, d] = await call('/player', { pid: D, name: 'Di', email: 'di@example.com', save: { name: 'Didi', email: 'di@example.com', named: 5, done: {} } });
ok(d.save.name === 'Didi' && sql.prepare('SELECT name FROM players WHERE pid = ?').get(D).name === 'Didi', 'a later rename on either device sticks');

// ---- the levels that were renamed ----
[s, d] = await call('', { level: 'Rival 1', pid: D, name: 'Di', t: 30, m: 3, p: [[9, 9, 0], [9, 9, 0], [9, 9, 0], [9, 9, 0], [9, 9, 0], [9, 9, 0]] }, 'POST');
ok(s === 400 && d.error !== 'level', 'a score sent under a level\'s old name is judged as the level it is now (' + d.error + ')');
[s, d] = await call('/player', { pid: D, name: 'Didi', email: 'di@example.com', save: { name: 'Didi', email: 'di@example.com', named: 6, done: { 'Rival 1': { t: 40, m: 3 } }, sent: { 'Rival 1': 1 }, last: 'Rival 2' } });
ok(d.save.done['Opening Hand'] && !d.save.done['Rival 1'] && d.save.sent['Opening Hand'] && d.save.last === 'Square Off', 'a save from before the names is kept under them');

if (failed) process.exitCode = 1;
