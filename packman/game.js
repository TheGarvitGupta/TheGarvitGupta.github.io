// Packman: the board, the dragging and spinning, and the celebrations.
(function () {
  'use strict';

  var G = PackmanGeom, LEVELS = PackmanLevels;
  var NS = 'http://www.w3.org/2000/svg';
  var COLORS = ['#FF6B6B', '#FFC93C', '#3DDBB4', '#4DA8FF', '#9B7BFF', '#FF8FCB', '#FF9F45', '#B5E655', '#45D9E6', '#D987F5', '#FFB59E'];
  var PRAISE = ['Packed!', 'Snug!', 'Tidy!', 'Nailed it!', 'So neat!', 'Boxed!'];
  var STORE = 'packman.v1';
  // Whoever packs all seventeen is asked to send Garvit a screenshot. Set false and the prize is not mentioned.
  var PRIZE = true;
  // The leaderboard lives in a Cloudflare Worker (extras/cloudflare-worker/packman-scores.js).
  var SCORES = 'https://www.garvitgupta.com/api/packman';
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|)$/.test(location.hostname);   // served from this machine: read the board, never write to it
  if (LOCAL && /[?&]scores=([^&]+)/.test(location.search)) SCORES = decodeURIComponent(RegExp.$1);   // a stand-in board, for trying things out
  // Anyone who skips giving a name is a colour and an animal: the colour of their block, so Blue Leopard is blue.
  var HUES = ['Red', 'Golden', 'Mint', 'Blue', 'Violet', 'Pink', 'Orange', 'Lime', 'Aqua', 'Orchid', 'Peach'];
  var ANIMALS = ['Fox', 'Leopard', 'Otter', 'Panda', 'Tiger', 'Owl', 'Wolf', 'Koala', 'Lynx', 'Heron', 'Badger', 'Falcon',
    'Dolphin', 'Moose', 'Raven', 'Gecko', 'Bison', 'Puffin', 'Hare', 'Seal', 'Yak', 'Crane', 'Lemur', 'Ibex'];
  var MAIN = LEVELS.filter(function (l) { return !l.bonus; }).length;   // the bonus levels follow these
  var TURN = { square: 90, triangle: 120, domino: 180, hexagon: 60 };   // degrees before a shape looks the same again
  var KNOB = { square: 0.72, triangle: 0.6, domino: 0.72, hexagon: 1.08 };
  // What a piece wears. Everything is in face units and stays well inside the
  // body, so no outfit changes the shape the player has to pack.
  var OUTFITS = [
    {},
    { wear: [['circle', 'wear', { cx: -0.13, cy: -0.06, r: 0.088 }], ['circle', 'wear', { cx: 0.13, cy: -0.06, r: 0.088 }], ['path', 'wear', { d: 'M-0.042 -0.07Q0 -0.09 0.042 -0.07' }]] },
    { wear: [['ellipse', 'blush', { cx: -0.215, cy: 0.045, rx: 0.05, ry: 0.034 }], ['ellipse', 'blush', { cx: 0.215, cy: 0.045, rx: 0.05, ry: 0.034 }],
             ['path', 'wear thin', { d: 'M-0.17 -0.1L-0.205 -0.13M-0.14 -0.115L-0.15 -0.155M0.17 -0.1L0.205 -0.13M0.14 -0.115L0.15 -0.155' }]] },
    { wear: [['path', 'wear solid', { d: 'M0 0.27L-0.1 0.215V0.325ZM0 0.27L0.1 0.215V0.325Z' }], ['circle', 'wear solid', { cx: 0, cy: 0.27, r: 0.022 }]] },
    { wear: [['path', 'wear solid', { d: 'M0 0.035C-0.04 0 -0.11 0.01 -0.15 0.065C-0.1 0.08 -0.04 0.075 0 0.045C0.04 0.075 0.1 0.08 0.15 0.065C0.11 0.01 0.04 0 0 0.035Z' }]] },
    { idle: 'M-0.06 0.125H0.06', wear: [['path', 'wear', { d: 'M-0.2 -0.175L-0.08 -0.135M0.2 -0.175L0.08 -0.135' }]] },
    { still: true, eye: 0.036, eyeY: -0.045, idle: 'M-0.035 0.115Q0 0.13 0.035 0.115', wear: [['path', 'wear', { d: 'M-0.185 -0.078H-0.075M0.075 -0.078H0.185' }]] },
    { wear: [-0.24, -0.2, -0.22, 0.2, 0.24, 0.22].map(function (x, n) { return ['circle', 'wear solid', { cx: x, cy: n % 3 === 2 ? 0.07 : 0.03, r: 0.012 }]; }) },
    { eye: 0.062, idle: 'M-0.04 0.115Q0 0.14 0.04 0.115' },
    // the cool one: shades, and a smirk. Nothing to blink or look with behind them.
    { still: true, stare: true, idle: 'M-0.05 0.11Q0.03 0.15 0.08 0.09',
      wear: [['path', 'wear solid', { d: 'M-0.235 -0.115H-0.03L-0.05 -0.02Q-0.13 0.03 -0.21 -0.02ZM0.03 -0.115H0.235L0.21 -0.02Q0.13 0.03 0.05 -0.02Z' }], ['path', 'wear', { d: 'M-0.03 -0.1H0.03' }]] },
    // the gentleman: a monocle on a chain, and one raised eyebrow
    { idle: 'M-0.05 0.12H0.05',
      wear: [['circle', 'wear', { cx: 0.13, cy: -0.06, r: 0.095 }], ['path', 'wear thin', { d: 'M0.205 0Q0.255 0.1 0.2 0.21' }], ['path', 'wear', { d: 'M0.065 -0.185Q0.13 -0.22 0.195 -0.185' }]] },
    // the cat: whiskers, a nose, and a mouth like a w
    { idle: 'M-0.06 0.095Q-0.03 0.135 0 0.095Q0.03 0.135 0.06 0.095',
      wear: [['path', 'wear thin', { d: 'M-0.2 0.04L-0.27 0.02M-0.2 0.075L-0.27 0.085M0.2 0.04L0.27 0.02M0.2 0.075L0.27 0.085' }], ['path', 'wear solid', { d: 'M-0.024 0.03H0.024L0 0.058Z' }]] },
    // the cheeky one: tongue out
    { idle: 'M-0.08 0.09Q0 0.15 0.08 0.09', wear: [['path', 'tongue', { d: 'M-0.012 0.122V0.165A0.036 0.036 0 0 0 0.06 0.165V0.112Z' }]] },
    // the smitten one: hearts where the eyes would be
    { eye: 0.001, still: true, stare: true, idle: 'M-0.06 0.1Q0 0.16 0.06 0.1',
      wear: [-0.13, 0.13].map(function (x) {
        return ['path', 'heart', { d: 'M' + x + ' -0.005C' + (x - 0.1) + ' -0.075 ' + (x - 0.05) + ' -0.15 ' + x + ' -0.095C' + (x + 0.05) + ' -0.15 ' + (x + 0.1) + ' -0.075 ' + x + ' -0.005Z' }];
      }) },
    // the startled one: wide eyes, raised brows, a mouth like an o
    { eye: 0.056, eyeY: -0.065, idle: 'M-0.034 0.135A0.034 0.04 0 1 0 0.034 0.135A0.034 0.04 0 1 0 -0.034 0.135',
      wear: [['path', 'wear', { d: 'M-0.19 -0.18Q-0.13 -0.215 -0.07 -0.18M0.07 -0.18Q0.13 -0.215 0.19 -0.18' }]] },
    // the one that has been through it: a plaster, and a wobbly mouth
    { idle: 'M-0.07 0.12Q-0.035 0.09 0 0.12Q0.035 0.15 0.07 0.12',
      wear: [['rect', 'plaster', { x: 0.09, y: -0.215, width: 0.15, height: 0.062, rx: 0.031, transform: 'rotate(-18 0.165 -0.184)' }], ['path', 'wear thin', { d: 'M0.15 -0.2L0.16 -0.165M0.18 -0.21L0.19 -0.175' }]] },
    // the goofy one: two front teeth
    { idle: 'M-0.09 0.1Q0 0.14 0.09 0.1', wear: [['path', 'tooth', { d: 'M-0.034 0.118V0.168H0.034V0.118M0 0.122V0.168' }]] },
    // the pirate: a patch on a strap
    { idle: 'M-0.05 0.11Q0.03 0.15 0.08 0.09',
      wear: [['path', 'wear thin', { d: 'M-0.27 -0.16L-0.19 -0.1M-0.07 -0.09L0.27 -0.175' }], ['ellipse', 'wear solid', { cx: -0.13, cy: -0.055, rx: 0.078, ry: 0.068 }]] }
  ];
  var GIFT = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="6" y="17" width="28" height="19" rx="3" fill="#FF6B6B" stroke="#2B2140" stroke-width="2.5"/><rect x="4" y="11" width="32" height="8" rx="2.5" fill="#FF8FCB" stroke="#2B2140" stroke-width="2.5"/><rect x="17" y="11" width="6" height="25" fill="#FFC93C" stroke="#2B2140" stroke-width="2.5"/><path d="M20 11C16 3 8 5 11 10ZM20 11C24 3 32 5 29 10Z" fill="#FFC93C" stroke="#2B2140" stroke-width="2.5" stroke-linejoin="round"/></svg>';
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(id) { return document.getElementById(id); }
  function el(name, cls) { var e = document.createElementNS(NS, name); if (cls) e.setAttribute('class', cls); return e; }
  function pts(poly) { return poly.map(function (p) { return p[0].toFixed(4) + ',' + p[1].toFixed(4); }).join(' '); }
  // A polygon as a path with its corners rounded off by r.
  function rounded(poly, r) {
    var n = poly.length, d = '';
    for (var i = 0; i < n; i++) {
      var p = poly[i], a = poly[(i + n - 1) % n], b = poly[(i + 1) % n];
      var la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
      var s = Math.min(r, la / 2, lb / 2);
      d += (i ? 'L' : 'M') + (p[0] + (a[0] - p[0]) * s / la).toFixed(4) + ' ' + (p[1] + (a[1] - p[1]) * s / la).toFixed(4) +
           'Q' + p[0].toFixed(4) + ' ' + p[1].toFixed(4) + ' ' + (p[0] + (b[0] - p[0]) * s / lb).toFixed(4) + ' ' + (p[1] + (b[1] - p[1]) * s / lb).toFixed(4);
    }
    return d + 'Z';
  }
  // Pieces are drawn a few pixels smaller than they really are, so neighbours
  // that touch still show a sliver of table between them; collisions use the
  // true shape. Gap and corner rounding are in screen pixels, so they look the
  // same at any zoom.
  function drawn(type, px) {
    px = px || 1 / view.scale;
    return rounded(grown(G.makeContainer(G.SHAPES[type]), -2.6 * px), Math.min(6 * px, 0.12));
  }
  // The box's outline is drawn just outside the real walls, so a piece resting
  // against a wall shows the same sliver of gap as two pieces side by side.
  function binPath(px) { return rounded(grown(C, 3.4 * px), Math.min(9 * px, 0.16)); }
  function grown(Cn, by) {
    var w = Cn.walls, n = w.length, out = [];
    for (var k = 0; k < n; k++) {
      var a = w[(k + n - 1) % n], b = w[k], da = a.d + by, db = b.d + by, det = a.nx * b.ny - a.ny * b.nx;
      out.push([(da * b.ny - a.ny * db) / det, (a.nx * db - da * b.nx) / det]);
    }
    return out;
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function norm(a) { return ((a % 360) + 360) % 360; }
  // A level opens once the one before it is packed. Anything already packed
  // stays open, and the bonus levels are never locked.
  function unlocked(n) { return n === 0 || !!LEVELS[n].bonus || !!save.done[LEVELS[n].name] || !!save.done[LEVELS[n - 1].name]; }
  function label(n) { return n < MAIN ? 'Level ' + (n + 1) : 'Bonus ' + (n - MAIN + 1); }
  function clock(sec) { sec = Math.round(sec); return Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2); }
  function shuffled(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  var board = $('board'), stage = $('stage'), layer = $('pieces'), bin = $('bin'), handle = $('handle'),
      bubble = $('bubble'), dock = $('dock'), ang = $('ang');

  var save = { v: 3, done: {}, last: '', mute: false, seen: false };
  // progress saved back when the game was called Packer carries over
  try { var raw = JSON.parse(localStorage.getItem(STORE) || localStorage.getItem('packer.v1')); if (raw && raw.done) save = raw; } catch (e) {}
  // Progress used to be kept by level number: ten levels at first, then
  // thirteen. It is kept by name now, so levels can be added and reordered.
  if (save.v !== 3) {
    var old = ['Four Square', 'Flip', 'Honeycomb', 'Home', 'Tilt', 'Five Alive', 'Dozen'].concat(
      save.v === 2 ? ['Lantern', 'Squeeze', 'Diamond'] : [], ['Ten Tight', 'Eleven', 'Seventeen']), kept = {};
    Object.keys(save.done).forEach(function (k) { if (old[k]) kept[old[k]] = save.done[k]; });
    save.done = kept;
    save.last = old[save.last] || '';
    if (save.board) save.board.l = old[save.board.l];
    save.v = 3;
  }
  // Each browser is one player on the leaderboard. The id never shows; the block and the stand-in name come from it.
  if (!save.pid) {
    save.pid = window.crypto && crypto.randomUUID ? crypto.randomUUID()
      : 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
  }
  var wiped = false;   // set by the hard reset, so nothing is written back before the page reloads
  function persist() { if (wiped) return; try { localStorage.setItem(STORE, JSON.stringify(save)); } catch (e) {} }

  var level = 0, lv, C, cb;            // current level, its container, the container's bounds
  var pieces = [], sel = -1, drag = null, won = false;
  var view = { x: 0, y: 0, w: 10, h: 10, scale: 50, land: true };
  var moves = 0, t0 = 0, elapsed = 0, carried = 0, ticker = 0;
  var shakeTimer = 0, shaking = false;
  var syms = [], ghost = null;         // the ways the box maps onto itself, and the spot a hint is pointing at
  var STUCK = 150, stuck = false;      // seconds on one level before the hint button lights up

  /* ---------- sound ---------- */

  var actx = null;
  // Browsers put the sound to sleep whenever they like: after a spell in
  // another tab, a phone call, the screen locking (Safari calls that state
  // "interrupted", not "suspended"). It can only be woken from a tap or a key
  // press, so every one of those tries, and a context that will not wake is replaced.
  function wake() {
    if (save.mute) return;
    if (actx && actx.state === 'closed') actx = null;
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) try { actx = new AC(); } catch (e) {}
      return;
    }
    if (actx.state === 'running') return;
    var stale = actx, r;
    try { r = stale.resume(); } catch (e) { actx = null; return; }
    if (r && r.catch) r.catch(function () { if (actx === stale) { try { stale.close(); } catch (e) {} actx = null; } });
  }
  ['pointerdown', 'touchend', 'keydown'].forEach(function (n) { document.addEventListener(n, wake, true); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && actx) wake(); });
  function tone(freq, dur, opts) {
    if (save.mute || !actx) return;
    if (actx.state !== 'running') { wake(); return; }   // asleep: a note queued now would only blurt out late
    opts = opts || {};
    var t = actx.currentTime + (opts.at || 0), o = actx.createOscillator(), g = actx.createGain();
    o.type = opts.type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.vol || 0.12, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  var sfx = {
    pick: function () { tone(520, 0.07, { to: 700, vol: 0.07 }); },
    drop: function () { tone(210, 0.11, { to: 120, vol: 0.14 }); },
    fit: function () { tone(660, 0.09, { vol: 0.1 }); tone(990, 0.14, { at: 0.07, vol: 0.1 }); },
    bad: function () { tone(160, 0.12, { type: 'triangle', to: 110, vol: 0.1 }); },
    snap: function () { tone(880, 0.05, { type: 'triangle', to: 1320, vol: 0.06 }); },
    rattle: function () { for (var k = 0; k < 7; k++) tone(260 + Math.random() * 260, 0.04, { at: k * 0.085, type: 'square', vol: 0.045 }); },
    tick: function () { tone(1250, 0.025, { type: 'triangle', vol: 0.035 }); },
    best: function () { tone(1568, 0.16, { at: 0.5, type: 'triangle', vol: 0.11 }); tone(2093, 0.3, { at: 0.62, type: 'triangle', vol: 0.11 }); },
    pop: function () { tone(320 + Math.random() * 240, 0.09, { type: 'square', to: 70, vol: 0.05 }); tone(1500 + Math.random() * 900, 0.12, { at: 0.05, type: 'triangle', vol: 0.05 }); },
    fanfare: function () {
      [[523, 0], [523, 0.14], [523, 0.28], [698, 0.42], [880, 0.7], [784, 0.98], [1047, 1.12]].forEach(function (n, i) {
        tone(n[0], i === 6 ? 0.7 : 0.2, { at: n[1], type: 'triangle', vol: 0.14 });
        tone(n[0] / 2, i === 6 ? 0.7 : 0.2, { at: n[1], vol: 0.08 });
      });
    },
    win: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, 0.22, { at: i * 0.09, type: 'triangle', vol: 0.13 }); }); }
  };
  // A tiny tap under the finger. Android has the Vibration API; iPhones have
  // none, but Safari (iOS 18+) gives a haptic tick when a switch-style
  // checkbox toggles, so a hidden one is flipped instead. Touch screens only.
  var touchy = window.matchMedia && matchMedia('(pointer: coarse)').matches, tapper = null, lastTap = 0;
  function haptic() {
    var n = performance.now();
    if (!touchy || n - lastTap < 40) return;
    lastTap = n;
    if (navigator.vibrate) { try { navigator.vibrate(10); } catch (e) {} return; }
    if (!tapper) {
      tapper = document.createElement('label');
      tapper.setAttribute('aria-hidden', 'true');
      tapper.style.cssText = 'position:fixed;left:-99px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden';
      var box = document.createElement('input');
      box.type = 'checkbox'; box.setAttribute('switch', ''); box.tabIndex = -1;
      tapper.appendChild(box); document.body.appendChild(tapper);
    }
    tapper.click();
  }

  var lastTick = 0;
  function tick() { var n = performance.now(); if (n - lastTick > 28) { lastTick = n; sfx.tick(); } }

  /* ---------- board layout ---------- */

  // Fit the container plus a tray for loose pieces into the stage. Wide screens
  // get a tray on each side of the box; tall ones get a tray underneath.
  function layout() {
    var W = stage.clientWidth, Hp = stage.clientHeight;
    if (!W || !Hp || !lv) return;
    var cw = cb.maxX - cb.minX, ch = cb.maxY - cb.minY, n = pieces.length;
    var pad = 0.45, room = n * (n > 9 ? 1.05 : 1.6), vw, vh;
    view.land = W / Hp > 1.05;
    if (view.land) {
      vh = Math.max(ch + 2 * pad, 4.4);
      vw = cw + 2 * pad + 2 * Math.max(1.7, room / (2 * (vh - 0.6)));
      if (vw / vh < W / Hp) vw = vh * W / Hp; else vh = vw * Hp / W;
      view.x = (cb.minX + cb.maxX) / 2 - vw / 2;
      view.y = (cb.minY + cb.maxY) / 2 - vh / 2;
    } else {
      // On a phone the box should be as big as it can be, so the tray stays a
      // shallow strip and the loose pieces are allowed to pile up in it.
      pad = 0.3;
      vw = Math.max(cw + 2 * pad, 3.4);
      vh = ch + 2 * pad + clamp(room / (vw - 0.6), 1.9, 2.3);
      if (vw / vh < W / Hp) vw = vh * W / Hp; else vh = vw * Hp / W;
      view.x = (cb.minX + cb.maxX) / 2 - vw / 2;
      view.y = cb.minY - pad;
    }
    view.w = vw; view.h = vh; view.scale = W / vw;
    board.setAttribute('viewBox', view.x + ' ' + view.y + ' ' + vw + ' ' + vh);
    var px = 1 / view.scale;
    board.style.setProperty('--u', px);   // one screen pixel, in board units, for stroke widths
    bin.firstElementChild.setAttribute('d', binPath(px));
    // for eyesight: the strip between the wall as drawn and the wall as judged, and the hatching, five pixels a stripe
    var loop = function (poly) { return 'M' + poly.map(function (v) { return v[0].toFixed(4) + ' ' + v[1].toFixed(4); }).join('L') + 'Z'; };
    $('wall-safe').setAttribute('d', loop(grown(C, 1.4 * px)) + loop(C.poly));
    ['hatch', 'hatch-wash', 'hatch-stripe'].forEach(function (id) { $(id).setAttribute('width', 5 * px); $(id).setAttribute('height', (id === 'hatch-stripe' ? 1.8 : 5) * px); });
    pieces.forEach(function (p) { if (p.fill) outline(p); });
    if (ghost) $('ghost').setAttribute('d', drawn(ghost.type));
    $('knob').setAttribute('r', 11 * px);
    $('knob-hit').setAttribute('r', 22 * px);
    $('knob-dot').setAttribute('r', 4 * px);
    for (var i = 0; i < pieces.length; i++) { keepInView(pieces[i]); if (pieces[i].el) render(i); }
    placeHandle();
    if (coachOn) seatCoach();
  }

  function keepInView(p) {
    p.x = clamp(p.x, view.x + 0.4, view.x + view.w - 0.4);
    p.y = clamp(p.y, view.y + 0.4, view.y + view.h - 0.4);
  }

  // Deal the pieces out around the box.
  function scatter() {
    var m = view.land ? 0.85 : 0.7, gap = view.land ? 0.85 : 0.75, zones = [];
    if (view.land) {
      zones.push([view.x + m, view.y + m, cb.minX - gap, view.y + view.h - m]);
      zones.push([cb.maxX + gap, view.y + m, view.x + view.w - m, view.y + view.h - m]);
    } else {
      zones.push([view.x + m, cb.maxY + gap, view.x + view.w - m, view.y + view.h - m]);
    }
    var cell = 1.3, slots = [];
    while (cell > 0.3) {
      slots = [];
      zones.forEach(function (z) {
        var w = Math.max(z[2] - z[0], 0), h = Math.max(z[3] - z[1], 0);
        var cols = Math.floor(w / cell) + 1, rows = Math.floor(h / cell) + 1;
        for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
          slots.push([z[0] + (cols > 1 ? c * w / (cols - 1) : w / 2), z[1] + (rows > 1 ? r * h / (rows - 1) : h / 2)]);
        }
      });
      if (slots.length >= pieces.length) break;
      cell *= 0.85;
    }
    slots = shuffled(slots);
    pieces.forEach(function (p, i) {
      var s = slots[i % slots.length], j = Math.min(0.12, cell / 8);
      p.x = s[0] + (Math.random() - 0.5) * j;
      p.y = s[1] + (Math.random() - 0.5) * j;
      p.angle = lv.scramble ? 15 * Math.floor(Math.random() * (p.type === 'triangle' ? 24 : TURN[p.type] / 15)) : 0;
      keepInView(p);
    });
  }

  /* ---------- drawing ---------- */

  function buildPiece(p, i) {
    var g = el('g', 'piece fresh'), pop = el('g', 'pop'), body = el('g', 'body'), fill = el('path', 'fill'), face = el('g', 'face');
    g.dataset.i = i;
    g.style.setProperty('--c', p.color);
    g.style.setProperty('--d', (60 + i * 28) + 'ms');
    var kit = p.kit || OUTFITS[0];
    if (p.type === 'triangle') face.setAttribute('transform', 'translate(0 0.03) scale(0.74)');
    if (p.type === 'hexagon') face.setAttribute('transform', 'scale(1.3)');
    var eyes = el('g', 'eyes');
    [-0.13, 0.13].forEach(function (x) {
      var e = el('circle', 'eye');
      e.setAttribute('cx', x); e.setAttribute('cy', kit.eyeY || -0.06); e.setAttribute('r', kit.eye || 0.048);
      e.setAttribute('data-x', x); e.setAttribute('data-y', kit.eyeY || -0.06);
      eyes.appendChild(e);
    });
    var shut = el('path', 'shut');
    shut.setAttribute('d', 'M-0.18 -0.06H-0.08M0.08 -0.06H0.18');
    eyes.appendChild(shut);
    var wince = el('path', 'wince');   // screwed-up eyes, for when it is squashed
    wince.setAttribute('d', 'M-0.18 -0.11L-0.09 -0.06L-0.18 -0.01M0.18 -0.11L0.09 -0.06L0.18 -0.01');
    eyes.appendChild(wince);
    face.appendChild(eyes);
    var idle = el('path', 'mouth m-idle'), good = el('path', 'mouth m-good'), bad = el('circle', 'mouth m-bad');
    idle.setAttribute('d', kit.idle || 'M-0.07 0.1 Q0 0.15 0.07 0.1');
    good.setAttribute('d', 'M-0.12 0.07 Q0 0.24 0.12 0.07');
    bad.setAttribute('cx', 0); bad.setAttribute('cy', 0.13); bad.setAttribute('r', 0.045);
    face.appendChild(idle); face.appendChild(good); face.appendChild(bad);
    (kit.wear || []).forEach(function (w) {
      var e = el(w[0], w[1]);
      for (var k in w[2]) e.setAttribute(k, w[2][k]);
      face.appendChild(e);
    });
    // A patch of the piece's own colour lies behind the face. Safari repaints
    // only part of a face that changes; redrawing this patch along with it
    // makes the whole face get painted, over colour and never over a gap.
    var back = el('rect', 'back'), k = p.type === 'triangle' ? 0.74 : p.type === 'hexagon' ? 1.3 : 1, dy = p.type === 'triangle' ? 0.03 : 0;
    back.setAttribute('x', -0.28 * k); back.setAttribute('y', -0.21 * k + dy);
    back.setAttribute('width', 0.56 * k); back.setAttribute('height', (p.type === 'triangle' ? 0.45 : 0.54) * k);   // short of a triangle's base
    // Under the shape lies its true outline, hatched. It is all that shows of a shape
    // while eyesight is on.
    var safe = el('path', 'safe');
    safe.setAttribute('d', 'M' + G.SHAPES[p.type].map(function (v) { return v[0] + ' ' + v[1]; }).join('L') + 'Z');
    body.appendChild(safe); body.appendChild(fill); body.appendChild(back); body.appendChild(face);
    pop.appendChild(body); g.appendChild(pop);
    p.back = back;
    p.el = g; p.pop = pop; p.body = body; p.fill = fill; p.eyes = eyes; p.tf = p.rot = p.look = '';
    outline(p);
    layer.appendChild(g);
    setTimeout(function () { g.classList.remove('fresh'); }, 620 + i * 28);
  }

  function repaint(p) {
    if (!p.back) return;
    p.flip = !p.flip;
    p.back.setAttribute('rx', p.flip ? 0.0001 : 0);
  }

  function outline(p) {
    var d = drawn(p.type);
    p.fill.setAttribute('d', d);
  }

  // Pieces are moved with transform attributes, not CSS transforms: Safari
  // repaints the wrong patch of a piece whose parents are moved by CSS.
  function render(i) {
    var p = pieces[i], tf = 'translate(' + p.x.toFixed(4) + ' ' + p.y.toFixed(4) + ')', rot = 'rotate(' + p.angle + ')';
    if (tf === p.tf && rot === p.rot) return;
    if (rot !== p.rot) p.body.setAttribute('transform', rot);
    if (tf !== p.tf) p.el.setAttribute('transform', tf);
    p.tf = tf; p.rot = rot;
  }

  function knobPos(p) {
    var r = (p.angle - 90) * Math.PI / 180, reach = KNOB[p.type] + 30 / view.scale;
    return [p.x + Math.cos(r) * reach, p.y + Math.sin(r) * reach];
  }

  function placeHandle() {
    var show = sel >= 0 && !won && !(drag && drag.mode === 'move');
    handle.toggleAttribute('hidden', !show);
    if (!show) { bubble.classList.remove('show'); return; }
    var p = pieces[sel], k = knobPos(p), line = handle.firstElementChild;
    line.setAttribute('x1', p.x); line.setAttribute('y1', p.y); line.setAttribute('x2', k[0]); line.setAttribute('y2', k[1]);
    ['knob', 'knob-hit', 'knob-dot'].forEach(function (id) { $(id).setAttribute('cx', k[0]); $(id).setAttribute('cy', k[1]); });
    if (drag && drag.mode !== 'move') {
      bubble.textContent = norm(p.angle) + '°';
      var bx = (k[0] - view.x) * view.scale, by = (k[1] - view.y) * view.scale;
      bubble.style.transform = 'translate(' + (bx - bubble.offsetWidth / 2) + 'px,' + Math.max(by - 54, 0) + 'px)';
    }
  }

  function showAngle() {
    dock.classList.toggle('idle', sel < 0 || won);
    if (sel >= 0 && document.activeElement !== ang) ang.value = norm(pieces[sel].angle);
  }

  /* ---------- judging ---------- */

  function judge() {
    var ev = G.evaluate(pieces, C), pips = $('pips').children, fitted = false;
    pieces.forEach(function (p, i) {
      var s = ev.states[i];
      p.el.classList.toggle('good', s.good);
      p.el.classList.toggle('bad', s.zone === 'edge' || s.hit);
      repaint(p);
      if (s.good && !p.good) {
        fitted = true;
      }
      p.good = s.good;
    });
    for (var k = 0; k < pips.length; k++) pips[k].classList.toggle('on', k < ev.packed);
    $('count').textContent = ev.packed + ' of ' + pieces.length + ' packed';
    if (level === MAIN - 1) {
      var along = ev.packed / pieces.length * 100, track = $('prize-track');
      $('rail-fill').style.width = along + '%'; $('rail-run').style.setProperty('--at', along / 100);
      track.classList.toggle('near', ev.packed >= pieces.length - 3 && !ev.solved);
      track.classList.toggle('won', !!ev.solved);
    }
    ev.fitted = fitted;
    showHits();
    return ev;
  }

  // A move is one piece picked up, shifted and turned as much as you like, and
  // let go of: it is counted when the piece is put down or another is picked up.
  var dirty = false;
  function countMove() { if (dirty) { moves++; dirty = false; } }

  // After a piece has been shifted or turned: make the right noise, maybe win.
  function commit(quiet) {
    seatGhost();
    var ev = judge();
    dirty = true;
    if (ev.solved) { win(); return; }
    lookForShake();
    saveBoard();
    if (quiet) return;
    if (ev.fitted) sfx.fit(); else if (sel >= 0 && pieces[sel].el.classList.contains('bad')) sfx.bad(); else sfx.drop();
  }

  function saveBoard() {
    save.board = {
      l: lv.name, m: moves, t: t0 ? Math.round((performance.now() - t0) / 1000) : carried,
      p: pieces.map(function (p) { return [+p.x.toFixed(4), +p.y.toFixed(4), p.angle]; })
    };
    persist();
  }

  function snapshot() { return pieces.map(function (p) { return [p.x, p.y, p.angle]; }); }

  function startClock() {
    if (t0 || won) return;
    t0 = performance.now() - carried * 1000;
    ticker = setInterval(function () { $('clock').textContent = clock((performance.now() - t0) / 1000); nag(); }, 500);
  }

  // Two and a half minutes into a level, the hint button lights up.
  function nag() {
    if (stuck || won || (t0 ? (performance.now() - t0) / 1000 : carried) < STUCK) return;
    stuck = true;
    $('b-hint').classList.add('nag');
  }

  /* ---------- selecting, moving, spinning ---------- */

  function select(i) {
    if (i !== sel) countMove();
    if (sel >= 0 && pieces[sel]) { pieces[sel].el.classList.remove('sel'); }
    sel = i;
    if (i >= 0) { pieces[i].el.classList.add('sel'); layer.appendChild(pieces[i].el); }
    showAngle(); placeHandle();
  }

  function spin(i, by) {
    if (!by || won) return;
    var p = pieces[i];
    startClock();
    p.angle += by;
    clearTimeout(shakeTimer);
    G.settle(pieces, i, C);
    render(i); placeHandle(); showAngle(); tick();
    if (norm(p.angle) % 15 === 0) haptic();
  }
  function spinTo(i, deg) { spin(i, ((deg - pieces[i].angle) % 360 + 540) % 360 - 180); }

  // The knob has a sticky notch every 15 degrees: each multiple of 15 owns 4
  // degrees of knob travel, and the 14 angles in between share the rest, so
  // every whole degree is still reachable.
  function notched(deg) {
    var base = Math.floor(deg / 15) * 15, f = deg - base;
    if (f < 2) return base;
    if (f > 13) return base + 15;
    return base + 1 + Math.min(13, Math.floor((f - 2) / 11 * 14));
  }

  function world(e) {
    var r = board.getBoundingClientRect();
    return { x: view.x + (e.clientX - r.left) / view.scale, y: view.y + (e.clientY - r.top) / view.scale };
  }

  // Two fingers on the board turn the selected shape, wherever they land: the
  // shapes are too small on a phone to fit two fingertips on one.
  var fingers = {}, blank = null;
  function fingerAngle(a, b) {
    return Math.atan2(fingers[b].y - fingers[a].y, fingers[b].x - fingers[a].x) * 180 / Math.PI;
  }

  function twist(e) {
    var a = drag ? drag.id : blank;
    if (e.pointerType !== 'touch' || (drag && drag.mode !== 'move') || a === e.pointerId || !fingers[a] || sel < 0) return;
    if (frame) { cancelAnimationFrame(frame); moveTo(); }
    var p = pieces[sel];
    p.el.classList.remove('held');
    drag = { mode: 'twist', touch: true, id: a, id2: e.pointerId, from: drag ? drag.a0 : p.angle, a0: p.angle, last: fingerAngle(a, e.pointerId), turn: 0, moved: !!(drag && drag.moved) };
    blank = null;
    handle.classList.add('spin'); bubble.classList.add('show');
    placeHandle();
    try { board.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  }

  board.addEventListener('pointerdown', function (e) {
    if (won || shaking || e.button > 0) return;
    if (e.pointerType === 'touch') {
      if (!drag && blank === null) fingers = {};
      fingers[e.pointerId] = { x: e.clientX, y: e.clientY };
    }
    if (drag || blank !== null) { twist(e); return; }
    wake();
    if (document.activeElement === ang) ang.blur();
    var w = world(e), t = e.target, pe = t.closest ? t.closest('.piece') : null;
    if ((t.id === 'knob' || t.id === 'knob-hit') && sel >= 0) {
      drag = { mode: 'spin', touch: e.pointerType === 'touch', id: e.pointerId, from: pieces[sel].angle };
      handle.classList.add('spin'); bubble.classList.add('show');
      placeHandle();
    } else if (pe) {
      var i = +pe.dataset.i, p = pieces[i];
      select(i);
      drag = { mode: 'move', touch: e.pointerType === 'touch', id: e.pointerId, i: i, ox: p.x - w.x, oy: p.y - w.y, sx: e.clientX, sy: e.clientY, moved: false, a0: p.angle, stuck: false };
      p.el.classList.add('held');
      placeHandle(); sfx.pick();
    } else if (e.pointerType === 'touch' && sel >= 0) {
      blank = e.pointerId;   // a second finger may be on its way; deselect on lift instead
    } else { select(-1); return; }
    try { board.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });

  // Pointer moves can arrive faster than the screen redraws; only the latest
  // one per frame is worth working out.
  var pending = null, frame = 0;
  board.addEventListener('pointermove', function (e) {
    var f = fingers[e.pointerId];
    if (f) { f.x = e.clientX; f.y = e.clientY; }
    if (!drag || (e.pointerId !== drag.id && e.pointerId !== drag.id2)) return;
    pending = { clientX: e.clientX, clientY: e.clientY };
    if (!frame) frame = requestAnimationFrame(moveTo);
  });

  function moveTo() {
    frame = 0;
    var e = pending; pending = null;
    if (!e || !drag) return;
    var w = world(e), p;
    if (drag.mode === 'twist') {
      var a = fingerAngle(drag.id, drag.id2);
      drag.turn += ((a - drag.last) % 360 + 540) % 360 - 180; drag.last = a;
      spinTo(sel, notched(drag.a0 + drag.turn));
      judge();
      return;
    }
    if (drag.mode === 'spin') {
      p = pieces[sel];
      spinTo(sel, notched(Math.atan2(w.y - p.y, w.x - p.x) * 180 / Math.PI + 90));
      judge();
      return;
    }
    if (!drag.moved && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 4) return;
    if (!drag.moved) clearTimeout(shakeTimer);   // the board is changing now
    drag.moved = true; startClock();
    p = pieces[drag.i];
    // Only the dragged piece moves, and what you see while dragging is exactly
    // what you get when you let go.
    p.x = w.x + drag.ox; p.y = w.y + drag.oy; p.angle = drag.a0;
    keepInView(p);
    var stuck = G.place(pieces, drag.i, C) === 'snap';
    if (intoGhost(drag.i)) stuck = true;
    if (stuck && !drag.stuck) { sfx.snap(); haptic(); }
    drag.stuck = stuck;
    render(drag.i);
    judge(); showAngle();
  }

  function release(e) {
    delete fingers[e.pointerId];
    if (e.pointerType === 'touch') watch(null);
    if (blank === e.pointerId) { blank = null; select(-1); return; }
    if (!drag || (e.pointerId !== drag.id && e.pointerId !== drag.id2)) return;
    if (frame) { cancelAnimationFrame(frame); if (drag.mode === 'twist') { frame = 0; pending = null; } else moveTo(); }
    var d = drag; drag = null;
    try { board.releasePointerCapture(e.pointerId); } catch (err) {}
    if (d.mode !== 'move') {
      handle.classList.remove('spin'); bubble.classList.remove('show');
      if (pieces[sel].angle !== d.from || d.moved) commit(); else { placeHandle(); lookForShake(); }
      return;
    }
    var p = pieces[d.i];
    p.el.classList.remove('held');
    if (d.moved) commit(); else lookForShake();
    placeHandle();
  }
  board.addEventListener('pointerup', release);
  board.addEventListener('pointercancel', release);

  /* ---------- eyesight ---------- */

  // On the board every shape is drawn a hair small, with soft corners, and the box a hair
  // big, so a packed box looks neatly spaced. The eye button in the bar swaps that for what
  // the judging goes by: every shape as its true outline, hatched in violet and nothing
  // else, the box's true wall, and red wherever those outlines overlap or pass a wall.
  // Tap it again and the board goes back to how it looks.
  var eyeOn = false;

  // what is left of a convex outline on one side of a line: inside (n.p <= d) or outside it
  function cut(poly, w, outside) {
    var out = [], n = poly.length, k = outside ? -1 : 1;
    for (var i = 0; i < n; i++) {
      var a = poly[i], b = poly[(i + 1) % n], da = k * (a[0] * w.nx + a[1] * w.ny - w.d), db = k * (b[0] * w.nx + b[1] * w.ny - w.d);
      if (da <= 0) out.push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) { var t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
  }
  function area(poly) {
    var sum = 0;
    for (var i = 0; i < poly.length; i++) { var a = poly[i], b = poly[(i + 1) % poly.length]; sum += a[0] * b[1] - b[0] * a[1]; }
    return Math.abs(sum) / 2;
  }
  // Under eyesight, wherever two true outlines overlap, or one passes a wall, is filled red:
  // in a layer over the shapes.
  function showHits() {
    var hits = $('hits');
    hits.textContent = '';
    if (!eyeOn) return;
    var V = pieces.map(G.verts), inPlay = V.map(function (A) { return G.zone(A, C) !== 'out'; });
    function red(poly) {
      if (poly.length < 3 || area(poly) < 1e-6) return;
      var e = el('polygon', 'hit');
      e.setAttribute('points', pts(poly));
      hits.appendChild(e);
    }
    V.forEach(function (A, i) {
      if (!inPlay[i]) return;
      C.walls.forEach(function (w) { red(cut(A, w, true)); });
      for (var j = i + 1; j < V.length; j++) {
        if (inPlay[j]) red(G.makeContainer(V[j]).walls.reduce(function (rest, w) { return rest.length > 2 ? cut(rest, w) : rest; }, A));
      }
    });
  }
  function eye(on) {
    eyeOn = on;
    board.classList.toggle('eyes', on);
    $('b-eye').setAttribute('aria-pressed', on);
    showHits();
  }
  $('b-eye').addEventListener('click', function () {
    if (coachOn) { coach(false); save.eyeTip = 1; persist(); eye(true); return; }   // the one way out of the introduction
    if (level === 1) return;   // the second level is played with it on, and it cannot be put away there
    eye(!eyeOn);
  });

  // The second level is where eyesight is learnt. The first time, everything dims but its
  // button and a note under it says what it is for; there is no closing that, and pressing
  // the button is the way on. The level is then played with eyesight on, every time, and
  // the button will not turn it off. The level after starts with it off again.
  var coachOn = false, coachTimer = 0;
  function seatCoach() {
    var r = $('b-eye').getBoundingClientRect(), pad = 5, c = $('coach'), spot = c.querySelector('.spot'), say = $('coach-say'), blk = c.querySelectorAll('.blk');
    var L = r.left - pad, T = r.top - pad, R = r.right + pad, B = r.bottom + pad, px = function (v) { return Math.round(v) + 'px'; };
    spot.style.cssText = 'left:' + px(L) + ';top:' + px(T) + ';width:' + px(R - L) + ';height:' + px(B - T) + ';border-radius:' + (parseFloat(getComputedStyle($('b-eye')).borderTopLeftRadius) + pad) + 'px';
    // four panes round the button swallow every tap that is not on it
    blk[0].style.cssText = 'left:0;top:0;right:0;height:' + px(T);
    blk[1].style.cssText = 'left:0;top:' + px(B) + ';right:0;bottom:0';
    blk[2].style.cssText = 'left:0;top:' + px(T) + ';width:' + px(L) + ';height:' + px(B - T);
    blk[3].style.cssText = 'left:' + px(R) + ';top:' + px(T) + ';right:0;height:' + px(B - T);
    var w = say.offsetWidth, mid = r.left + r.width / 2, left = clamp(mid - w / 2, 12, innerWidth - 12 - w);
    say.style.left = px(left); say.style.top = px(B + 14);
    say.style.setProperty('--ax', px(mid - left));
  }
  function coach(on) { coachOn = on; $('coach').hidden = !on; if (on) seatCoach(); }
  function offerEyes() {
    clearTimeout(coachTimer);
    if (level !== 1 || save.eyeTip || won) return;
    if (document.querySelector('.sheet.open')) { coachTimer = setTimeout(offerEyes, 500); return; }   // wait for whatever is up to be put away
    coach(true);
  }

  // Every face watches the pointer, and so whatever it is carrying. Only the
  // two dots move: nothing in a face is ever shifted as a group or taken out
  // of the page, because Safari then repaints the wrong patch of the piece.
  var gazeAt = null, gazeFrame = 0;
  function gaze() {
    gazeFrame = 0;
    var w = gazeAt && world(gazeAt);
    pieces.forEach(function (p) {
      var tf = '';
      if (w && !p.kit.still) {   // the sleepy one cannot be bothered to look
        var dx = w.x - p.x, dy = w.y - p.y, d = Math.hypot(dx, dy);
        if (d > 0.3) {
          var r = -p.angle * Math.PI / 180, k = Math.min(0.04, d * 0.03) / d;
          tf = ((dx * Math.cos(r) - dy * Math.sin(r)) * k).toFixed(3) + ' ' + ((dx * Math.sin(r) + dy * Math.cos(r)) * k).toFixed(3);
        }
      }
      if (tf === p.look || !p.eyes) return;
      p.look = tf;
      var by = tf ? tf.split(' ') : [0, 0];
      Array.prototype.forEach.call(p.eyes.querySelectorAll('.eye'), function (e) {
        e.setAttribute('cx', +e.getAttribute('data-x') + +by[0]); e.setAttribute('cy', +e.getAttribute('data-y') + +by[1]);
      });
      repaint(p);
    });
  }
  function watch(e) {
    if (calm) return;
    gazeAt = e && !won ? { clientX: e.clientX, clientY: e.clientY } : null;
    if (!gazeFrame) gazeFrame = requestAnimationFrame(gaze);
  }
  board.addEventListener('pointermove', watch);
  board.addEventListener('pointerleave', function () { watch(null); });

  var wheelAcc = 0;
  board.addEventListener('wheel', function (e) {
    e.preventDefault();
    if (won || drag) return;
    var pe = e.target.closest ? e.target.closest('.piece') : null;
    if (pe && +pe.dataset.i !== sel) select(+pe.dataset.i);
    if (sel < 0) return;
    wake();
    var d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    wheelAcc += clamp(d, -40, 40);
    var steps = wheelAcc > 0 ? Math.floor(wheelAcc / 40) : Math.ceil(wheelAcc / 40);
    if (!steps) return;
    wheelAcc -= steps * 40;
    spin(sel, steps * (e.shiftKey ? 15 : 1));
    commit(true);
  }, { passive: false });

  // Dock buttons: tap for one step, hold to keep turning.
  Array.prototype.forEach.call(dock.querySelectorAll('.rb'), function (b) {
    var by = +b.dataset.r, hold = 0, rep = 0;
    function go() { if (sel >= 0) { spin(sel, by); judge(); } }
    function stop() { if (hold || rep) { clearTimeout(hold); clearInterval(rep); hold = rep = 0; if (sel >= 0 && !won) commit(true); } }
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault(); wake(); go();
      hold = setTimeout(function () { rep = setInterval(go, 70); }, 380);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (n) { b.addEventListener(n, stop); });
    b.addEventListener('click', function (e) { if (e.detail === 0) { go(); commit(true); } });   // keyboard activation
  });

  function typed() {
    if (sel < 0 || ang.value === '') return;
    var v = Math.round(+ang.value);
    if (isNaN(v)) return;
    var before = pieces[sel].angle;
    spinTo(sel, norm(v));
    if (pieces[sel].angle !== before) commit(true);
  }
  ang.addEventListener('change', typed);
  ang.addEventListener('keydown', function (e) { if (e.key === 'Enter') ang.blur(); e.stopPropagation(); });
  ang.addEventListener('focus', function () { ang.select(); });

  document.addEventListener('keydown', function (e) {
    var open = document.querySelector('.sheet.open');
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { if (open) closeSheet(open); else select(-1); return; }
    if (open || won || shaking) return;
    var k = e.key.toLowerCase(), big = e.shiftKey;
    if (k === 'tab' && pieces.length) {
      e.preventDefault();
      select((sel + (big ? pieces.length - 1 : 1) + (sel < 0 && big ? 1 : 0)) % pieces.length);
      return;
    }
    if (sel < 0) return;
    var p = pieces[sel], step = big ? 0.1 : 0.01, dx = 0, dy = 0;
    if (k === 'q' || k === '[' || k === '{') { spin(sel, big ? -15 : -1); commit(true); }
    else if (k === 'e' || k === ']' || k === '}') { spin(sel, big ? 15 : 1); commit(true); }
    else if (k === 'arrowleft') dx = -step;
    else if (k === 'arrowright') dx = step;
    else if (k === 'arrowup') dy = -step;
    else if (k === 'arrowdown') dy = step;
    else return;
    e.preventDefault();
    if (dx || dy) {
      startClock();
      p.x += dx; p.y += dy; keepInView(p);
      G.settle(pieces, sel, C);
      render(sel); placeHandle(); commit(true);
    }
  });

  /* ---------- levels ---------- */

  // fresh: deal the pieces out again even if a half-packed board was saved.
  function startLevel(i, fresh) {
    level = i; lv = LEVELS[i];
    coach(false); clearTimeout(coachTimer);
    $('prize-track').hidden = level !== MAIN - 1;
    var was = save.done[lv.name];
    $('best').hidden = !was;
    if (was) $('best').textContent = 'Your best: ' + clock(was.t) + ' · ' + was.m + (was.m === 1 ? ' move' : ' moves');
    C = G.makeContainer(lv.container); cb = G.bounds(lv.container);
    clearTimeout(partyTimer); $('finale').classList.remove('show');
    $('go-next').hidden = true; dock.classList.remove('won');
    won = false; drag = null; sel = -1; dirty = false; moves = 0; t0 = 0; elapsed = 0; carried = 0;
    clearInterval(ticker);
    stuck = false; $('b-hint').classList.remove('nag');
    syms = symmetries(lv.container); showGhost(null);
    save.last = lv.name; persist();

    $('lv-word').textContent = lv.bonus ? 'Bonus' : 'Level';
    $('lv-num').textContent = lv.bonus ? i - MAIN + 1 : i + 1;
    $('lv-of').textContent = lv.bonus ? LEVELS.length - MAIN : MAIN;
    $('ribbon').setAttribute('hidden', '');
    $('lv-name').textContent = lv.name;
    $('lv-intro').textContent = lv.intro;
    $('clock').textContent = '0:00';
    var title = $('title');
    title.classList.remove('swap'); void title.offsetWidth; title.classList.add('swap');

    bin.setAttribute('class', '');
    bin.style.animation = 'none'; void bin.getBoundingClientRect(); bin.style.animation = '';

    layer.textContent = '';
    var colors = shuffled(COLORS), kits = shuffled(OUTFITS), pips = $('pips');
    pips.textContent = '';
    pieces = lv.pieces.map(function (type, n) {
      var pip = document.createElement('i');
      if (type !== 'square') pip.className = type.charAt(0);
      pips.appendChild(pip);
      return { type: type, size: 1, x: 0, y: 0, angle: 0, color: colors[n % colors.length], kit: kits[n % kits.length], good: false };
    });
    layout();
    var kept = save.board;
    if (!fresh && kept && kept.l === lv.name && kept.p && kept.p.length === pieces.length) {
      pieces.forEach(function (p, n) { p.x = kept.p[n][0]; p.y = kept.p[n][1]; p.angle = kept.p[n][2]; keepInView(p); });
      moves = kept.m || 0; carried = kept.t || 0;
      $('clock').textContent = clock(carried);
    } else scatter();
    pieces.forEach(function (p, n) { buildPiece(p, n); render(n); });
    judge(); showAngle(); placeHandle(); nag();
    lookForShake();
    if (i === 1 && !save.eyeTip) { eye(false); coachTimer = setTimeout(offerEyes, 900); }
    else eye(i === 1);   // on throughout the second level, off at the start of every other
    if (i === 1) $('b-eye').removeAttribute('data-tip'); else $('b-eye').setAttribute('data-tip', 'Eyesight');   // no label where it cannot be changed
  }

  /* ---------- shake ---------- */

  // After each move, quietly check whether a shake would finish the board
  // (every piece within a hair and a degree of a solved spot). If it would,
  // the box shakes itself.
  function lookForShake() {
    clearTimeout(shakeTimer);
    shakeTimer = setTimeout(function () {
      if (won || drag || shaking) return;
      var to = G.evaluate(pieces, C).solved ? null : G.shake(pieces, C, 150);
      if (to) shake(to);
    }, 220);
  }

  function shake(to) {
    if (shaking || won) return;
    var from = pieces.map(function (p) { return { x: p.x, y: p.y, a: p.angle }; }), t0s = performance.now();
    shaking = true; select(-1);
    wake(); sfx.rattle();
    if (navigator.vibrate && touchy) { try { navigator.vibrate([18, 50, 18, 50, 18, 50, 18]); } catch (e) {} } else haptic();
    (function frame(t) {
      var k = (t - t0s) / 650;
      if (k < 1) {
        // rattle the box and everything in it, dying down, while drifting home
        var amp = 0.07 * (1 - k), ease = k * k;
        bin.setAttribute('transform', 'translate(' + ((Math.random() - 0.5) * amp).toFixed(4) + ' ' + ((Math.random() - 0.5) * amp).toFixed(4) + ')');
        pieces.forEach(function (p, i) {
          p.x = from[i].x + (to[i].x - from[i].x) * ease + (Math.random() - 0.5) * amp;
          p.y = from[i].y + (to[i].y - from[i].y) * ease + (Math.random() - 0.5) * amp;
          render(i);
        });
        requestAnimationFrame(frame);
        return;
      }
      bin.removeAttribute('transform');
      pieces.forEach(function (p, i) { p.x = to[i].x; p.y = to[i].y; p.angle = to[i].angle; render(i); });
      shaking = false;
      commit();
    })(t0s);
  }
  /* ---------- one-spot hint ---------- */

  // Every turn and flip that lands the box back on itself. The stored solution
  // is as good in any of them, so the hint can follow whichever one the player
  // has started building.
  function symmetries(poly) {
    var out = [];
    [1, -1].forEach(function (m) {
      for (var r = 0; r < 360; r += 30) {
        var c = Math.cos(r * Math.PI / 180), s = Math.sin(r * Math.PI / 180);
        var fits = poly.every(function (p) {
          var x = m * p[0] * c - p[1] * s, y = m * p[0] * s + p[1] * c;
          return poly.some(function (q) { return Math.abs(q[0] - x) + Math.abs(q[1] - y) < 1e-6; });
        });
        if (fits) out.push({ m: m, r: r, c: c, s: s });
      }
    });
    return out;
  }
  // How far angle a is from b, given that a square looks the same every 90
  // degrees, a triangle every 120, and so on.
  function off(a, b, type) { var t = TURN[type]; return ((a - b) % t + t * 1.5) % t - t / 2; }
  function near(p, s, reach, turn) {
    return p.type === s.type && Math.hypot(p.x - s.x, p.y - s.y) <= reach && Math.abs(off(s.angle, p.angle, p.type)) <= turn;
  }

  // An empty spot from the solution, for one piece that is not packed yet.
  function pickSpot() {
    var best = null;
    syms.forEach(function (t) {
      var slots = lv.solution.map(function (s, i) {
        return { type: lv.pieces[i], x: t.m * s[0] * t.c - s[1] * t.s, y: t.m * s[0] * t.s + s[1] * t.c, angle: norm(t.m * s[2] + t.r) };
      });
      var open = slots.filter(function (s) { return !pieces.some(function (p) { return p.good && near(p, s, 0.15, 3); }); });
      if (!best || open.length < best.length) best = open;
    });
    var packed = pieces.filter(function (p) { return p.good; }).map(G.verts);
    var clear = best.filter(function (s) {
      var V = G.verts(s);
      return !packed.some(function (B) { var o = G.overlap(V, B); return o && o.depth > G.EPS; });
    });
    return clear[0] || best[0] || null;
  }
  function showGhost(s) {
    var e = $('ghost');
    ghost = s;
    e.toggleAttribute('hidden', !s);
    if (!s) return;
    e.setAttribute('d', drawn(s.type));
    e.setAttribute('transform', 'translate(' + s.x.toFixed(4) + ' ' + s.y.toFixed(4) + ') rotate(' + s.angle + ')');
  }
  // The hinted spot pulls the right kind of piece into it: carried anywhere
  // near, at anything like the right angle, the piece jumps exactly into place.
  function intoGhost(i) {
    var p = pieces[i];
    if (!ghost || !near(p, ghost, 0.34, 25)) return false;
    var x = p.x, y = p.y, a = p.angle;
    p.x = ghost.x; p.y = ghost.y; p.angle += off(ghost.angle, p.angle, p.type);
    if (G.evaluate(pieces, C).states[i].good) return true;
    p.x = x; p.y = y; p.angle = a;
    return false;
  }
  // The hint stays up until a piece is sitting exactly in it. One lying over
  // it crooked, or a little to one side, does not count.
  function seatGhost() {
    if (!ghost) return;
    if (sel >= 0 && intoGhost(sel)) { render(sel); showAngle(); placeHandle(); }
    var ev = G.evaluate(pieces, C);
    if (pieces.some(function (p, i) { return ev.states[i].good && near(p, ghost, 0.004, 0.5); })) showGhost(null);
  }

  function win() {
    won = true;
    countMove();
    clearTimeout(shakeTimer);
    $('b-hint').classList.remove('nag');
    showGhost(null); watch(null);
    clearInterval(ticker);
    elapsed = t0 ? (performance.now() - t0) / 1000 : 0;
    $('clock').textContent = clock(elapsed);
    var prev = save.done[lv.name], best = prev ? Math.min(prev.t, elapsed) : elapsed;
    var again = !!prev, faster = again && Math.round(elapsed) < Math.round(prev.t);
    save.done[lv.name] = { t: best, m: prev ? Math.min(prev.m, moves) : moves };
    if (save.board && save.board.l === lv.name) save.board = null;
    persist();
    report({ level: lv.name, pid: save.pid, name: called(), t: elapsed, m: moves, p: pieces.map(function (q) { return [q.x, q.y, q.angle]; }) });

    // A first win gets the full party. A replay gets a quieter one, unless it
    // beat the old time.
    select(-1);
    bin.setAttribute('class', 'win');
    sfx.win();
    if (faster) sfx.best();
    cheer();
    var finale = level === MAIN - 1 && !again;
    confetti(finale ? 320 : again && !faster ? 50 : 150);
    setTimeout(function () { if (won) tieRibbon(); }, calm ? 0 : 550);

    var all = LEVELS.every(function (l) { return l.bonus || save.done[l.name]; }), total = { t: 0, m: 0 };
    if (all) LEVELS.forEach(function (l) { if (!l.bonus) { total.t += save.done[l.name].t; total.m += save.done[l.name].m; } });
    var sum = all ? 'All seventeen: ' + clock(total.t) + ' · ' + total.m + ' moves' : 'Every box, packed.';
    $('finale-sum').textContent = sum;
    if (finale) party();
    $('win-all').hidden = !(all && level === MAIN - 1); $('win-one').hidden = !$('win-all').hidden;   // the last win shows the totals alone
    $('win-prize').hidden = !(PRIZE && all && level === MAIN - 1);
    $('all-time').textContent = clock(total.t);
    $('all-moves').textContent = total.m;
    $('win-title').textContent = finale ? 'Seventeen!' : faster ? 'New best!' : PRAISE[Math.floor(Math.random() * PRAISE.length)];
    $('win-sub').textContent = finale
      ? (all ? 'That was the hard one, and that makes all seventeen. Take a bow.' : 'That was the hard one. Take a bow.')
      : faster ? lv.name + ', packed ' + clock(prev.t - elapsed) + ' faster than your best.'
      : again ? lv.name + ', packed again. Your best is still ' + clock(prev.t) + '.'
      : label(level) + ', ' + lv.name + ', is all packed up.';
    $('win-best').parentNode.classList.toggle('new', faster);
    $('win-time').textContent = clock(elapsed);
    $('win-moves').textContent = moves;
    $('win-best').textContent = clock(best);
    $('win-fact').hidden = !lv.fact;
    $('win-fact').textContent = lv.fact || '';
    $('win-next').hidden = level === LEVELS.length - 1;
    // once the win sheet is put away, the way on stays in the bar at the bottom
    $('go-next').hidden = level === LEVELS.length - 1; dock.classList.add('won');
    setTimeout(function () { if (won) openSheet($('m-win')); }, calm ? 200 : finale ? 4600 : again ? 1250 : 1700);
  }

  // The last box of the seventeen gets the works: a banner, a fanfare,
  // fireworks going off all over the screen, and the pieces doing wave after wave.
  var partyTimer = 0;
  function party(preview) {
    var banner = $('finale'), n = 0;
    banner.classList.add('show');
    setTimeout(function () { banner.classList.remove('show'); }, calm ? 2600 : 4200);
    if (calm) return;
    setTimeout(function () { if (won || preview) sfx.fanfare(); }, 500);
    if (navigator.vibrate && touchy) { try { navigator.vibrate([30, 60, 30, 60, 30, 60, 120]); } catch (e) {} }
    (function rocket() {
      if (!(won || preview) || n >= 13) return;
      burst(innerWidth * (0.12 + Math.random() * 0.76), innerHeight * (0.12 + Math.random() * 0.45), 44);
      sfx.pop();
      if (n % 4 === 3) { confetti(110); cheer(); }
      n++;
      partyTimer = setTimeout(rocket, 240 + Math.random() * 220);
    })();
  }

  // Anyone who has packed all seventeen gets the party, the totals and the
  // prize every time they open the game, until they press Done on the prize.
  function lateParty(preview) {
    var total = { t: 0, m: 0 }, last = save.done[LEVELS[MAIN - 1].name] || { t: 0, m: 0 };
    LEVELS.forEach(function (l) { var d = save.done[l.name]; if (!l.bonus && d) { total.t += d.t; total.m += d.m; } });
    $('finale-sum').textContent = 'All seventeen: ' + clock(total.t) + ' · ' + total.m + ' moves';
    $('win-title').textContent = 'Seventeen!';
    $('win-sub').textContent = 'You packed all seventeen. Take a bow.';
    $('win-best').parentNode.classList.remove('new');
    $('win-time').textContent = clock(last.t); $('win-moves').textContent = last.m; $('win-best').textContent = clock(last.t);
    $('win-all').hidden = false; $('win-one').hidden = true; $('all-time').textContent = clock(total.t); $('all-moves').textContent = total.m;
    $('win-prize').hidden = !PRIZE;
    $('win-fact').hidden = true; $('win-next').hidden = true;
    party(true); confetti(220);
    setTimeout(function () { openSheet($('m-win')); }, calm ? 2800 : 4600);
  }

  // All packed up: a ribbon goes round the box, with a bow where it crosses.
  function tieRibbon() {
    var r = $('ribbon'), cx = (cb.minX + cb.maxX) / 2, cy = (cb.minY + cb.maxY) / 2;
    var k = clamp(Math.min(cb.maxX - cb.minX, cb.maxY - cb.minY) / 2.2, 0.7, 1.5);
    var clip = el('clipPath'), shape = el('path'), bands = el('g'), bow = el('g', 'bow');
    r.textContent = '';
    clip.id = 'box-clip';
    shape.setAttribute('d', bin.firstElementChild.getAttribute('d'));
    clip.appendChild(shape); r.appendChild(clip);
    bands.setAttribute('clip-path', 'url(#box-clip)');
    ['M' + (cb.minX - 0.3) + ' ' + cy + 'H' + (cb.maxX + 0.3), 'M' + cx + ' ' + (cb.minY - 0.3) + 'V' + (cb.maxY + 0.3)].forEach(function (d, n) {
      ['edge', 'band'].forEach(function (c) {
        var p = el('path', c);
        p.setAttribute('d', d); p.setAttribute('pathLength', 1);
        p.style.animationDelay = n * 0.2 + 's';
        bands.appendChild(p);
      });
    });
    r.appendChild(bands);
    bow.setAttribute('transform', 'translate(' + cx + ' ' + cy + ') scale(' + k + ')');
    ['M0 0L-0.2 0.34L-0.05 0.3Z', 'M0 0L0.2 0.34L0.05 0.3Z',
     'M0 0C-0.1 -0.3 -0.46 -0.3 -0.44 -0.06C-0.42 0.16 -0.12 0.1 0 0Z', 'M0 0C0.1 -0.3 0.46 -0.3 0.44 -0.06C0.42 0.16 0.12 0.1 0 0Z'].forEach(function (d) {
      var p = el('path'); p.setAttribute('d', d); bow.appendChild(p);
    });
    var knot = el('circle'); knot.setAttribute('r', 0.085); bow.appendChild(knot);
    r.appendChild(bow);
    r.removeAttribute('hidden');
  }

  // The crowd goes wild: a wave runs across the box, left to right.
  function cheer() {
    if (calm) return;
    var crowd = pieces, start = performance.now(), wide = cb.maxX - cb.minX;
    (function frame(t) {
      if (crowd !== pieces) return;
      var live = false;
      crowd.forEach(function (p) {
        var k = (t - start) / 1000 - 0.1 - (p.x - cb.minX) / wide * 0.5, hop = 0;
        if (k < 1) live = true;
        if (k > 0 && k < 1) hop = Math.abs(Math.sin(k * 2 * Math.PI)) * 0.14 * (1 - k * 0.6);
        if (hop) p.pop.setAttribute('transform', 'translate(0 ' + (-hop).toFixed(4) + ')'); else p.pop.removeAttribute('transform');
      });
      if (live) requestAnimationFrame(frame);
    })(start);
  }

  /* ---------- sheets ---------- */

  // A sheet opens with its way on (.go) in focus, or failing that its first button.
  function openSheet(s) { s.classList.add('open'); var b = s.querySelector('.btn.go:not([hidden])') || s.querySelector('.btn:not([hidden])'); if (b) setTimeout(function () { b.focus({ preventScroll: true }); }, 60); }
  // 'How to pack' counts as seen only once it is closed, so a load nobody looked at does not use it up
  function closeSheet(s) {
    s.classList.remove('open');
    if (s.id === 'm-help' && !save.seen) { save.seen = true; persist(); }
    if (s.id === 'm-name') named();
  }
  Array.prototype.forEach.call(document.querySelectorAll('.sheet'), function (s) {
    s.addEventListener('click', function (e) { if (e.target === s || e.target.hasAttribute('data-close')) closeSheet(s); });
  });

  // 'Show a spot' is on offer three times a level in any twenty-four hours. Each use is
  // kept by its time, and comes back a day after it was spent.
  var DAY = 864e5, waiter = 0;
  function spent() {
    save.hints = save.hints || {};
    var now = Date.now(), used = (save.hints[lv.name] || []).filter(function (t) { return now - t < DAY && t <= now; });
    save.hints[lv.name] = used;
    return used;
  }
  // how long until the oldest one comes back: hours, then minutes inside the last hour, then seconds inside the last minute
  function wait(ms) {
    var n = ms >= 36e5 ? Math.floor(ms / 36e5) : ms >= 6e4 ? Math.floor(ms / 6e4) : Math.max(1, Math.ceil(ms / 1000));
    return n + (ms >= 36e5 ? ' hour' : ms >= 6e4 ? ' minute' : ' second') + (n === 1 ? '' : 's');
  }
  function showSpots() {
    var used = spent(), left = Math.max(0, 3 - used.length);
    $('hint-spot').disabled = !left;
    $('spots').textContent = left;
    $('hint-wait').hidden = !!left || won;
    if (!left) $('hint-wait').textContent = 'Next hint in ' + wait(used[0] + DAY - Date.now()) + '.';
  }

  function showHint() {
    $('hint-h').textContent = lv.name;
    $('hint-text').textContent = lv.hint;
    $('hint-fact').hidden = !lv.fact;
    $('hint-fact').textContent = lv.fact || '';
    $('b-hint').classList.remove('nag');
    $('hint-spot').hidden = won;
    showSpots();
    clearInterval(waiter);
    waiter = setInterval(function () { if ($('m-hint').classList.contains('open')) showSpots(); else clearInterval(waiter); }, 1000);   // the wait counts down while the sheet is up
    openSheet($('m-hint'));
  }

  /* ---------- leaderboard ---------- */

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  var me = hash(save.pid);
  function alias(h) { return HUES[h % COLORS.length] + ' ' + ANIMALS[(h >>> 16) % ANIMALS.length]; }
  function tidy(name) { return String(name || '').replace(/[\u0000-\u001f\u007f<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 18); }
  function nth(n) { var k = n % 100; return n + (k > 10 && k < 14 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'); }

  // A player's picture: a square block wearing one of the faces. Nobody picks
  // theirs; it comes from their id, so it is the same wherever it is shown.
  function avatar(h, cls) {
    var kit = OUTFITS[(h >>> 8) % OUTFITS.length], s = el('svg', 'avatar' + (cls ? ' ' + cls : '')), fill = el('rect', 'fill'), face = el('g', 'face');
    s.setAttribute('viewBox', '-0.56 -0.56 1.12 1.12'); s.setAttribute('aria-hidden', 'true');
    s.style.setProperty('--c', COLORS[h % COLORS.length]);
    fill.setAttribute('x', -0.5); fill.setAttribute('y', -0.5); fill.setAttribute('width', 1); fill.setAttribute('height', 1); fill.setAttribute('rx', 0.14);
    s.appendChild(fill);
    [-0.13, 0.13].forEach(function (x) {
      var e = el('circle', 'eye');
      e.setAttribute('cx', x); e.setAttribute('cy', kit.eyeY || -0.06); e.setAttribute('r', kit.eye || 0.048);
      face.appendChild(e);
    });
    var mouth = el('path', 'mouth');
    mouth.setAttribute('d', kit.idle || 'M-0.07 0.1 Q0 0.15 0.07 0.1');
    face.appendChild(mouth);
    (kit.wear || []).forEach(function (w) {
      var e = el(w[0], w[1]);
      for (var k in w[2]) e.setAttribute(k, w[2][k]);
      face.appendChild(e);
    });
    s.appendChild(face);
    return s;
  }

  // Asked once, before anything else. Skipping it, or closing it any other way, leaves the stand-in name.
  var afterName = null;
  function askName(then) {
    afterName = then || null;
    $('name-face').textContent = ''; $('name-face').appendChild(avatar(me));
    $('name').value = save.name && save.name !== alias(me) ? save.name : '';
    $('name-go').textContent = save.name ? 'Save' : 'Start \u2192';
    $('name-skip').hidden = !!save.name;
    openSheet($('m-name'));
  }
  function named() {
    if (!save.name) { save.name = alias(me); persist(); }
    renames = 0; sync();   // tells the board the name, if it has anything under another
    var then = afterName; afterName = null;
    if (then) then();
  }
  $('name-form').addEventListener('submit', function (e) {
    e.preventDefault();
    save.name = tidy($('name').value) || alias(me); persist();
    $('name').blur();
    closeSheet($('m-name'));
  });
  $('name-skip').addEventListener('click', function () { save.name = alias(me); persist(); closeSheet($('m-name')); });

  function ask(url, body) {
    return fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
      .then(function (r) { return r.json().then(function (d) { d.status = r.status; return d; }); });
  }
  // The board: most levels packed first, then fewest moves, then least time. Everyone's
  // three numbers are shown. Whoever is looking is picked out, and added underneath if
  // they are further down than the rows on show.
  function ranks(list, data, limit) {
    list.textContent = '';
    var mine = false;
    function cell(li, tag, cls, text) { var e = document.createElement(tag); e.className = cls; e.textContent = text; li.appendChild(e); return e; }
    function line(pos, r, own) {
      var li = document.createElement('li');
      cell(li, 'b', 'pos', pos);
      li.appendChild(avatar(r.a));
      cell(li, 'span', 'who', own ? called() : r.name);
      cell(li, 'span', 'fig', r.n); cell(li, 'span', 'fig', r.m); cell(li, 'span', 'fig t', clock(r.t));
      if (own) { li.className = 'me'; mine = true; }
      list.appendChild(li);
    }
    var rows = (data.top || []).slice(0, limit);
    if (!rows.length && !data.mine) { cell(list.appendChild(document.createElement('li')), 'span', '', 'Nobody yet. Be the first.').parentNode.className = 'none'; return; }
    var head = document.createElement('li'); head.className = 'head';
    cell(head, 'span', 'who', ''); cell(head, 'span', 'fig', 'Levels'); cell(head, 'span', 'fig', 'Moves'); cell(head, 'span', 'fig t', 'Time');
    list.appendChild(head);
    rows.forEach(function (r, i) { line(i + 1, r, r.a === me); });
    if (!mine && data.mine && data.rank) {
      cell(list.appendChild(document.createElement('li')), 'span', '', '· · ·').parentNode.className = 'gap';
      line(data.rank, data.mine, true);
    }
  }
  function standing(d) { return d.rank ? 'You are ' + nth(d.rank) + ' of ' + d.of + '.' : ''; }

  // After a win: send it, unless it should not count, and show where that leaves them.
  var sent = 0;
  function report(score) {
    var box = $('win-lb'), note = $('win-lb-note'), skip = LOCAL, mark = ++sent;
    box.hidden = true;
    (skip ? ask(SCORES + '?pid=' + save.pid) : ask(SCORES, score)).then(function (d) {
      if (mark !== sent) return;   // another win has gone since
      if (d.error === 'name') {   // the board will not take that name: fall back to the stand-in and send it again
        save.name = alias(me); persist(); score.name = save.name;
        return report(score);
      }
      if (!d.top) return;
      if (!LOCAL) { save.sent = save.sent || {}; save.sent[score.level] = 1; save.as = score.name; persist(); }
      ranks($('win-ranks'), d, 5);
      note.textContent = LOCAL ? 'Scores are not sent from a copy on this machine.' : standing(d);
      note.hidden = !note.textContent;
      box.hidden = false;
    }).catch(function () {});   // no board today: the win sheet simply goes without one
  }

  // Bests the board has not had yet are sent as soon as the game opens, one at a time:
  // everything packed before there was a leaderboard, and any win that did not get through.
  // The pieces are long gone from the box, so the level's own solution goes along as the
  // proof. Until a name is given they go up under the stand-in, and the board is told the
  // real one the moment there is one.
  var syncing = false, renames = 0;   // renames: how often this visit has gone back just to change the name, in case the board keeps refusing
  function called() { return save.name || alias(me); }
  function sync() {
    if (LOCAL || syncing) return;
    save.sent = save.sent || {};
    var due = LEVELS.filter(function (l) { return save.done[l.name] && !save.sent[l.name]; });
    // nothing new to send, but the name has changed: send one old best again, which carries the name with it
    if (!due.length && save.as !== called() && renames++ < 2) due = LEVELS.filter(function (l) { return save.done[l.name]; }).slice(0, 1);
    if (!due.length) return;
    syncing = true;
    (function next() {
      var l = due.shift(), d = l && save.done[l.name], as = called();
      if (!l) { syncing = false; if (save.as !== called()) sync(); return; }   // renamed while this was going on
      ask(SCORES, { level: l.name, pid: save.pid, name: as, t: d.t, m: d.m, p: l.solution }).then(function (r) {
        if (r.top || r.error === 'score') { save.sent[l.name] = 1; if (r.top) save.as = as; persist(); }   // on the board, or never going to be
        if (r.top || r.error === 'score' || r.error === 'unpacked') setTimeout(next, 250); else syncing = false;   // anything else: try again next time
      }).catch(function () { syncing = false; });
    })();
  }

  function showBoard() {
    var list = $('board-ranks'), note = $('board-note');
    $('board-face').textContent = ''; $('board-face').appendChild(avatar(me));
    $('board-name').textContent = called();
    list.classList.add('wait');
    ask(SCORES + '?pid=' + save.pid).then(function (d) {
      if (!d.top) throw 0;
      ranks(list, d, 10);
      note.textContent = standing(d);
    }).catch(function () {
      list.textContent = ''; note.textContent = 'The leaderboard is not available right now.';
    }).then(function () { list.classList.remove('wait'); });
    openSheet($('m-board'));
  }
  $('win-lb-all').addEventListener('click', function () { closeSheet($('m-win')); showBoard(); });
  $('board-rename').addEventListener('click', function () { closeSheet($('m-board')); askName(showBoard); });

  function showLevels() {
    var grid = $('grid'), count = 0;
    grid.textContent = '';
    LEVELS.forEach(function (l, n) {
      if (n === MAIN) {
        // the prize sits straight after the seventeenth box, so it is plain what earns it
        var gift = document.createElement('div'), claimed = LEVELS.every(function (x) { return x.bonus || save.done[x.name]; });
        gift.className = 'lv prize-tile' + (claimed ? ' won' : '');
        gift.style.setProperty('--n', n);
        gift.innerHTML = GIFT;
        gift.appendChild(document.createTextNode(claimed ? 'Won!' : 'Prize'));
        gift.title = claimed ? 'You packed all seventeen' : 'Pack all seventeen to win a prize, shipped to you';
        grid.appendChild(gift);
      }
      if (n === MAIN) { var more = document.createElement('div'); more.className = 'more'; more.textContent = 'Bonus: new shapes and tilings'; grid.appendChild(more); }
      var b = document.createElement('button'), s = el('svg'), poly = el('polygon'), bb = G.bounds(l.container), done = save.done[l.name];
      if (done) count++;
      var shut = !unlocked(n);
      b.className = 'lv' + (done ? ' done' : '') + (n === level ? ' here' : '') + (shut ? ' locked' : '');
      b.disabled = shut;
      b.style.setProperty('--n', n);
      b.setAttribute('aria-label', label(n) + (shut ? ', locked until the one before it is packed' : ', ' + l.name + (done ? ', packed in ' + clock(done.t) : '')));
      b.title = shut ? 'Pack the one before it first' : l.name + (done ? ' · best ' + clock(done.t) : '');
      s.setAttribute('viewBox', bb.minX + ' ' + bb.minY + ' ' + (bb.maxX - bb.minX) + ' ' + (bb.maxY - bb.minY));
      poly.setAttribute('points', pts(l.container));
      s.appendChild(poly); b.appendChild(s);
      b.appendChild(document.createTextNode(n < MAIN ? n + 1 : 'B' + (n - MAIN + 1)));
      if (done || shut) { var t = document.createElement('span'); t.className = 'tick'; t.textContent = done ? '✓' : '\uD83D\uDD12'; b.appendChild(t); }
      b.addEventListener('click', function () { closeSheet($('m-levels')); startLevel(n); });
      grid.appendChild(b);
    });
    $('levels-sub').textContent = count ? count + ' of ' + LEVELS.length + ' packed. They get harder as you go.' : LEVELS.length + ' boxes. They get harder as you go.';
    openSheet($('m-levels'));
  }

  $('chip').addEventListener('click', showLevels);
  $('b-hint').addEventListener('click', showHint);
  $('hint-spot').addEventListener('click', function () {
    if (spent().length >= 3) return;
    var spot = pickSpot();
    if (spot) { save.hints[lv.name].push(Date.now()); persist(); }   // three to a level, a day
    closeSheet($('m-hint')); showGhost(spot);
  });
  $('b-board').addEventListener('click', showBoard);
  $('b-help').addEventListener('click', function () { openSheet($('m-help')); });
  var armed = 0;
  function disarm() { clearTimeout(armed); armed = 0; $('b-reset').classList.remove('sure'); }
  $('b-reset').addEventListener('click', function () {
    var packed = pieces.filter(function (p) { return p.good; }).length;
    if (packed >= 3 && !armed && !won) { this.classList.add('sure'); armed = setTimeout(disarm, 2800); return; }
    disarm(); wake(); startLevel(level, true); sfx.drop();
  });
  $('b-sound').addEventListener('click', function () {
    save.mute = !save.mute; persist();
    showMute();
    if (!save.mute) { wake(); sfx.fit(); }
  });
  $('win-next').addEventListener('click', function () { closeSheet($('m-win')); startLevel(Math.min(level + 1, LEVELS.length - 1)); });
  $('prize-done').addEventListener('click', function () { save.claimed = true; persist(); closeSheet($('m-win')); });
  $('prize-gift').innerHTML = GIFT;
  $('go-next').addEventListener('click', function () { startLevel(Math.min(level + 1, LEVELS.length - 1)); });
  $('win-again').addEventListener('click', function () { closeSheet($('m-win')); startLevel(level, true); });
  $('win-levels').addEventListener('click', function () { closeSheet($('m-win')); showLevels(); });
  // Share sheet on a phone; elsewhere the brag and the link go on the clipboard.
  $('win-share').addEventListener('click', function () {
    var b = this.lastChild, url = location.href.split(/[?#]/)[0] + '?level=' + (level + 1);
    var text = 'I packed ' + lv.name + ', ' + label(level).toLowerCase() + ' of Packman, in ' + clock(elapsed) + '. Can you beat that?';
    if (navigator.share) { navigator.share({ title: 'Packman', text: text, url: url }).catch(function () {}); return; }
    navigator.clipboard.writeText(text + ' ' + url).then(function () {
      b.textContent = 'Copied!';
      setTimeout(function () { b.textContent = 'Share'; }, 1600);
    }).catch(function () {});
  });
  if (!navigator.share && !(navigator.clipboard && navigator.clipboard.writeText)) $('win-share').hidden = true;

  /* ---------- confetti ---------- */

  var fx = $('fx'), ctx = fx.getContext('2d'), bits = [], raf = 0;
  function confetti(n) {
    if (calm) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2), W = innerWidth, Hh = innerHeight;
    fx.width = W * dpr; fx.height = Hh * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (var i = 0; i < n; i++) {
      var side = i % 2, a = (side ? Math.PI * 0.62 : Math.PI * 0.38) + (Math.random() - 0.5) * 0.9, v = 9 + Math.random() * 13;
      bits.push({
        x: side ? W + 10 : -10, y: Hh * (0.55 + Math.random() * 0.3),
        vx: Math.cos(a) * v * (W > 700 ? 1.5 : 1), vy: -Math.sin(a) * v,
        r: 6 + Math.random() * 8, a: Math.random() * 6.3, va: (Math.random() - 0.5) * 0.4,
        c: COLORS[i % COLORS.length], tri: Math.random() < 0.5, life: 150 + Math.random() * 70
      });
    }
    if (!raf) raf = requestAnimationFrame(rain);
  }
  // A firework: bits flying out in every direction from one point.
  function burst(x, y, n) {
    if (calm) return;
    if (!raf) { var dpr = Math.min(window.devicePixelRatio || 1, 2); fx.width = innerWidth * dpr; fx.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    var c = Math.floor(Math.random() * COLORS.length);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.3, v = 3 + Math.random() * 9;
      bits.push({
        x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 3,
        r: 4 + Math.random() * 6, a: Math.random() * 6.3, va: (Math.random() - 0.5) * 0.5,
        c: COLORS[(c + (i % 3 ? 0 : 1 + i % 2)) % COLORS.length], tri: Math.random() < 0.5, life: 60 + Math.random() * 50
      });
    }
    if (!raf) raf = requestAnimationFrame(rain);
  }
  function rain() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    bits = bits.filter(function (b) { return b.life > 0 && b.y < innerHeight + 40; });
    bits.forEach(function (b) {
      b.vy += 0.34; b.vx *= 0.985; b.vy *= 0.985; b.x += b.vx; b.y += b.vy; b.a += b.va; b.life--;
      ctx.save();
      ctx.translate(b.x, b.y); ctx.rotate(b.a);
      ctx.globalAlpha = Math.min(1, b.life / 30);
      ctx.fillStyle = b.c; ctx.strokeStyle = '#2B2140'; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
      ctx.beginPath();
      if (b.tri) { ctx.moveTo(0, -b.r); ctx.lineTo(b.r * 0.87, b.r * 0.5); ctx.lineTo(-b.r * 0.87, b.r * 0.5); ctx.closePath(); }
      else ctx.rect(-b.r * 0.7, -b.r * 0.7, b.r * 1.4, b.r * 1.4);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    });
    raf = bits.length ? requestAnimationFrame(rain) : 0;
    if (!raf) ctx.clearRect(0, 0, innerWidth, innerHeight);
  }

  /* ---------- go ---------- */

  setInterval(function () {
    if (!pieces.length || document.hidden) return;
    var p = pieces[Math.floor(Math.random() * pieces.length)];
    if (!p.el || p.kit.stare) return;   // shades and heart eyes do not blink
    p.el.classList.add('blink'); repaint(p);
    setTimeout(function () { p.el.classList.remove('blink'); repaint(p); }, 220);
  }, 900);

  // The page is a game board, not a document: no pinch or double-tap zoom.
  // iOS Safari ignores user-scalable=no, so its gesture events are cancelled too.
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) {
    document.addEventListener(n, function (e) { e.preventDefault(); }, { passive: false });
  });
  // A pinch has to be refused from its first touch: once Safari has started
  // one, cancelling the moves is too late. Only the sheets scroll, one finger.
  function scrolls(e) { return e.touches.length < 2 && e.target.closest && e.target.closest('.card'); }
  document.addEventListener('touchstart', function (e) { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove', function (e) { if (!scrolls(e)) e.preventDefault(); }, { passive: false });
  // Double-tap: swallow the second tap and deliver its click by hand. The dock
  // buttons work on pointerdown and need no click.
  var lastEnd = 0;
  document.addEventListener('touchend', function (e) {
    var n = performance.now(), t = e.target, fast = n - lastEnd < 350;
    lastEnd = n;
    if (!fast || e.touches.length || !t.closest || t.closest('input')) return;
    e.preventDefault();
    if (!t.closest('.rb') && !t.closest('#board')) t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
  }, { passive: false });

  if (window.ResizeObserver) new ResizeObserver(layout).observe(stage);
  else window.addEventListener('resize', layout);

  // the sound button's label says which way it is: Unmuted or Muted
  function showMute() { $('b-sound').classList.toggle('off', !!save.mute); $('b-sound').setAttribute('data-tip', save.mute ? 'Muted' : 'Unmuted'); }
  showMute();
  // A phone has no hovering, so there a button's label comes up when it is tapped and fades after two seconds.
  Array.prototype.forEach.call(document.querySelectorAll('.ib[data-tip]'), function (b) {
    var byFinger = false, timer = 0;
    b.addEventListener('pointerdown', function (e) { byFinger = e.pointerType === 'touch'; });
    b.addEventListener('click', function () {
      if (!byFinger) return;
      b.classList.add('tip');
      clearTimeout(timer);
      timer = setTimeout(function () { b.classList.remove('tip'); }, 2000);
    });
  });
  var asked = /[?&#]level=(\d+)/.exec(location.search + location.hash);
  var first = asked ? +asked[1] - 1 : LEVELS.map(function (l) { return l.name; }).indexOf(save.last);
  first = clamp(first, 0, LEVELS.length - 1);
  while (!unlocked(first)) first--;   // a link to a level not reached yet opens the furthest one that is
  startLevel(first);
  // The name comes first, for new players and for anyone from before there was a leaderboard.
  // Whatever else was due to open (how to pack, the party for a finished game) waits for it.
  var opening = function () {
    if (/[?&]finale\b/.test(location.search)) setTimeout(function () { lateParty(true); }, 600);   // a look at the last level's party, whatever has been packed
    else if (!save.claimed && LEVELS.every(function (l) { return l.bonus || save.done[l.name]; })) setTimeout(lateParty, 700);
    if (!save.seen) openSheet($('m-help'));
  };
  sync();
  if (save.name) opening(); else askName(opening);
  persist();

  // Developer tools, only when the game is served from this machine.
  if (LOCAL) {
    var dev = document.createElement('div');
    dev.className = 'dev';
    [['Solver', function () {
      if (won) return;
      select(-1);
      pieces.forEach(function (p, i) { p.x = lv.solution[i][0]; p.y = lv.solution[i][1]; p.angle = lv.solution[i][2]; render(i); });
      startClock(); commit(true);
    }], ['Hard reset', function () {
      if (!window.confirm('Clear all Packman progress on this browser?')) return;
      wiped = true;
      clearInterval(ticker); clearTimeout(shakeTimer); clearTimeout(partyTimer);
      try { localStorage.removeItem(STORE); } catch (e) {}
      location.replace(location.pathname + '?reset=' + Date.now());   // a new address, so the browser cannot hand back the old page
    }]].forEach(function (b) {
      var btn = document.createElement('button');
      btn.textContent = b[0]; btn.addEventListener('click', b[1]);
      dev.appendChild(btn);
    });
    document.body.appendChild(dev);
  }

  window.Packman = { pieces: function () { return pieces; } };   // for poking at the board from the console
})();
