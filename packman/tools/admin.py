#!/usr/bin/env python3
"""Packman's admin panel: every player's packing of every level, in one table; the players, with their emails and
what their saved games say; and every email the game sends, as it looks and as it went. On this machine only.

    python3 packman/tools/admin.py          then open http://localhost:8790

It reads the leaderboard's database (D1, through wrangler, which has to be signed in) each time the page is
loaded or refreshed, and serves the page to this machine alone: it listens on 127.0.0.1 and answers nothing
that does not ask for localhost by name. Nothing here is on the site, and nothing new is collected: what the
board keeps is a player's best packing of each level (fewest moves, then the least time), when it was sent,
and the name they go by. Tries, and the packings that were not their best, were never sent anywhere.
"""
import json, os, subprocess, sys, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get('PORT', 8790))
HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)
ROOT = os.path.dirname(GAME)
CONFIG = os.path.join(ROOT, 'extras', 'cloudflare-worker', 'packman-scores.wrangler.jsonc')
MAIL = os.path.join(ROOT, 'extras', 'cloudflare-worker', 'packman-mail.js')   # the emails, as the worker makes them
ART = os.path.join(GAME, 'mail')                                               # and their pictures (tools/mail-art.py)

# the levels in the order they are played, chapter by chapter, as the game deals them
LEVELS_JS = r"""
const vm = require('vm'), fs = require('fs'), path = require('path'), c = {}; c.window = c; vm.createContext(c);
for (const f of ['geom.js', 'levels.js']) vm.runInContext(fs.readFileSync(path.join(process.argv[1], f), 'utf8'), c);
const chap = (l) => l.rival ? 5 : l.invent ? 4 : l.twist ? 3 : l.powers ? 1 : l.bonus ? 2 : 0;
const L = [0, 1, 2, 3, 4, 5].flatMap((k) => c.PackmanLevels.filter((l) => chap(l) === k));
console.log(JSON.stringify(L.map((l) => ({ name: l.name, chapter: chap(l), shapes: l.pieces.length }))));
"""

def levels():
    out = subprocess.run(['node', '-e', LEVELS_JS, GAME], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)

def d1(*sql):
    """The rows of each statement, read in one go."""
    out = subprocess.run(['npx', '--yes', '--prefer-offline', 'wrangler', 'd1', 'execute', 'packman', '--remote', '--json', '-c', CONFIG,
                          '--command', '; '.join(sql)], capture_output=True, text=True, cwd=ROOT)
    try: return [r['results'] for r in json.loads(out.stdout)]
    except Exception: raise RuntimeError((out.stdout + out.stderr).strip()[-600:] or 'wrangler said nothing')

SCORES = 'SELECT level, pid, name, t, m, at FROM scores'
PLAYERS = 'SELECT pid, name, email, made, seen, country, device, quiet, save FROM players'
MAILS = 'SELECT id, pid, email, kind, subject, at, ok, rid, error, about FROM mails ORDER BY id DESC LIMIT 2000'

def summary(p):
    """A player as the panel shows them: their saved game boiled down to what it says about them."""
    try: s = json.loads(p.pop('save') or 'null') or {}
    except Exception: s = {}
    done = s.get('done') or {}
    p.update(packed=len(done), playing=s.get('last') or '', played=round(sum((d or {}).get('t', 0) for d in done.values()), 1),
             mute=bool(s.get('mute')), size=len(json.dumps(s)) if s else 0)
    return p

def data():
    try: scores, players, mails = d1(SCORES, PLAYERS, MAILS)
    except RuntimeError as e:
        if 'no such table' not in str(e): raise
        scores, players, mails = d1(SCORES)[0], [], []   # (the worker makes the other tables the first time it is asked anything)
    return {'levels': levels(), 'scores': scores, 'players': [summary(p) for p in players], 'mails': mails, 'at': int(time.time())}

class Panel(BaseHTTPRequestHandler):
    def send(self, code, body, kind):
        b = body.encode() if isinstance(body, str) else body
        self.send_response(code)
        self.send_header('Content-Type', kind); self.send_header('Content-Length', str(len(b)))
        self.send_header('Cache-Control', 'no-store'); self.send_header('X-Frame-Options', 'DENY')
        self.end_headers(); self.wfile.write(b)

    def do_GET(self):
        host = (self.headers.get('Host') or '').split(':')[0]
        if host not in ('localhost', '127.0.0.1'):   # (another site's page cannot reach in by pointing a name at this machine)
            return self.send(403, 'localhost only', 'text/plain')
        path = self.path.split('?')[0]
        if path == '/': return self.send(200, PAGE, 'text/html; charset=utf-8')
        if path == '/mail.js': return self.send(200, open(MAIL, encoding='utf-8').read(), 'text/javascript; charset=utf-8')
        if path.startswith('/art/'):
            f = os.path.join(ART, os.path.basename(path))
            if os.path.isfile(f): return self.send(200, open(f, 'rb').read(), 'image/gif' if f.endswith('.gif') else 'image/png')
        if path == '/data':
            try: body = data()
            except Exception as e: return self.send(500, json.dumps({'error': str(e)}), 'application/json')
            return self.send(200, json.dumps(body), 'application/json')
        self.send(404, 'not here', 'text/plain')

    def log_message(self, *a): pass

PAGE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Packman Admin</title>
<style>
:root {
  --bg: #f6f5f1; --panel: #ffffff; --ink: #1d1f24; --soft: #5d6370; --faint: #9aa0ab; --line: #e3e1da; --head: #efede7;
  --accent: #3a6df0; --good: #1f9d63; --gold: #c99a06; --silver: #8a94a6; --bronze: #b86a2c; --heat: 58, 109, 240;
  --sticky-shadow: 4px 0 8px -6px rgba(0,0,0,.25);
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #15171c; --panel: #1c1f26; --ink: #e8e9ec; --soft: #a3a9b6; --faint: #6c7383; --line: #2c303a; --head: #222630;
  --accent: #7c9cff; --good: #46c48a; --gold: #e3b72c; --silver: #aab3c4; --bronze: #d58a4c; --heat: 124, 156, 255;
  --sticky-shadow: 4px 0 8px -6px rgba(0,0,0,.7);
} }
:root[data-theme="dark"] {
  --bg: #15171c; --panel: #1c1f26; --ink: #e8e9ec; --soft: #a3a9b6; --faint: #6c7383; --line: #2c303a; --head: #222630;
  --accent: #7c9cff; --good: #46c48a; --gold: #e3b72c; --silver: #aab3c4; --bronze: #d58a4c; --heat: 124, 156, 255;
  --sticky-shadow: 4px 0 8px -6px rgba(0,0,0,.7);
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
header { padding: 18px 16px 10px; display: flex; flex-wrap: wrap; gap: 10px 24px; align-items: baseline; }
h1 { font-size: 20px; margin: 0; }
.stats { display: flex; flex-wrap: wrap; gap: 6px 18px; color: var(--soft); }
.stats b { color: var(--ink); font-variant-numeric: tabular-nums; }
.bar { padding: 0 16px 12px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.bar input, .bar select, .bar button { font: inherit; color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: 7px; padding: 6px 9px; }
.bar button { cursor: pointer; }
.bar button:hover { border-color: var(--accent); }
.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 7px; overflow: hidden; }
.seg button { border: 0; border-radius: 0; }
.seg button[aria-pressed="true"] { background: var(--accent); color: #fff; }
.note { color: var(--faint); padding: 0 16px 10px; max-width: 900px; }
.wrap { margin: 0 16px 24px; overflow: auto; max-height: calc(100vh - 170px); border: 1px solid var(--line); border-radius: 10px; background: var(--panel); }
table { border-collapse: separate; border-spacing: 0; font-variant-numeric: tabular-nums; }
th, td { border-bottom: 1px solid var(--line); border-right: 1px solid var(--line); padding: 6px 8px; white-space: nowrap; vertical-align: top; }
thead th { position: sticky; background: var(--head); z-index: 2; font-weight: 600; text-align: left; }
thead tr.ch th { top: 0; height: 28px; color: var(--soft); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
thead tr.lv th { top: 28px; }
thead tr.lv th.level { min-width: 92px; max-width: 120px; white-space: normal; font-size: 12px; cursor: pointer; }
thead tr.lv th.level small { display: block; color: var(--faint); font-weight: 400; }
th.who, td.who { position: sticky; left: 0; z-index: 1; background: var(--panel); box-shadow: var(--sticky-shadow); min-width: 210px; }
thead th.who { z-index: 3; background: var(--head); }
td.who .name { font-weight: 600; }
td.who .meta { color: var(--faint); font-size: 11px; }
td.cell { cursor: pointer; min-width: 92px; }
td.cell:hover { outline: 2px solid var(--accent); outline-offset: -2px; }
td.none { color: var(--faint); text-align: center; }
.mv { font-weight: 600; }
.du { color: var(--soft); }
.when { display: block; color: var(--faint); font-size: 11px; }
.medal { display: inline-block; min-width: 16px; padding: 0 4px; border-radius: 8px; font-size: 10px; font-weight: 700; color: #fff; text-align: center; margin-left: 4px; }
.r1 { background: var(--gold); } .r2 { background: var(--silver); } .r3 { background: var(--bronze); }
tfoot td { position: sticky; bottom: 0; background: var(--head); font-weight: 600; z-index: 1; border-top: 2px solid var(--line); }
tfoot td.who { z-index: 3; background: var(--head); }
tfoot .du, tfoot .when { font-weight: 400; }
.gone { opacity: .6; }
dialog { border: 1px solid var(--line); border-radius: 12px; background: var(--panel); color: var(--ink); padding: 18px 20px; width: min(420px, calc(100vw - 32px)); }
dialog::backdrop { background: rgba(0,0,0,.35); }
dialog h2 { margin: 0 0 2px; font-size: 16px; }
dialog .sub { color: var(--soft); margin-bottom: 12px; }
dialog dl { display: grid; grid-template-columns: auto 1fr; gap: 6px 14px; margin: 0; }
dialog dt { color: var(--soft); }
dialog dd { margin: 0; font-variant-numeric: tabular-nums; }
nav.tabs { display: flex; gap: 2px; padding: 0 16px; margin-bottom: 12px; border-bottom: 1px solid var(--line); }
nav.tabs button { font: inherit; font-weight: 600; color: var(--soft); background: none; border: 0; border-bottom: 2px solid transparent; padding: 8px 12px; margin-bottom: -1px; cursor: pointer; }
nav.tabs button[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--accent); }
nav.tabs button small { font-weight: 400; color: var(--faint); margin-left: 4px; }
[hidden] { display: none !important; }
.tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; padding: 0 16px 14px; }
.tile { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
.tile b { display: block; font-size: 22px; font-variant-numeric: tabular-nums; }
.tile span { color: var(--soft); font-size: 12px; }
.tile small { display: block; color: var(--faint); font-size: 11px; margin-top: 2px; }
table.list { width: 100%; }
table.list thead th { top: 0; cursor: pointer; user-select: none; }
table.list thead th[data-sort]:hover { color: var(--accent); }
table.list td.num, table.list th.num { text-align: right; }
.wrap.list { max-height: calc(100vh - 260px); }
.dim { color: var(--faint); }
.ok { color: var(--good); font-weight: 600; } .bad { color: #d94848; font-weight: 600; }
.mails { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 14px; padding: 0 16px 16px; }
.mail { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.mail header { display: block; padding: 12px 14px 8px; }
.mail h3 { margin: 0; font-size: 15px; } .mail .when2 { color: var(--soft); margin-top: 2px; }
.mail .subj { margin-top: 8px; } .mail .subj b { color: var(--soft); font-weight: 500; margin-right: 6px; }
.mail .count { color: var(--faint); font-size: 12px; margin-top: 4px; }
.mail iframe { display: block; width: 100%; height: 640px; border: 0; border-top: 1px solid var(--line); background: #fff; }
.mail pre { margin: 0; padding: 12px 14px; height: 640px; overflow: auto; border-top: 1px solid var(--line); white-space: pre-wrap; font: 12px/1.5 ui-monospace, Menlo, monospace; }
.mail .seg { margin: 0 14px 10px; }
h2.part { font-size: 14px; margin: 6px 16px 10px; }
dialog button { margin-top: 14px; font: inherit; padding: 6px 12px; border-radius: 7px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); cursor: pointer; }
.err { margin: 16px; padding: 12px; border-radius: 8px; background: rgba(220,60,60,.12); color: var(--ink); white-space: pre-wrap; }
.loading { padding: 40px 16px; color: var(--soft); }
</style>
</head>
<body>
<header>
  <h1>Packman admin</h1>
  <div class="stats" id="stats"></div>
  <span class="bar" style="padding:0;margin-left:auto"><button id="refresh">Refresh</button><button id="theme" title="Light or dark">◐</button></span>
</header>
<nav class="tabs" role="tablist">
  <button role="tab" data-tab="scores" aria-selected="true">Scores</button>
  <button role="tab" data-tab="players" aria-selected="false">Players<small id="n-players"></small></button>
  <button role="tab" data-tab="emails" aria-selected="false">Emails<small id="n-mails"></small></button>
</nav>
<section id="v-players" hidden>
  <div class="tiles" id="p-tiles"></div>
  <div class="bar">
    <input id="pq" type="search" placeholder="Find a player or an email" aria-label="Find a player or an email">
    <select id="p-show" aria-label="Show"><option value="">Everyone</option><option value="subscribed">Subscribed</option><option value="unsubscribed">Unsubscribed</option><option value="none">No email yet</option></select>
  </div>
  <div class="wrap list" id="p-wrap"><div class="loading">Reading the players…</div></div>
</section>
<section id="v-emails" hidden>
  <h2 class="part">Every email the game sends</h2>
  <div class="mails" id="m-kinds"></div>
  <h2 class="part">Sent</h2>
  <div class="bar"><input id="mq" type="search" placeholder="Find an email address" aria-label="Find an email address">
    <select id="m-kind" aria-label="Kind"><option value="">Every kind</option></select>
    <label><input type="checkbox" id="m-failed"> Only the ones that failed</label></div>
  <div class="wrap list" id="m-wrap"><div class="loading">Reading the emails…</div></div>
</section>
<section id="v-scores">
<div class="bar">
  <input id="q" type="search" placeholder="Find a player" aria-label="Find a player">
  <select id="sort" aria-label="Sort players">
    <option value="done">Most levels packed</option>
    <option value="last">Most recently active</option>
    <option value="first">First seen</option>
    <option value="time">Most time played</option>
    <option value="name">Name</option>
  </select>
  <span class="seg" role="group" aria-label="Detail">
    <button id="d-short" aria-pressed="true">Compact</button><button id="d-long" aria-pressed="false">Detailed</button>
  </span>
  <label><input type="checkbox" id="gone"> Removed levels</label>
  </div>
<div class="note">Each cell is a player's best packing of a level, the one the board keeps: fewest moves, then the least time.
Start is when that packing began (when it was sent, less how long it took). Tries and other packings are not recorded.</div>
<div class="wrap" id="wrap"><div class="loading">Reading the board…</div></div>
</section>
<dialog id="card"></dialog>
<script src="/mail.js"></script>
<script>
(function () {
  var data = null, long = false, showGone = false;
  var $ = function (id) { return document.getElementById(id); };
  try { var th = localStorage.getItem('pm-admin-theme'); if (th) document.documentElement.dataset.theme = th; } catch (e) {}
  try { long = localStorage.getItem('pm-admin-long') === '1'; } catch (e) {}

  function dur(s) {
    s = Math.round(s * 10) / 10;
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), r = s % 60;
    var ss = (r < 10 ? '0' : '') + (Math.round(r * 10) % 10 ? r.toFixed(1) : Math.round(r));
    return h ? h + ':' + (m < 10 ? '0' : '') + m + ':' + ss : m + ':' + ss;
  }
  function day(sec) { return new Date(sec * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  function clock(sec) { return new Date(sec * 1000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  function stamp(sec) { return day(sec) + ', ' + clock(sec); }
  function span(a, b) { return day(a) === day(b) ? stamp(a) + ' → ' + clock(b) : stamp(a) + ' → ' + stamp(b); }
  function ago(sec) {
    var d = Date.now() / 1000 - sec;
    if (d < 3600) return Math.max(1, Math.round(d / 60)) + ' min ago';
    if (d < 86400) return Math.round(d / 3600) + ' h ago';
    return Math.round(d / 86400) + ' d ago';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mean(a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; }
  function median(a) { if (!a.length) return null; var b = a.slice().sort(function (x, y) { return x - y; }), k = b.length >> 1; return b.length % 2 ? b[k] : (b[k - 1] + b[k]) / 2; }
  var CH = ['Seventeen', 'Powers', 'Bricks and hexagons', 'Twists', 'Inventions', 'Game Night'];

  function model(d) {
    var known = {}, cols = d.levels.map(function (l, i) { known[l.name] = true; return { name: l.name, chapter: l.chapter, shapes: l.shapes, no: i + 1 }; });
    d.scores.forEach(function (s) { if (!known[s.level]) { known[s.level] = true; cols.push({ name: s.level, chapter: 6, gone: true }); } });
    var at = {}, people = {};
    d.scores.forEach(function (s) {
      var c = (at[s.level] = at[s.level] || []);
      c.push(s);
      var p = (people[s.pid] = people[s.pid] || { pid: s.pid, name: s.name, cells: {}, first: Infinity, last: 0 });
      p.cells[s.level] = s; p.name = s.name;
      p.first = Math.min(p.first, s.at - s.t); p.last = Math.max(p.last, s.at);
    });
    Object.keys(at).forEach(function (k) {   // a level's places: fewer moves, then less time, as the board has them
      at[k].sort(function (a, b) { return a.m - b.m || a.t - b.t; }).forEach(function (s, i) { s.rank = i + 1; s.of = at[k].length; });
    });
    cols.forEach(function (c) {
      var r = at[c.name] || [], ms = r.map(function (s) { return s.m; }), ts = r.map(function (s) { return s.t; });
      c.n = r.length; c.am = mean(ms); c.at = mean(ts); c.mm = median(ms); c.mt = median(ts);
      c.bm = r.length ? Math.min.apply(null, ms) : null; c.bt = r.length ? Math.min.apply(null, ts) : null;
    });
    var list = Object.keys(people).map(function (k) {
      var p = people[k], cs = Object.keys(p.cells).map(function (n) { return p.cells[n]; });
      p.done = cs.filter(function (s) { return !cols.some(function (c) { return c.gone && c.name === s.level; }); }).length;
      p.time = cs.reduce(function (x, s) { return x + s.t; }, 0); p.moves = cs.reduce(function (x, s) { return x + s.m; }, 0);
      return p;
    });
    return { cols: cols, people: list, at: d.at, rows: d.scores.length };
  }

  function render() {
    if (!data) return;
    var M = data, q = $('q').value.trim().toLowerCase(), by = $('sort').value;
    var cols = M.cols.filter(function (c) { return showGone || !c.gone; });
    var people = M.people.filter(function (p) { return !q || p.name.toLowerCase().indexOf(q) >= 0 || p.pid.toLowerCase().indexOf(q) >= 0; });
    people.sort(function (a, b) {
      if (by === 'name') return a.name.localeCompare(b.name);
      if (by === 'last') return b.last - a.last;
      if (by === 'first') return a.first - b.first;
      if (by === 'time') return b.time - a.time;
      return b.done - a.done || a.moves - b.moves;
    });
    var live = M.cols.filter(function (c) { return !c.gone; }).length;
    $('stats').innerHTML = '<span><b>' + M.people.length + '</b> players</span><span><b>' + M.rows + '</b> packings</span>' +
      '<span><b>' + live + '</b> levels</span><span>read ' + clock(M.at) + '</span>';

    var h = '<table><thead><tr class="ch"><th class="who"></th>';
    var runs = [];
    cols.forEach(function (c) { var k = c.gone ? 'Removed' : CH[c.chapter]; if (runs.length && runs[runs.length - 1][0] === k) runs[runs.length - 1][1]++; else runs.push([k, 1]); });
    runs.forEach(function (r) { h += '<th colspan="' + r[1] + '">' + esc(r[0]) + '</th>'; });
    h += '</tr><tr class="lv"><th class="who">Player</th>';
    cols.forEach(function (c, i) {
      h += '<th class="level' + (c.gone ? ' gone' : '') + '" data-col="' + i + '">' + esc(c.name) + '<small>' + (c.gone ? 'removed' : '#' + c.no) + ' · ' + c.n + ' packed</small></th>';
    });
    h += '</tr></thead><tbody>';
    people.forEach(function (p, pi) {
      h += '<tr><td class="who"><div class="name">' + esc(p.name) + '</div><div class="meta">' + p.done + ' of ' + live + ' · ' + dur(p.time) + ' · ' + p.moves + ' moves</div>' +
        '<div class="meta">last ' + ago(p.last) + ' · ' + esc(p.pid.slice(0, 8)) + '</div></td>';
      cols.forEach(function (c, ci) {
        var s = p.cells[c.name];
        if (!s) { h += '<td class="none">·</td>'; return; }
        var heat = c.bm != null && c.am ? Math.max(0, Math.min(1, (s.m - c.bm) / Math.max(1, c.am * 1.5 - c.bm))) : 0;
        h += '<td class="cell' + (c.gone ? ' gone' : '') + '" data-p="' + pi + '" data-c="' + ci + '" style="background:rgba(var(--heat),' + (heat * 0.22).toFixed(3) + ')">' +
          '<span class="mv">' + s.m + '</span> <span class="du">· ' + dur(s.t) + '</span>' + (s.rank <= 3 ? '<span class="medal r' + s.rank + '">' + s.rank + '</span>' : '') +
          (long ? '<span class="when">' + span(s.at - s.t, s.at) + '</span><span class="when">#' + s.rank + ' of ' + s.of + '</span>' : '') + '</td>';
      });
      h += '</tr>';
    });
    var dm = mean(M.people.map(function (p) { return p.done; })), tm = mean(M.people.map(function (p) { return p.time; }));
    h += '</tbody><tfoot><tr><td class="who">Average<div class="meta">' + (dm == null ? '' : dm.toFixed(1) + ' levels · ' + dur(tm) + ' a player') + '</div></td>';
    cols.forEach(function (c) {
      if (!c.n) { h += '<td class="none">·</td>'; return; }
      h += '<td><span class="mv">' + c.am.toFixed(1) + '</span> <span class="du">· ' + dur(c.at) + '</span>' +
        (long ? '<span class="when">median ' + c.mm + ' · ' + dur(c.mt) + '</span><span class="when">best ' + c.bm + ' · ' + dur(c.bt) + '</span><span class="when">' + c.n + ' players</span>' : '') + '</td>';
    });
    h += '</tr></tfoot></table>';
    $('wrap').innerHTML = h;
    $('wrap').onclick = function (e) {
      var td = e.target.closest('td.cell'); if (!td) return;
      var p = people[+td.dataset.p], c = cols[+td.dataset.c]; show(p, c, p.cells[c.name]);
    };
  }

  function show(p, c, s) {
    var vs = function (v, a) { if (a == null) return ''; var d = (v - a) / a * 100; return ' <span style="color:var(--faint)">(' + (d > 0 ? '+' : '') + d.toFixed(0) + '% vs average)</span>'; };
    $('card').innerHTML = '<h2>' + esc(p.name) + ' · ' + esc(c.name) + '</h2><div class="sub">' + (c.gone ? 'a removed level' : 'level ' + c.no + ', ' + CH[c.chapter]) + '</div><dl>' +
      '<dt>Started</dt><dd>' + stamp(s.at - s.t) + '</dd><dt>Finished</dt><dd>' + stamp(s.at) + '</dd>' +
      '<dt>Duration</dt><dd>' + dur(s.t) + vs(s.t, c.at) + '</dd><dt>Moves</dt><dd>' + s.m + vs(s.m, c.am) + '</dd>' +
      '<dt>Place</dt><dd>#' + s.rank + ' of ' + s.of + '</dd><dt>Level best</dt><dd>' + c.bm + ' moves · ' + dur(c.bt) + '</dd>' +
      '<dt>Player</dt><dd>' + esc(p.pid) + '</dd></dl><button autofocus>Close</button>';
    $('card').querySelector('button').onclick = function () { $('card').close(); };
    $('card').showModal();
  }

  // ---- Players: everyone the board or the accounts know, by id ----
  var raw = null, pSort = 'active', pDesc = true;
  function people() {
    var by = {}, M = data;
    M.people.forEach(function (p) { by[p.pid] = { pid: p.pid, name: p.name, board: p.done, boardTime: p.time, first: p.first, last: p.last }; });
    raw.players.forEach(function (a) {
      var p = by[a.pid] = by[a.pid] || { pid: a.pid, board: 0, boardTime: 0, first: Infinity, last: 0 };
      p.name = a.name; p.email = a.email; p.made = a.made; p.seen = a.seen; p.country = a.country; p.device = a.device;
      p.packed = a.packed; p.playing = a.playing; p.played = a.played; p.size = a.size; p.quiet = a.quiet;
    });
    var sent = {};
    raw.mails.forEach(function (m) { if (m.pid) sent[m.pid] = (sent[m.pid] || 0) + 1; });
    return Object.keys(by).map(function (k) {
      var p = by[k]; p.mails = sent[k] || 0; p.notify = p.email ? (p.quiet ? 'unsubscribed' : 'subscribed') : '';
      p.joined = Math.min(p.made || Infinity, p.first); if (!isFinite(p.joined)) p.joined = null;
      p.active = Math.max(p.seen || 0, p.last || 0) || null;
      p.levels = Math.max(p.packed || 0, p.board || 0);
      return p;
    });
  }
  function tally(list, key) {
    var c = {}; list.forEach(function (p) { var k = p[key]; if (k) c[k] = (c[k] || 0) + 1; });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a]; }).map(function (k) { return k + ' ' + c[k]; });
  }
  function renderPlayers() {
    if (!raw) return;
    var all = people(), now = Date.now() / 1000, day = 86400;
    var withEmail = all.filter(function (p) { return p.email; });
    var count = function (f) { return all.filter(f).length; };
    var kinds = tally(withEmail.map(function (p) { return { k: (p.device || '').split(' · ')[0] }; }), 'k');
    var tiles = [
      ['Players', all.length, withEmail.length + ' with an email'],
      ['New this week', count(function (p) { return p.joined && now - p.joined < 7 * day; }), count(function (p) { return p.joined && now - p.joined < day; }) + ' today'],
      ['Active today', count(function (p) { return p.active && now - p.active < day; }), count(function (p) { return p.active && now - p.active < 7 * day; }) + ' this week'],
      ['Subscribed', count(function (p) { return p.email && !p.quiet; }), count(function (p) { return p.quiet; }) + ' unsubscribed · ' + (all.length - withEmail.length) + ' with no email yet'],
      ['Levels packed', all.reduce(function (x, p) { return x + p.levels; }, 0), (all.length ? (all.reduce(function (x, p) { return x + p.levels; }, 0) / all.length).toFixed(1) : 0) + ' a player'],
      ['Devices', kinds.length ? kinds[0].split(' ')[1] : 0, kinds.join(' · ') || 'from players with an email'],
      ['Countries', tally(withEmail, 'country').length, tally(withEmail, 'country').slice(0, 4).join(' · ')],
      ['Emails sent', raw.mails.filter(function (m) { return m.ok; }).length, raw.mails.filter(function (m) { return !m.ok; }).length + ' failed'],
    ];
    $('p-tiles').innerHTML = tiles.map(function (t) { return '<div class="tile"><span>' + esc(t[0]) + '</span><b>' + esc(t[1]) + '</b><small>' + esc(t[2]) + '</small></div>'; }).join('');
    var q = $('pq').value.trim().toLowerCase(), only = $('p-show').value;
    var rows = all.filter(function (p) { return (!q || (p.name + ' ' + (p.email || '') + ' ' + p.pid).toLowerCase().indexOf(q) >= 0) && (!only || (only === 'none' ? !p.email : p.notify === only)); });
    rows.sort(function (a, b) {
      var x = a[pSort], y = b[pSort];
      if (x == null || x === '') return 1; if (y == null || y === '') return -1;
      var d = typeof x === 'string' ? x.localeCompare(y) : x - y;
      return pDesc ? -d : d;
    });
    var cols = [['name', 'Name'], ['email', 'Email'], ['notify', 'Notifications'], ['joined', 'Joined'], ['active', 'Last seen'], ['levels', 'Levels', 1], ['boardTime', 'Time on the board', 1],
                ['playing', 'On level'], ['device', 'Device'], ['country', 'Country'], ['mails', 'Emails', 1], ['pid', 'Id']];
    var h = '<table class="list"><thead><tr>' + cols.map(function (c) { return '<th data-sort="' + c[0] + '"' + (c[2] ? ' class="num"' : '') + '>' + c[1] + (pSort === c[0] ? (pDesc ? ' ↓' : ' ↑') : '') + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (p) {
      h += '<tr><td><b>' + esc(p.name || '') + '</b></td><td>' + (p.email ? esc(p.email) : '<span class="dim">none yet</span>') + '</td>' +
        '<td>' + (!p.email ? '<span class="dim">·</span>' : p.quiet ? '<span class="bad">Unsubscribed</span>' : '<span class="ok">Subscribed</span>') + '</td>' +
        '<td>' + (p.joined ? stamp(p.joined) : '') + '</td><td>' + (p.active ? ago(p.active) : '') + '</td>' +
        '<td class="num">' + p.levels + '</td><td class="num">' + (p.boardTime ? dur(p.boardTime) : '') + '</td>' +
        '<td>' + esc(p.playing || '') + '</td><td>' + esc(p.device || '') + '</td><td>' + esc(p.country || '') + '</td>' +
        '<td class="num">' + (p.mails || '') + '</td><td class="dim">' + esc(p.pid.slice(0, 8)) + '</td></tr>';
    });
    $('p-wrap').innerHTML = h + '</tbody></table>' + (rows.length ? '' : '<div class="loading">Nobody here.</div>');
    $('p-wrap').querySelector('thead').onclick = function (e) {
      var th = e.target.closest('th'); if (!th) return;
      if (pSort === th.dataset.sort) pDesc = !pDesc; else { pSort = th.dataset.sort; pDesc = !/^(name|email|notify|playing|device|country|pid)$/.test(pSort); }
      renderPlayers();
    };
    $('n-players').textContent = all.length;
  }

  // ---- Emails: each kind as it looks (made here by the worker's own code, with a made-up player), then every one sent ----
  var textOf = {};
  function renderKinds() {
    var art = location.origin + '/art/', sent = {};   // (the pictures from this machine, as they will be on the site)
    (raw ? raw.mails : []).forEach(function (m) { sent[m.kind] = (sent[m.kind] || 0) + 1; });
    $('m-kinds').innerHTML = PackmanMail.kinds.map(function (k) {
      return '<article class="mail" data-kind="' + k.kind + '"><header><h3>' + esc(k.title) + '</h3><div class="when2">' + esc(k.when) + '</div>' +
        '<div class="subj"><b>Subject</b><span></span></div><div class="count">' + (sent[k.kind] || 0) + ' sent</div></header>' +
        '<span class="seg"><button aria-pressed="true" data-v="html">Email</button><button aria-pressed="false" data-v="text">Plain text</button></span>' +
        '<iframe title="' + esc(k.title) + '" sandbox></iframe><pre hidden></pre></article>';
    }).join('');
    Array.prototype.forEach.call($('m-kinds').children, function (a) {
      var k = PackmanMail.kinds.filter(function (x) { return x.kind === a.dataset.kind; })[0], d = {};
      Object.keys(k.sample).forEach(function (f) { d[f] = k.sample[f]; }); d.art = art;
      var m = PackmanMail.make(k.kind, d);
      a.querySelector('.subj span').textContent = m.subject;
      a.querySelector('iframe').srcdoc = m.html; a.querySelector('pre').textContent = m.text;
      a.querySelector('.seg').onclick = function (e) {
        var v = e.target.dataset.v; if (!v) return;
        a.querySelectorAll('.seg button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.v === v); });
        a.querySelector('iframe').hidden = v !== 'html'; a.querySelector('pre').hidden = v !== 'text';
      };
    });
    var sel = $('m-kind');
    if (sel.options.length === 1) PackmanMail.kinds.forEach(function (k) { var o = document.createElement('option'); o.value = k.kind; o.textContent = k.title; sel.appendChild(o); });
  }
  function renderMails() {
    if (!raw) return;
    var q = $('mq').value.trim().toLowerCase(), kind = $('m-kind').value, failed = $('m-failed').checked, title = {};
    PackmanMail.kinds.forEach(function (k) { title[k.kind] = k.title; });
    var rows = raw.mails.filter(function (m) { return (!q || m.email.indexOf(q) >= 0) && (!kind || m.kind === kind) && (!failed || !m.ok); });
    var h = '<table class="list"><thead><tr><th>Sent</th><th>To</th><th>Email</th><th>About</th><th>Subject</th><th>How it went</th><th>Resend id</th></tr></thead><tbody>';
    rows.forEach(function (m) {
      h += '<tr><td>' + stamp(m.at) + ' <span class="dim">· ' + ago(m.at) + '</span></td><td>' + esc(m.email) + '</td><td>' + esc(title[m.kind] || m.kind) + '</td><td>' + esc(m.about || '') + '</td><td>' + esc(m.subject || '') + '</td>' +
        '<td>' + (m.ok ? '<span class="ok">sent</span>' : '<span class="bad">failed</span> <span class="dim">' + esc(m.error || '') + '</span>') + '</td><td class="dim">' + esc(m.rid || '') + '</td></tr>';
    });
    $('m-wrap').innerHTML = h + '</tbody></table>' + (rows.length ? '' : '<div class="loading">None yet.</div>');
    $('n-mails').textContent = raw.mails.length;
  }
  $('pq').oninput = renderPlayers; $('p-show').onchange = renderPlayers;
  $('mq').oninput = renderMails; $('m-kind').onchange = renderMails; $('m-failed').onchange = renderMails;
  function tab(name) {
    document.querySelectorAll('nav.tabs button').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.tab === name); });
    ['scores', 'players', 'emails'].forEach(function (v) { $('v-' + v).hidden = v !== name; });
    try { localStorage.setItem('pm-admin-tab', name); } catch (e) {}
  }
  document.querySelector('nav.tabs').onclick = function (e) { var b = e.target.closest('button'); if (b) tab(b.dataset.tab); };
  try { tab(localStorage.getItem('pm-admin-tab') || 'scores'); } catch (e) {}
  renderKinds();

  function load() {
    $('refresh').disabled = true;
    fetch('/data', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      if (d.error) throw new Error(d.error);
      raw = d; data = model(d); render(); renderPlayers(); renderKinds(); renderMails();
    }).catch(function (e) {
      $('wrap').innerHTML = '<div class="err">Could not read the board.\n\n' + esc(e.message) + '\n\nIs wrangler signed in? (npx wrangler login)</div>';
    }).then(function () { $('refresh').disabled = false; });
  }

  function setLong(v) { long = v; $('d-long').setAttribute('aria-pressed', v); $('d-short').setAttribute('aria-pressed', !v); try { localStorage.setItem('pm-admin-long', v ? '1' : '0'); } catch (e) {} render(); }
  $('d-short').onclick = function () { setLong(false); };
  $('d-long').onclick = function () { setLong(true); };
  $('q').oninput = render; $('sort').onchange = render;
  $('gone').onchange = function () { showGone = this.checked; render(); };
  $('refresh').onclick = load;
  $('theme').onclick = function () {
    var dark = matchMedia('(prefers-color-scheme: dark)').matches, cur = document.documentElement.dataset.theme || (dark ? 'dark' : 'light');
    var next = cur === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = next;
    try { localStorage.setItem('pm-admin-theme', next); } catch (e) {}
  };
  $('d-long').setAttribute('aria-pressed', long); $('d-short').setAttribute('aria-pressed', !long);
  load();
})();
</script>
</body>
</html>
"""

if __name__ == '__main__':
    server = ThreadingHTTPServer(('127.0.0.1', PORT), Panel)
    print('Packman admin: http://localhost:%d  (this machine only; Ctrl-C to stop)' % PORT, flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
