// Packman: the board, the dragging and spinning, and the celebrations.
(function () {
  'use strict';

  var G = PackmanGeom, LEVELS = PackmanLevels;
  var NS = 'http://www.w3.org/2000/svg';
  var COLORS = ['#FF6B6B', '#FFC93C', '#3DDBB4', '#4DA8FF', '#9B7BFF', '#FF8FCB', '#FF9F45', '#B5E655', '#45D9E6', '#D987F5', '#FFB59E'];
  var PRAISE = ['Packed!', 'Snug!', 'Tidy!', 'Nailed it!', 'So neat!', 'Boxed!'];
  var STORE = 'packman.v1';
  var GIFT = '<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="6" y="17" width="28" height="19" rx="3" fill="#FF6B6B" stroke="#2B2140" stroke-width="2.5"/><rect x="4" y="11" width="32" height="8" rx="2.5" fill="#FF8FCB" stroke="#2B2140" stroke-width="2.5"/><rect x="17" y="11" width="6" height="25" fill="#FFC93C" stroke="#2B2140" stroke-width="2.5"/><path d="M20 11C16 3 8 5 11 10ZM20 11C24 3 32 5 29 10Z" fill="#FFC93C" stroke="#2B2140" stroke-width="2.5" stroke-linejoin="round"/></svg>';
  // Whoever gets in among the first three on the leaderboard is asked to send Garvit a screenshot, the first time they do. Set false and the prize is not mentioned.
  var PRIZE = true;
  // The leaderboard lives in a Cloudflare Worker (extras/cloudflare-worker/packman-scores.js).
  var SCORES = 'https://www.garvitgupta.com/api/packman';
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|)$/.test(location.hostname);   // served from this machine: read the board, never write to it
  var REEL = LOCAL && /[?&]reel\b/.test(location.search);   // the game playing itself, to be filmed (reel/): it keeps its own progress, apart from the player's
  if (REEL) STORE = 'packman.reel';
  // A look at one of the game's big moments, on this machine: ?show=seventeen, finished, coup3, coup2, coup1, prize, welcome or board (tools/states.html shows them all).
  // It has a saved game of its own, made afresh each time: whatever the moment needs to have been packed already.
  var SHOW = LOCAL && (/[?&]show=([a-z0-9]+)/.exec(location.search) || [])[1];
  if (SHOW) {
    STORE = 'packman.show';
    (function () {
      var all = PackmanLevels, on = SHOW === 'seventeen' ? 'Seventeen' : SHOW === 'finished' ? all[all.length - 1].name : 'Four Square', done = {};
      all.forEach(function (l, n) { if (l.name !== on && (SHOW === 'finished' || (SHOW === 'seventeen' && n < 17))) done[l.name] = { t: 40 + n * 7, m: 8 + n }; });
      var seed = { v: 3, done: done, last: on, name: 'Packer', pid: 'show-0000-0000-0000-0000', seen: true, eyeTip: 1 };
      if (SHOW === 'prize') seed.top3 = { rank: 3, over: 'Sonam', at: 0 };
      try { localStorage.setItem(STORE, JSON.stringify(seed)); } catch (e) {}
    })();
  }
  if (LOCAL && /[?&]scores=([^&]+)/.test(location.search)) SCORES = decodeURIComponent(RegExp.$1);   // a stand-in board, for trying things out
  // Everyone gives a name. A colour and an animal stand in only until they do, or if the board will not take
  // the one they gave: the colour of their block, so Blue Leopard is blue.
  var HUES = ['Red', 'Golden', 'Mint', 'Blue', 'Violet', 'Pink', 'Orange', 'Lime', 'Aqua', 'Orchid', 'Peach'];
  var ANIMALS = ['Fox', 'Leopard', 'Otter', 'Panda', 'Tiger', 'Owl', 'Wolf', 'Koala', 'Lynx', 'Heron', 'Badger', 'Falcon',
    'Dolphin', 'Moose', 'Raven', 'Gecko', 'Bison', 'Puffin', 'Hare', 'Seal', 'Yak', 'Crane', 'Lemur', 'Ibex'];
  // Three chapters: the seventeen, then the powers, then the bricks and hexagons. The file lists the
  // powers last (they were written last), so the levels are put in chapter order here.
  var CHAPTERS = ['Seventeen', 'Powers', 'Bricks and hexagons', 'Twists'];
  function chap(l) { return l.twist ? 3 : l.powers ? 1 : l.bonus ? 2 : 0; }   // (the fourth has powers on some levels and none on others)
  LEVELS = [0, 1, 2, 3].reduce(function (all, k) { return all.concat(LEVELS.filter(function (l) { return chap(l) === k; })); }, []);
  var FIRST = CHAPTERS.map(function (c, k) { return LEVELS.map(chap).indexOf(k); });   // where each chapter starts
  var MAIN = LEVELS.filter(function (l) { return !chap(l); }).length;   // the seventeen
  function among(n) { return n - FIRST[chap(LEVELS[n])] + 1; }   // a level's number within its chapter
  function chapSize(k) { return LEVELS.filter(function (l) { return chap(l) === k; }).length; }
  var TURN = { square: 90, triangle: 120, domino: 180, hexagon: 60 };   // degrees before a shape looks the same again
  var KNOB = { square: 0.72, triangle: 0.6, domino: 0.72, hexagon: 1.08 };
  var OUTFITS = PackmanFaces;   // what a piece wears: the personalities, in faces.js
  // The powers of chapter two, by name. Each is a face of its own, also in faces.js.
  var POWERS = {};
  PackmanPowers.forEach(function (k) { POWERS[k.power] = k; });
  var CHAM = ['#3DDBB4', '#FF8FCB', '#FFC93C', '#4DA8FF'];   // the chameleon's colours: one for each of the four shapes it goes through

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
  // (by: that many pixels further in still, for what is drawn on a shape and must stop short of its line)
  function drawn(type, px, by) {
    px = px || 1 / view.scale; by = by || 0;
    return rounded(grown(G.makeContainer(G.SHAPES[type]), -(2.6 + by) * px), Math.min((6 - by) * px, 0.12));
  }
  // The box's outline is drawn just outside the real walls, so a piece resting
  // against a wall shows the same sliver of gap as two pieces side by side.
  function binPath(px) { return boxes().map(function (c) { return rounded(grown(c, 3.4 * px), Math.min(9 * px, 0.16)); }).join(''); }
  function boxes() { return C.parts || [C]; }   // a level has one box as a rule; Duality has two
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
  // Every chapter is open from the start. Inside one, a level opens once the one before it
  // is packed, and anything already packed stays open.
  function unlocked(n) { return LOCAL || n === FIRST[chap(LEVELS[n])] || !!save.done[LEVELS[n].name] || !!save.done[LEVELS[n - 1].name]; }   // (on a copy on this machine every level is open, for trying things out)
  function label(n) { var c = chap(LEVELS[n]); return (c ? 'Chapter ' + (c + 1) + ', level ' : 'Level ') + among(n); }
  function clock(sec) { sec = Math.round(sec); return Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2); }
  function shuffled(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  var board = $('board'), stage = $('stage'), layer = $('pieces'), bin = $('bin'), handle = $('handle'),
      bubble = $('bubble'), dock = $('dock'), ang = $('ang');

  var save = { v: 3, done: {}, last: '', mute: false, seen: false };
  // A reset leaves a note for the page that loads after it, which forgets everything once more before it
  // reads anything: whatever may have been written back in the moment between the two.
  try {
    if (sessionStorage.getItem('packman.reset')) { sessionStorage.removeItem('packman.reset'); localStorage.removeItem(STORE); localStorage.removeItem('packer.v1'); }
  } catch (e) {}
  // progress saved back when the game was called Packer carries over
  try { var raw = JSON.parse(localStorage.getItem(STORE) || localStorage.getItem('packer.v1')); if (raw && raw.done) save = raw; } catch (e) {}
  // Minefield was called Short Fuse for its first day: a win of it then is a win of it now, so the level after it stays open.
  if (save.done && save.done['Short Fuse']) { if (!save.done.Minefield) save.done.Minefield = save.done['Short Fuse']; delete save.done['Short Fuse']; }
  if (save.last === 'Short Fuse') save.last = 'Minefield';
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
    if (REEL && window.Packman && window.Packman.heard) window.Packman.heard(freq, dur, opts || {});   // (for the film's soundtrack, which is made from a list of the notes)
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
  var sfx = PackmanSounds(tone);   // every sound is a few notes written down in sounds.js and made here; none is a recording
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
      // A wide screen has room beside the box for the loose shapes, so the view is kept at
      // least a few shapes tall and the box sits in the middle of it. A phone on its side has
      // no height to spare: there the box fills it top to bottom, and the width takes the rest.
      var low = Hp < 460;
      if (low) pad = 0.32;
      vh = Math.max(ch + 2 * pad, low ? 0 : 4.4);
      // (a board with a line down it keeps room over and under its boxes for a shape to be dealt on the line: see scatter)
      if (lv.divide != null && pieces.some(function (p) { return !p.half; })) vh = Math.max(vh, ch + 3);
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
    $('true-box').setAttribute('d', boxes().map(function (c) { return loop(c.poly); }).join(''));   // for eyesight: the box exactly as judged
    pieces.forEach(function (p) { if (p.fill) outline(p); });
    if (ghost) $('ghost').setAttribute('d', ghostPath(ghost.type));
    if (fence && lv.divide == null) { fence.parentNode.removeChild(fence); fence = null; }
    if (lv.divide != null) {
      if (!fence) { fence = el('line', 'fence'); board.insertBefore(fence, bin); }
      fence.setAttribute('x1', lv.divide); fence.setAttribute('x2', lv.divide); fence.setAttribute('y1', view.y); fence.setAttribute('y2', view.y + view.h);
    }
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
    // An entangled shape on a board with a line down it keeps to its own side, clear of the line.
    if (p.half) {
      var over = Math.max.apply(null, G.verts(p).map(function (v) { return (v[0] - lv.divide) * -p.half; }));   // how far its furthest corner is over the line
      if (over > 0) p.x += over * p.half;
    }
  }
  var FENCE = 0.74, fence = null;   // how far from the line such a shape is dealt: clear of it however it is turned

  // The angles at which a shape of this kind has a side square to one of this box's walls,
  // counted once each (a square looks the same every 90 degrees, and so on).
  function squared(type) {
    var S = G.makeContainer(G.SHAPES[type]).walls, turn = TURN[type], found = [0];
    C.walls.forEach(function (w) {
      S.forEach(function (sd) {
        var a = (Math.atan2(w.ny, w.nx) - Math.atan2(sd.ny, sd.nx)) * 180 / Math.PI, whole;
        a = ((a % turn) + turn) % turn; whole = Math.round(a) % turn;
        if (Math.abs(a - Math.round(a)) < 0.01 && found.indexOf(whole) < 0) found.push(whole);
      });
    });
    return found;
  }

  // Where loose pieces wait: beside the box on a wide screen, under it on a tall one.
  function trays() {
    var m = view.land ? 0.85 : 0.7, gap = view.land ? 0.85 : 0.75;
    // On a wide screen the trays keep near the box, as wide as the shapes of this level need and no wider:
    // they are dealt round it, not out at the far edges of the window.
    var rows = Math.floor(Math.max(view.h - 2 * m, 0) / 1.3) + 1, cols = Math.ceil(lv.pieces.length / (2 * rows)), reach = Math.max(1.5, (cols - 1) * 1.5 + 1);
    return view.land ? [[Math.max(view.x + m, cb.minX - gap - reach), view.y + m, cb.minX - gap, view.y + view.h - m], [cb.maxX + gap, view.y + m, Math.min(view.x + view.w - m, cb.maxX + gap + reach), view.y + view.h - m]]
      : [[view.x + m, cb.maxY + gap, view.x + view.w - m, view.y + view.h - m]];
  }
  // A long shape dealt close to the box would lie across its wall. It is moved off, the way the tray lies.
  function standOff(p) {
    if (G.zone(G.verts(p), C) === 'out') return;
    var far = (p.type === 'domino' || p.type === 'hexagon' ? 1 : 0.6) + 0.3;
    if (!view.land) p.y = Math.max(p.y, cb.maxY + far);
    else if (p.x > (cb.minX + cb.maxX) / 2) p.x = Math.max(p.x, cb.maxX + far);
    else p.x = Math.min(p.x, cb.minX - far);
    keepInView(p);
  }
  // Somewhere out there for a shape that has been thrown out of the box: of a few places tried, the one with most room round it.
  function traySpot() {
    var zones = trays(), best = null, room = -1;
    for (var n = 0; n < 14; n++) {
      var z = zones[Math.floor(Math.random() * zones.length)];
      var x = z[0] + Math.random() * Math.max(z[2] - z[0], 0), y = z[1] + Math.random() * Math.max(z[3] - z[1], 0);
      var d = Math.min.apply(null, pieces.map(function (p) { return Math.hypot(p.x - x, p.y - y); }));
      if (d > room) { room = d; best = [x, y]; }
    }
    return best;
  }

  // Deal the pieces out around the box.
  function scatter() {
    var zones = trays();
    var cell = 1.3, slots = [];
    // On a board with a line down it, a shape that may go to either side is dealt on the line itself: under the boxes,
    // one below another, or on a wide screen under them and over them by turns. The places near the line are left empty
    // for them, and the grid is made finer until what is left is enough for the rest, each on its own side.
    var mid = [], sides = { '-1': 0, '1': 0 };
    if (lv.divide != null) {
      pieces.forEach(function (p) { if (p.half) sides[p.half]++; });
      var free = pieces.length - sides['-1'] - sides['1'];
      for (var k = 0; mid.length < free && k < 12; k++) {
        var y = view.land && k % 2 ? cb.minY - 0.85 - Math.floor(k / 2) * 1.2 : cb.maxY + 0.85 + (view.land ? Math.floor(k / 2) : k) * 1.2;
        if (y > view.y + 0.6 && y < view.y + view.h - 0.6) mid.push([lv.divide, y]);
      }
    }
    function room(on) { return slots.filter(function (s) { return (s[0] - lv.divide) * on > FENCE; }).length; }
    while (cell > 0.3) {
      slots = [];
      zones.forEach(function (z) {
        var w = Math.max(z[2] - z[0], 0), h = Math.max(z[3] - z[1], 0);
        var cols = Math.floor(w / cell) + 1, rows = Math.floor(h / cell) + 1;
        for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
          slots.push([z[0] + (cols > 1 ? c * w / (cols - 1) : w / 2), z[1] + (rows > 1 ? r * h / (rows - 1) : h / 2)]);
        }
      });
      if (mid.length) slots = slots.filter(function (s) { return !mid.some(function (m) { return Math.abs(s[0] - m[0]) < 1.08 && Math.abs(s[1] - m[1]) < 1.08; }); });
      if (slots.length >= pieces.length - mid.length && (!mid.length || (room(-1) >= sides['-1'] && room(1) >= sides['1']))) break;
      cell *= 0.85;
    }
    slots = shuffled(slots);
    // a shape that keeps to one side of the board is dealt on that side; the others take what is left
    var deal = pieces.map(function (p) {
      if (!p.half) return mid.shift() || null;
      for (var k = 0; k < slots.length; k++) if ((slots[k][0] - lv.divide) * p.half > FENCE) return slots.splice(k, 1)[0];
      return null;
    });
    pieces.forEach(function (p, i) {
      var s = deal[i] || slots[i % slots.length], j = Math.min(0.12, cell / 8);
      p.x = s[0] + (lv.divide != null && !p.half && deal[i] ? 0 : (Math.random() - 0.5) * j);   // (dead on the line, if that is where it is dealt)
      p.y = s[1] + (Math.random() - 0.5) * j;
      // Dealt straight, or, on a level that scrambles them, at any of the angles that put one
      // of the shape's sides square to a wall of this box. Never anything else: a shape dealt
      // at an angle no wall shares could not sit flush against anything until it was turned.
      var ways = lv.scramble ? squared(p.type) : [0];
      p.angle = ways[Math.floor(Math.random() * ways.length)];
      keepInView(p); standOff(p);
    });
  }

  /* ---------- drawing ---------- */

  function buildPiece(p, i) {
    var g = el('g', 'piece fresh'), pop = el('g', 'pop'), body = el('g', 'body'), fill = el('path', 'fill');
    g.dataset.i = i;
    if (p.power) g.classList.add('p-' + p.power);
    if (p.mate >= 0) g.classList.add('glued');
    g.style.setProperty('--c', p.color);
    if (p.kit && p.kit.ink) g.style.setProperty('--face', p.kit.ink);
    g.style.setProperty('--d', (60 + i * 28) + 'ms');
    var kit = p.kit || OUTFITS[0];
    var made = PackmanPiece.face(kit, p.type), face = made.face, eyes = made.eyes;   // drawn as every page that shows a shape draws one: in faces.js
    p.goo = PackmanPiece.pour(kit, p.type, '');   // what it has poured over it, if anything: outline() cuts it to the shape
    // A patch of the piece's own colour lies behind the face. Safari repaints
    // only part of a face that changes; redrawing this patch along with it
    // makes the whole face get painted, over colour and never over a gap.
    var back = el('rect', 'back'), k = p.type === 'triangle' ? 0.74 : p.type === 'hexagon' ? 1.3 : 1, dy = p.type === 'triangle' ? 0.03 : 0;
    back.setAttribute('x', -0.28 * k); back.setAttribute('y', -0.21 * k + dy);
    back.setAttribute('width', 0.56 * k); back.setAttribute('height', (p.type === 'triangle' ? 0.45 : 0.54) * k);   // short of a triangle's base
    // Under the shape lies its true outline, in a flat blue. It is all that shows of a shape
    // while eyesight is on. The shapes take turns at five blues, so two that sit flush can
    // still be told apart with no line between them.
    var safe = el('path', 'safe');
    safe.setAttribute('d', loop(G.SHAPES[p.type]));
    p.safe = safe; p.blue = i % BLUES.length;
    safe.style.fill = BLUES[p.blue];
    // Two flat shapes that meet exactly still show a hairline of the white behind them, because
    // each only half covers the pixels along the join. So every shape is drawn twice: once in
    // a layer underneath them all, with hard edges, where each pixel is wholly one shape's or
    // not at all, and once on top, smoothed. The hard copy backs the joins. It never colours
    // a pixel the true shape does not reach, so nothing is drawn bigger than it is.
    p.under = el('path', 'seam');
    p.under.setAttribute('d', loop(G.SHAPES[p.type]));
    p.under.style.fill = BLUES[p.blue];
    if (p.power === 'ghost') p.under.setAttribute('class', 'seam ghostly');   // under eyesight the ghost is an outline, not a block
    $('seams').appendChild(p.under);
    body.appendChild(safe); body.appendChild(fill); if (p.goo) body.appendChild(p.goo.g); body.appendChild(back); body.appendChild(face);
    pop.appendChild(body); g.appendChild(pop);
    if (p.power === 'mine') {   // the seconds left on its fuse, over its head
      p.badge = el('text', 'count');
      p.badge.setAttribute('y', -(TOP[p.type] + 0.14)); p.badge.setAttribute('text-anchor', 'middle');
      pop.appendChild(p.badge);
    }
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

  function loop(poly) { return 'M' + poly.map(function (v) { return v[0].toFixed(4) + ' ' + v[1].toFixed(4); }).join('L') + 'Z'; }
  function outline(p) {
    var d = drawn(p.type);
    p.fill.setAttribute('d', d);
    if (p.goo) p.goo.edge.setAttribute('d', drawn(p.type, 0, 1.25));   // up to the inside of the line round the shape, and not over it
  }

  // Pieces are moved with transform attributes, not CSS transforms: Safari
  // repaints the wrong patch of a piece whose parents are moved by CSS.
  function render(i) {
    var p = pieces[i], tf = 'translate(' + p.x.toFixed(4) + ' ' + p.y.toFixed(4) + ')', rot = 'rotate(' + p.angle + ')';
    if (tf === p.tf && rot === p.rot) return;
    if (rot !== p.rot) p.body.setAttribute('transform', rot);
    if (tf !== p.tf) p.el.setAttribute('transform', tf);
    p.under.setAttribute('transform', tf + ' ' + rot);
    p.tf = tf; p.rot = rot;
    gum(p);
    if (sel >= 0 && (i === sel || (pieces[sel].kin || []).some(function (k) { return k.i === i; }))) tether();
  }

  // The knob stands straight above a shape to begin with. When the shape is selected, it
  // comes up on whichever flat side the click or tap was nearest, so it is close to hand, and it
  // stays there until the shape is selected afresh. p.side is that side's number, and knobAt how far round it is from the shape's own
  // "right", in degrees; the drag that turns the shape works from the same angle.
  var SIDES = {};
  function sides(type) {
    return SIDES[type] || (SIDES[type] = G.makeContainer(G.SHAPES[type]).walls.map(function (w) {
      return { nx: w.nx, ny: w.ny, off: w.d, at: Math.atan2(w.ny, w.nx) * 180 / Math.PI };
    }));
  }
  function knobAt(p) { return p.side == null ? -90 : sides(p.type)[p.side].at; }
  // where the knob would stand for a given side (none: straight above, as at the start)
  function knobSpot(p, side) {
    var r = (p.angle + (side == null ? -90 : sides(p.type)[side].at)) * Math.PI / 180;
    var reach = (side == null ? KNOB[p.type] : sides(p.type)[side].off + 0.22) + 42 / view.scale;
    return [p.x + Math.cos(r) * reach, p.y + Math.sin(r) * reach];
  }
  function knobPos(p) { return knobSpot(p, p.side); }
  // Where the dotted line to the knob begins: at the shape's edge, not its middle, so no dots lie over the shape.
  var TOP = { square: 0.5, triangle: 2 * G.H / 3, domino: 0.5, hexagon: G.H };   // how far up a shape reaches from its centre
  function knobRoot(p) {
    var r = (p.angle + knobAt(p)) * Math.PI / 180, out = (p.side == null ? TOP[p.type] : sides(p.type)[p.side].off) + 3 / view.scale;
    return [p.x + Math.cos(r) * out, p.y + Math.sin(r) * out];
  }
  // Which side the knob comes up on when a shape is picked. It goes for the side nearest the
  // click or tap, with two cautions. One in the middle favours no side in particular, so
  // then the knob keeps the place it had. And a place that is taken, by another shape or by
  // the edge of the board, is passed over for the nearest one that is clear; failing that,
  // one outside the box will do, since the knob can still be reached there.
  function pickSide(p, w) {
    var i = pieces.indexOf(p), rad = -p.angle * Math.PI / 180;
    var lx = (w.x - p.x) * Math.cos(rad) - (w.y - p.y) * Math.sin(rad), ly = (w.x - p.x) * Math.sin(rad) + (w.y - p.y) * Math.cos(rad);
    var S = sides(p.type), depth = S.map(function (sd) { return sd.off - (lx * sd.nx + ly * sd.ny); });
    var order = S.map(function (sd, n) { return n; }).sort(function (a, b) { return depth[a] - depth[b]; });
    // A click counts as favouring a side unless it lands in the middle of the shape, more than
    // half way in from every side. Near a corner two sides are about as near as each other,
    // and the nearer of them will do.
    var inner = Math.min.apply(null, S.map(function (sd) { return sd.off; })), clear = depth[order[0]] < 0.55 * inner;
    var wanted = clear ? order[0] : p.side, tries = [wanted].concat(order.filter(function (n) { return n !== wanted; }));
    var inBox = G.zone(G.verts(p), C) !== 'out', room = 16 / view.scale;
    function trouble(side) {
      var k = knobSpot(p, side);
      if (k[0] < view.x + room || k[0] > view.x + view.w - room || k[1] < view.y + room || k[1] > view.y + view.h - room) return 2;   // off the board
      for (var j = 0; j < pieces.length; j++) {
        if (j !== i && G.makeContainer(G.verts(pieces[j])).walls.every(function (wl) { return k[0] * wl.nx + k[1] * wl.ny - wl.d < room; })) return 2;   // on another shape
      }
      return inBox && !G.part(C, p.x, p.y).walls.every(function (wl) { return k[0] * wl.nx + k[1] * wl.ny - wl.d < -room; }) ? 1 : 0;   // over the wall, or beyond it
    }
    var best = tries[0], worst = 3;
    tries.forEach(function (side) { var t = trouble(side); if (t < worst) { worst = t; best = side; } });
    return best;
  }

  function placeHandle() {
    var show = sel >= 0 && !won && !(drag && drag.mode === 'move') && !asleep(pieces[sel]);
    handle.toggleAttribute('hidden', !show);
    if (!show) { bubble.classList.remove('show'); return; }
    var p = pieces[sel], k = knobPos(p), from = knobRoot(p);
    Array.prototype.forEach.call(handle.querySelectorAll('line'), function (line) {   // the stem, and the pale copy that lies under it for eyesight
      line.setAttribute('x1', from[0]); line.setAttribute('y1', from[1]); line.setAttribute('x2', k[0]); line.setAttribute('y2', k[1]);
    });
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
    var ev = evaluate(), pips = $('pips').children, fitted = false, shown = ev.packed, lit = [];
    pieces.forEach(function (p, i) {
      var s = ev.states[i];
      // A chameleon gives nothing away until the box is packed: in its true shape or not, it does not smile,
      // lights nothing in the row of shapes and makes no sound of fitting. Otherwise it could be tried in
      // the empty box, one shape after another, to see which one it likes.
      var hush = p.power === 'chameleon' && !ev.solved;
      if (hush && s.good) shown--;
      // Each shape that fits lights a mark of its own shape in the row, not just the next one along.
      if (s.good && !hush) {
        var kind = p.power === 'chameleon' ? '?' : p.type;
        for (var k = 0; k < pips.length; k++) if (pips[k].kind === kind && !lit[k]) { lit[k] = true; break; }
      }
      p.el.classList.toggle('good', s.good && !hush);
      p.el.classList.toggle('bad', s.zone === 'edge' || s.hit);
      if (p.power === 'sleeper') p.el.classList.toggle('asleep', asleep(p));
      if (p.power === 'chameleon') {   // in the box and in nobody's way, but not in its real shape: the card says why it does not count
        p.fake = !!p.form && s.zone === 'in' && !s.hit;
      }
      // The ghost sharing a space as it should goes clearer and lies over whatever it shares with; that one gives up its face.
      var shared = !!spared && (spared[0] === i || spared[1] === i) && ev.states[spared[0]].good && ev.states[spared[1]].good;
      p.el.classList.toggle('haunted', shared && p.power !== 'ghost');
      if (p.power === 'ghost') {
        p.el.classList.toggle('haunt', shared);
        if (i !== sel && !drag && p.el !== layer.lastChild && (sel < 0 || p.el.nextSibling !== pieces[sel].el)) layer.insertBefore(p.el, sel >= 0 ? pieces[sel].el : null);
      }
      repaint(p);
      if (s.good && !p.good && !hush) {
        fitted = true;
      }
      p.good = s.good;
    });
    for (var k = 0; k < pips.length; k++) pips[k].classList.toggle('on', !!lit[k]);
    $('count').textContent = shown + ' of ' + pieces.length + ' packed';
    // all packed, but for a chameleon in disguise?
    almost = !ev.solved && pieces.some(function (p) { return p.fake; }) && pieces.every(function (p, i) { return ev.states[i].good || p.fake; });
    card();
    ev.fitted = fitted;
    showHits();
    return ev;
  }

  // A move is one piece picked up, shifted and turned as much as you like, and
  // let go of: it is counted when the piece is put down or another is picked up.
  var dirty = false;
  function countMove() { if (dirty) { moves++; dirty = false; } }

  // After a piece has been shifted or turned: make the right noise, maybe win.
  // settled: the powers have already had their say about this move.
  function commit(quiet, settled) {
    seatGhost();
    if (lv.powers && !settled && react()) return;   // shapes are on the move: this is called again when they come to rest
    var ev = judge();
    dirty = true;
    if (ev.solved) { win(); return; }
    lookForShake();
    saveBoard();
    if (quiet) return;
    if (ev.fitted) sfx.fit(Math.max(ev.packed - (masked() ? 1 : 0), 0) / pieces.length); else if (sel >= 0 && pieces[sel].el.classList.contains('bad')) sfx.bad(); else sfx.drop();
  }

  function saveBoard() {
    save.board = {
      l: lv.name, m: moves, t: t0 ? Math.round((performance.now() - t0) / 1000) : carried,
      p: pieces.map(function (p) { return [+p.x.toFixed(4), +p.y.toFixed(4), p.angle]; }),
      // which shapes have which power, and how each stands: the level is dealt differently every time
      q: lv.powers ? pieces.map(function (p) { return p.power ? { w: p.power, t: p.type, o: p.forms, n: p.form, c: p.tint, m: p.mate, r: p.rel } : 0; }) : undefined
    };
    persist();
  }


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
    showAngle(); placeHandle(); tether();
    card();   // what the one in hand does
  }

  var snored = 0;
  function spin(i, by) {
    if (!by || won) return;
    var p = pieces[i];
    if (asleep(p)) { var now = performance.now(); if (now - snored > 800) { snored = now; sfx.snore(); } return; }
    if (p.power === 'sticky' && p.mate >= 0 && unstick(i)) sfx.peel();   // turned by hand, it comes away
    startClock();
    p.angle += by;
    if (p.half) keepInView(p);   // a corner turned over the line is pushed back
    carry(i);
    turnTwin(p, by);
    clearTimeout(shakeTimer);
    // Turning a shape turns it and nothing more: it is not nudged clear of its neighbours
    // or pulled against them. All of that belongs to dragging.
    render(i); placeHandle(); showAngle(); tick();
    if (norm(p.angle) % 15 === 0) haptic();
  }
  // An entangled shape's kin turn whenever it does, wherever they are: by as much, or (geared) as much the other way.
  function turnTwin(p, by) {
    if (!p.kin || !by) return;
    p.kin.forEach(function (k) { pieces[k.i].angle += by * k.s; if (pieces[k.i].half) keepInView(pieces[k.i]); carry(k.i); render(k.i); });
  }
  // A dotted thread runs from the shape in hand to each of its kin, and they are marked as the one in hand is.
  var threads = [];
  function tether() {
    var p = sel >= 0 ? pieces[sel] : null, kin = p && p.kin ? p.kin.map(function (k) { return pieces[k.i]; }) : [];
    Array.prototype.forEach.call(layer.querySelectorAll('.twin'), function (e) { if (!kin.some(function (q) { return q.el === e; })) e.classList.remove('twin'); });
    while (threads.length > kin.length) { var gone = threads.pop(); gone.parentNode.removeChild(gone); }
    kin.forEach(function (q, n) {
      q.el.classList.add('twin');
      if (!threads[n]) { threads[n] = el('line', 'thread'); board.insertBefore(threads[n], layer); }
      var t = threads[n];
      t.setAttribute('x1', p.x.toFixed(4)); t.setAttribute('y1', p.y.toFixed(4)); t.setAttribute('x2', q.x.toFixed(4)); t.setAttribute('y2', q.y.toFixed(4));
    });
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
    if (p.power === 'mine' && !(p.fuse > 0)) light(p);
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
      if (pieces[sel].power === 'mine' && !(pieces[sel].fuse > 0)) light(pieces[sel]);   // taking hold of its knob is picking it up too
    } else if (pe) {
      var i = +pe.dataset.i, p = pieces[i];
      if (i !== sel) {
        if (p.power === 'chameleon') morph(p, i);
        p.side = pickSide(p, w);   // the knob comes up beside the cursor or finger, and then keeps its place
      }
      select(i);
      drag = { mode: 'move', touch: e.pointerType === 'touch', id: e.pointerId, i: i, ox: p.x - w.x, oy: p.y - w.y, sx: e.clientX, sy: e.clientY, moved: false, a0: p.angle, stuck: false };
      p.el.classList.add('held');
      placeHandle(); sfx.voice(p.kit.voice);
      if (p.power === 'mine' && !(p.fuse > 0)) light(p);
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
      spinTo(sel, notched(Math.atan2(w.y - p.y, w.x - p.x) * 180 / Math.PI - knobAt(p)));
      judge();
      return;
    }
    if (!drag.moved && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 4) return;
    if (!drag.moved) clearTimeout(shakeTimer);   // the board is changing now
    if (!drag.moved && pieces[drag.i].power === 'sticky' && unstick(drag.i)) sfx.peel();
    drag.moved = true; startClock();
    p = pieces[drag.i];
    // Only the dragged piece moves, and what you see while dragging is exactly
    // what you get when you let go.
    p.x = w.x + drag.ox; p.y = w.y + drag.oy; p.angle = drag.a0;
    keepInView(p);
    var S = lv.powers ? solid(p) : pieces, stuck = G.place(S, S.indexOf(p), C) === 'snap';
    // not even a snap turns the sleeper in there; nor an entangled shape anywhere, or its twin would be turned in passing
    if (p.angle !== drag.a0 && ((p.power === 'sleeper' && asleep(p)) || p.kin)) { p.angle = drag.a0; G.settle(S, S.indexOf(p), C); stuck = false; }
    if (p.power === 'ghost' && onto(p)) stuck = true;
    if (intoGhost(drag.i)) stuck = true;
    if (stuck && !drag.stuck) { sfx.snap(); haptic(); }
    drag.stuck = stuck;
    render(drag.i); carry(drag.i);
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
  // the judging goes by, in flat colour with no lines at all: every shape at its true size
  // in a blue, the box at its true size in white, and orange-red wherever shapes overlap
  // or pass a wall. A gap shows as a sliver of white.
  // Tap it again and the board goes back to how it looks.
  var eyeOn = false;
  var EYE_LEVEL = 7;   // the level where eyesight is introduced and has to be used: the eighth
  var BLUES = ['#6583BD', '#A3B8DE', '#7C97C9', '#BCCCE9', '#5472AC'];   // ordered so that neighbours in the list differ most

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
  // Under eyesight, wherever two true outlines overlap, or one passes a wall, is filled
  // orange-red, in a layer over the shapes.
  function showHits() {
    var hits = $('hits'), seals = $('seals');
    hits.textContent = ''; seals.textContent = '';
    if (!eyeOn) return;
    var V = pieces.map(G.verts), inPlay = V.map(function (A) { return G.zone(A, C) !== 'out'; });
    var tol = 0.75 / view.scale;   // three quarters of a pixel
    // No two shapes that share an edge may be the same blue, or with no line between them
    // they would read as one. (Meeting at a corner does not count.) Each keeps its blue
    // unless a neighbour settled before it has it; then it takes one that none of its
    // neighbours has, or failing that none of those already settled. The shapes with most
    // neighbours settle first, and the one in hand last, so it is the one seen to change.
    var near = V.map(function (A) { return grown(G.makeContainer(A), 2 * tol); });
    var touches = V.map(function (A, a) {
      return V.map(function (B, b) {
        if (a === b || Math.hypot(pieces[a].x - pieces[b].x, pieces[a].y - pieces[b].y) > 2.4) return false;
        return area(G.makeContainer(B).walls.reduce(function (rest, w) { return rest.length > 2 ? cut(rest, w) : rest; }, near[a])) > 2 * tol * 0.15;   // side by side for a little way at least
      });
    });
    var busy = touches.map(function (row) { return row.filter(Boolean).length; });
    var order = pieces.map(function (p, n) { return n; }).sort(function (a, b) { return (a === sel) - (b === sel) || busy[b] - busy[a] || a - b; });
    order.forEach(function (a, at) {
      var p = pieces[a], all = {}, settled = {}, c;
      order.forEach(function (b, bt) { if (touches[a][b] || touches[b][a]) { all[pieces[b].blue] = true; if (bt < at) settled[pieces[b].blue] = true; } });
      if (!settled[p.blue]) return;
      for (c = 0; c < BLUES.length && all[c]; c++);
      if (c === BLUES.length) for (c = 0; c < BLUES.length && settled[c]; c++);
      if (c === BLUES.length) return;
      p.blue = c;
      p.safe.style.fill = p.under.style.fill = BLUES[c];
    });
    function within(poly, walls) { return walls.reduce(function (rest, w) { return rest.length > 2 ? cut(rest, w) : rest; }, poly); }
    function fill(layer, cls, poly, colour) {
      if (poly.length < 3 || area(poly) < 1e-7) return;
      var e = el('polygon', cls);
      e.setAttribute('points', pts(poly));
      if (colour) e.style.fill = colour;
      layer.appendChild(e);
    }
    // every edge of an outline, with the unit normal that points out of it
    function edges(poly) {
      var walls = G.makeContainer(poly).walls;
      return poly.map(function (a, k) { return { a: a, b: poly[(k + 1) % poly.length], nx: walls[k].nx, ny: walls[k].ny }; });
    }
    // Shapes are let sit a hair off a wall, and off each other, and a hair of white would show
    // there as a line. Where an edge of one faces an edge of the other and lies within a pixel
    // and a half of it, the strip between the two is filled in, under the shapes, in blue: only
    // the strip, and only as far along as the edges run side by side that close.
    function seal(e, f, colour) {
      if (e.nx * f.nx + e.ny * f.ny > -0.9986) return;   // not face to face, to within three degrees
      var len = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]), ux = (e.b[0] - e.a[0]) / len, uy = (e.b[1] - e.a[1]) / len;
      var at = function (v) { return (v[0] - e.a[0]) * ux + (v[1] - e.a[1]) * uy; };          // how far along e
      var off = function (v) { return (v[0] - e.a[0]) * e.nx + (v[1] - e.a[1]) * e.ny; };      // how far out from e
      var t1 = at(f.a), t2 = at(f.b), g1 = off(f.a), g2 = off(f.b);
      if (t1 > t2) { var t = t1; t1 = t2; t2 = t; t = g1; g1 = g2; g2 = t; }
      var gap = function (x) { return t2 - t1 < 1e-9 ? g1 : g1 + (g2 - g1) * (x - t1) / (t2 - t1); };
      var lo = Math.max(0, t1), hi = Math.min(len, t2), far = 2 * tol;
      if (hi - lo < tol) return;
      // keep to the stretch where the two are apart, and by no more than that
      var ok = function (x) { var g = gap(x); return g > -tol && g < far; };
      if (!ok(lo) && !ok(hi)) return;
      for (var n = 0; n < 24 && !ok(lo); n++) lo += (hi - lo) / 24;
      for (n = 0; n < 24 && !ok(hi); n++) hi -= (hi - lo) / 24;
      if (hi - lo < tol) return;
      var back = tol / 2, pt = function (x, out) { return [e.a[0] + ux * x + e.nx * out, e.a[1] + uy * x + e.ny * out]; };
      fill(seals, 'seal', [pt(lo, -back), pt(hi, -back), pt(hi, gap(hi) + back), pt(lo, gap(lo) + back)], colour);   // lapped a little under each side
    }
    var E = V.map(function (A, i) { return inPlay[i] ? edges(A) : null; });
    var boxEdges = [].concat.apply([], boxes().map(function (c) { return edges(c.poly); })).map(function (w) { return { a: w.b, b: w.a, nx: -w.nx, ny: -w.ny }; });   // a wall faces inwards
    V.forEach(function (A, i) {
      if (!inPlay[i]) return;
      var blue = BLUES[pieces[i].blue];
      G.part(C, pieces[i].x, pieces[i].y).walls.forEach(function (w) { fill(hits, 'hit', cut(A, w, true)); });
      var airy = pieces[i].power === 'ghost';   // nothing is filled in round the ghost: it is not drawn as a block
      if (!airy) E[i].forEach(function (e) { boxEdges.forEach(function (f) { seal(e, f, blue); }); });
      for (var j = i + 1; j < V.length; j++) {
        if (!inPlay[j] || Math.hypot(pieces[i].x - pieces[j].x, pieces[i].y - pieces[j].y) > 2.4) continue;
        if (!(spared && spared[0] === i && spared[1] === j)) fill(hits, 'hit', within(A, G.makeContainer(V[j]).walls));   // the ghost's one shared space is no overlap
        if (!airy && pieces[j].power !== 'ghost') E[i].forEach(function (e) { E[j].forEach(function (f) { seal(e, f, blue); }); });
      }
    });
  }
  function eye(on) {
    eyeOn = on;
    board.classList.toggle('eyes', on);
    stage.classList.toggle('eyes', on);   // and the table round the box goes dark, so the white box stands out from it
    if (ghost) $('ghost').setAttribute('d', ghostPath(ghost.type));
    // Safari repaints only the patches it thinks have changed, and after a change this big it
    // leaves stray lines of the old picture behind. Taking the whole board out and putting it
    // straight back makes it paint the lot again.
    bin.style.animation = 'none';   // or putting the board back would fade the box in afresh: the switch is meant to be instant
    board.style.display = 'none'; void board.getBoundingClientRect(); board.style.display = '';
    $('b-eye').setAttribute('aria-pressed', on);
    showHits();
  }
  $('b-eye').addEventListener('click', function () {
    if (coachOn) { coach(false); save.eyeTip = 1; persist(); eye(true); sfx.eyeOn(); return; }   // the one way out of the introduction
    if (level === EYE_LEVEL) return;   // that level is played with it on, and it cannot be put away there
    eye(!eyeOn);
    if (eyeOn) sfx.eyeOn(); else sfx.eyeOff();
    if (!lv.powers) { save.eyes = eyeOn; persist(); }   // and it stays however it was left, from level to level and visit to visit; but not among the powers
  });

  // The eighth level is where eyesight is learnt. The first time, everything dims but its
  // button and a note under it says what it is for; there is no closing that, and pressing
  // the button is the way on. The level is then played with eyesight on, every time, and
  // the button will not turn it off. When that level is packed, or left, eyesight goes off.
  // Everywhere else it is the player's to choose, and it stays as they leave it; except in the
  // chapter of powers, where it hides which shape has which power. There it is for a look and
  // no more: every level starts without it, and what is chosen there is not kept.
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
  function coach(on) { coachOn = on; $('coach').hidden = !on; if (on) { seatCoach(); sfx.chime(); } }
  function offerEyes() {
    clearTimeout(coachTimer);
    if (level !== EYE_LEVEL || save.eyeTip || won) return;
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
    // A shape being carried is put back, at every move of the pointer, to the angle it was picked up at (drag.a0), so that
    // a turn it took on only to sit against something does not stay with it. A turn from the keys is meant: it is kept.
    if (/^[qe[\]{}]$/.test(k)) {
      spin(sel, (k === 'q' || k === '[' || k === '{' ? -1 : 1) * (big ? 15 : 1));
      if (drag && drag.mode === 'move' && drag.i === sel) drag.a0 = p.angle;
      commit(true);
    }
    else if (k === 'arrowleft') dx = -step;
    else if (k === 'arrowright') dx = step;
    else if (k === 'arrowup') dy = -step;
    else if (k === 'arrowdown') dy = step;
    else return;
    e.preventDefault();
    if (dx || dy) {
      startClock();
      if (p.power === 'sticky' && unstick(sel)) sfx.peel();
      p.x += dx; p.y += dy; keepInView(p);
      var S = lv.powers ? solid(p) : pieces;
      G.settle(S, S.indexOf(p), C);
      render(sel); carry(sel); placeHandle(); commit(true);
    }
  });

  /* ---------- powers ---------- */

  // In the second chapter some of the shapes are dealt a power: which shapes, and which
  // powers, is different every time. A power is a face of its own (faces.js) and a rule
  // here. Most have their say when a shape is put down: see react.
  var spared = null;   // the ghost and the one shape it is lying over, when that is how things stand

  // Judge the board. As the geometry does it, but for the ghost: it must overlap one other
  // shape, and when it overlaps exactly one, that overlap counts against neither.
  function evaluate() {
    var n = pieces.length, V = pieces.map(G.verts), st = V.map(function (A) { return { zone: G.zone(A, C), hit: false }; }), hits = [], i, j, packed = 0;
    for (i = 0; i < n; i++) {
      if (st[i].zone === 'out') continue;
      for (j = i + 1; j < n; j++) {
        if (st[j].zone === 'out') continue;
        var o = G.overlap(V[i], V[j]);
        if (o && o.depth > G.EPS) hits.push([i, j]);
      }
    }
    spared = null;
    pieces.forEach(function (p, g) {
      if (p.power !== 'ghost') return;
      var mine = hits.filter(function (h) { return h[0] === g || h[1] === g; });
      if (mine.length === 1) spared = mine[0];
    });
    hits.forEach(function (h) { if (h !== spared) st[h[0]].hit = st[h[1]].hit = true; });
    for (i = 0; i < n; i++) {
      // And the ghost has to be sharing: sitting by itself in a bit of spare room does not count as packed.
      st[i].good = st[i].zone === 'in' && !st[i].hit && (pieces[i].power !== 'ghost' || (!!spared && (spared[0] === i || spared[1] === i))) &&
        !(pieces[i].power === 'chameleon' && pieces[i].form);   // nor does the chameleon in any shape but its own: a smaller one would make room it has no right to
      if (st[i].good) packed++;
    }
    return { states: st, packed: packed, solved: packed === n };
  }

  // Which powers a level gets this time, and which shapes get them: a list as long as the
  // level's shapes, with nothing for a plain one. The ghost is no shape of the level's: it
  // is one more, added at the end, of the same kind as one of them.
  function dealPowers() {
    // The puffer is only any trouble with a crowd round it, so it comes out in the levels with five shapes or more.
    var pool = lv.pool || ['mine', 'ghost', 'sticky', 'chameleon', 'sleeper', 'magnet'].concat(lv.pieces.length >= 5 ? ['puffer'] : []);   // (a level may name the ones it draws from)
    var asked = LOCAL && /[?&]powers=([a-z,]+)/.exec(location.search);   // on this machine, the ones named in the address
    var tied = [].concat.apply([], (lv.twins || []).concat(lv.gears || []));   // entangled shapes are left as they are
    var out = lv.pieces.map(function () { return 0; }), free = shuffled(out.map(function (z, n) { return n; }).filter(function (n) { return tied.indexOf(n) < 0; }));
    var sure = lv.sure || [];   // the ones a level always has; the rest of its powers are drawn
    (asked ? asked[1].split(',') : sure.concat(shuffled(pool.filter(function (w) { return sure.indexOf(w) < 0; })).slice(0, lv.powers - sure.length))).forEach(function (w) {
      if (!POWERS[w]) return;
      if (w === 'ghost') { out.push({ w: w, t: lv.ghost || lv.pieces[Math.floor(Math.random() * lv.pieces.length)] }); return; }   // (a level may say what kind its ghost is)
      if (!free.length) return;
      var n = free.pop(), t = lv.pieces[n];
      // (a level may pin a power to one shape, or to several if it deals the power more than once: each takes the next of them)
      var pinned = lv.pin && lv.pin[w] != null ? [].concat(lv.pin[w]).filter(function (k) { return free.concat(n).indexOf(k) >= 0; })[0] : null;
      var named = w === 'chameleon' && lv.chameleon != null ? lv.chameleon : pinned != null ? pinned : null;
      if (named !== null && free.concat(n).indexOf(named) >= 0) {   // the level says which shape it is
        free = free.concat(n).filter(function (k) { return k !== named; }); n = named; t = lv.pieces[n];
      }
      else if (w === 'puffer') {   // and it is the biggest shape going, which has the most neighbours to shove
        var size = { triangle: 0, square: 1, domino: 2, hexagon: 3 }, big = free.concat(n).sort(function (a, b) { return size[lv.pieces[b]] - size[lv.pieces[a]]; })[0];
        free = free.concat(n).filter(function (k) { return k !== big; }); n = big; t = lv.pieces[n];
      }
      // the chameleon goes round all four shapes, its own first in the list, and may be dealt as any of them
      out[n] = w === 'chameleon' ? { w: w, o: [t].concat(shuffled(Object.keys(TURN).filter(function (k) { return k !== t; }))), n: Math.floor(Math.random() * 4), c: Math.floor(Math.random() * 4) } : { w: w };
    });
    var ghost = out.filter(function (g) { return g && g.w === 'ghost'; });   // last of all, whenever it was drawn
    return out.filter(function (g) { return !g || g.w !== 'ghost'; }).concat(ghost);
  }

  // While a shape with a power is in hand, a card in the strip above the board says what it does: the power's face, its name, and one line.
  var noted = null;
  // Which card is up, if any. When everything is packed but for a chameleon sitting in a shape
  // that is not its own, the card tells that story, whatever is in hand: and that is the only time
  // anything says a chameleon is in the wrong shape. Otherwise the card is for the shape in hand, if that has a power.
  var almost = false;
  function card() {
    if (!lv || !lv.powers) return;
    var p = sel >= 0 ? pieces[sel] : null;
    if (almost) notePower('chameleon', 'Everything fits, but the chameleon is fooling you: it is in disguise! Find its true shape, then pack it to finish.', 'So close!');
    else notePower(p ? p.power || null : null);
  }
  // say: something else for the card to say than what the power does; title: and to be headed, in place of the power's name
  function notePower(w, say, title) {
    var note = $('power-note'), kit = w && POWERS[w], key = w ? w + '|' + (say || '') : null;
    if (key === noted) return;
    noted = key;
    note.hidden = !kit; $('power-idle').hidden = !!kit;
    if (!kit) return;
    var at = kit.tip.indexOf(':'), box = document.createElement('p'), b = document.createElement('b'), rest = kit.tip.slice(at + 1).trim();
    b.textContent = title || kit.name;
    box.appendChild(b); box.appendChild(document.createTextNode(say || rest.charAt(0).toUpperCase() + rest.slice(1)));
    note.classList.toggle('warn', !!say);
    note.textContent = ''; note.appendChild(portrait(kit, kit.color)); note.appendChild(box);
    note.style.animation = 'none'; void note.offsetWidth; note.style.animation = '';   // it hops in afresh for each power
  }

  function pose(p) { return [p.x, p.y, p.angle]; }
  function inPlay(p) { return G.zone(G.verts(p), C) !== 'out'; }
  // the sleeper: asleep, and not to be turned, for as long as it is inside the box
  function asleep(p) { return p.power === 'sleeper' && G.pointInside(C, p.x, p.y); }

  // Sticky keeps where it sits on the shape it is glued to (s.mate), as seen from that shape.
  function setRel(s) {
    var q = pieces[s.mate], r = -q.angle * Math.PI / 180, dx = s.x - q.x, dy = s.y - q.y;
    s.rel = [dx * Math.cos(r) - dy * Math.sin(r), dx * Math.sin(r) + dy * Math.cos(r), s.angle - q.angle];
  }
  // The glue between Sticky and the shape it is stuck to: squeezed out along the join, a line of it with blobs on.
  // It is worked out once, as seen from Sticky (the two do not move against each other while they are stuck), drawn over
  // both shapes, and moved with Sticky. Along each of Sticky's sides, wherever the other shape is within reach of it.
  function gum(s) {
    if (s.power !== 'sticky') return;
    if (s.mate < 0 || !s.rel || !pieces[s.mate]) { if (s.gum) { s.gum.parentNode.removeChild(s.gum); s.gum = null; } return; }
    if (!s.gum) {
      var q = pieces[s.mate], r = -s.rel[2] * Math.PI / 180, c = Math.cos(r), n = Math.sin(r);
      var mine = G.verts({ type: s.type, size: s.size, x: 0, y: 0, angle: 0 });
      var its = G.verts({ type: q.type, size: q.size, x: -(s.rel[0] * c - s.rel[1] * n), y: -(s.rel[0] * n + s.rel[1] * c), angle: -s.rel[2] });
      function near(pt) {   // the nearest place on the other shape's edge
        var best = null, least = Infinity;
        its.forEach(function (a, k) {
          var b = its[(k + 1) % its.length], ex = b[0] - a[0], ey = b[1] - a[1], t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * ex + (pt[1] - a[1]) * ey) / (ex * ex + ey * ey)));
          var x = a[0] + ex * t, y = a[1] + ey * t, d = Math.hypot(pt[0] - x, pt[1] - y);
          if (d < least) { least = d; best = [x, y, d]; }
        });
        return best;
      }
      var g = el('g', 'gum'), d = '', blobs = [], closest = null, STEP = 0.04, count = 0;
      mine.forEach(function (a, k) {
        var b = mine[(k + 1) % mine.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]), on = false;
        for (var t = 0.1; t <= len - 0.1 + 1e-6; t += STEP) {   // short of the corners, so none of it stands out past the join
          var pt = [a[0] + (b[0] - a[0]) * t / len, a[1] + (b[1] - a[1]) * t / len], to = near(pt), mid = [(pt[0] + to[0]) / 2, (pt[1] + to[1]) / 2];
          if (!closest || to[2] < closest[2]) closest = [mid[0], mid[1], to[2]];
          if (to[2] > 0.07) { on = false; continue; }
          d += (on ? 'L' : 'M') + mid[0].toFixed(3) + ' ' + mid[1].toFixed(3);
          if (!on) d += 'L' + mid[0].toFixed(3) + ' ' + mid[1].toFixed(3);
          on = true;
          if (count++ % 4 === 1) blobs.push(mid);
        }
      });
      if (!blobs.length && closest) blobs.push(closest);   // touching at a corner only: one blob there
      if (d) { var line = el('path'); line.setAttribute('d', d); g.appendChild(line); }
      blobs.forEach(function (m, k) {
        var o = el('circle');
        o.setAttribute('cx', m[0].toFixed(3)); o.setAttribute('cy', m[1].toFixed(3)); o.setAttribute('r', [0.06, 0.042, 0.07, 0.05][k % 4]);
        g.appendChild(o);
      });
      $('gums').appendChild(g);
      s.gum = g;
    }
    s.gum.setAttribute('transform', 'translate(' + s.x.toFixed(4) + ' ' + s.y.toFixed(4) + ') rotate(' + s.angle + ')');
  }
  // whatever is glued to shape i goes where it goes, and turns as it turns
  function carry(i) {
    if (!lv.powers) return;
    var q = pieces[i], r = q.angle * Math.PI / 180;
    pieces.forEach(function (s, k) {
      if (s.power !== 'sticky' || s.mate !== i || !s.rel) return;
      s.x = q.x + s.rel[0] * Math.cos(r) - s.rel[1] * Math.sin(r); s.y = q.y + s.rel[0] * Math.sin(r) + s.rel[1] * Math.cos(r); s.angle = q.angle + s.rel[2];
      keepInView(s); render(k);
    });
  }
  // shape i comes unstuck: from what it was glued to, and from anything glued to it
  function unstick(i) {
    var freed = false;
    pieces.forEach(function (s, k) {
      if (s.power === 'sticky' && s.mate >= 0 && (k === i || s.mate === i)) { s.mate = -1; s.rel = null; s.el.classList.remove('glued'); gum(s); freed = true; }
    });
    return freed;
  }
  // What a shape being moved can come to rest against. Nothing rests against the ghost, the
  // ghost rests against nothing but the walls, and a shape does not bump into its own passenger.
  function solid(p) {
    var i = pieces.indexOf(p);
    return p.power === 'ghost' ? [p] : pieces.filter(function (q) { return q === p || (q.power !== 'ghost' && !(q.power === 'sticky' && q.mate === i)); });
  }
  // The ghost, carried over a shape of its own kind at about the same angle, drops exactly onto it.
  function onto(p) {
    return pieces.some(function (q) {
      if (q === p || q.type !== p.type || !inPlay(q) || Math.hypot(q.x - p.x, q.y - p.y) > 0.3 || Math.abs(off(q.angle, p.angle, p.type)) > 20) return false;
      p.x = q.x; p.y = q.y; p.angle += off(q.angle, p.angle, p.type);
      return true;
    });
  }
  // The chameleon turns into its next shape, and its next colour. It is drawn afresh.
  function morph(p, i) {
    p.form = (p.form + 1) % p.forms.length; p.type = p.forms[p.form]; p.color = CHAM[(p.form + p.tint) % CHAM.length]; p.side = null;
    // Sticky, glued to it, lets go if the new shape no longer reaches it.
    pieces.forEach(function (s, k) {
      if (s.power === 'sticky' && s.mate === i && !G.overlap(grown(G.makeContainer(G.verts(s)), 0.03), G.verts(p))) { unstick(k); sfx.peel(); }
      else if (s.power === 'sticky' && s.mate === i && s.gum) { s.gum.parentNode.removeChild(s.gum); s.gum = null; gum(s); }   // still stuck, along another join
    });
    layer.removeChild(p.el); p.under.parentNode.removeChild(p.under);
    buildPiece(p, i);
    p.el.classList.remove('fresh');
    render(i);
    sfx.morph();
  }
  // The mine's fuse: lit when it is picked up, and out again the moment it is put down. It counts three,
  // two, one, but the three is gone in half a second: there are really two and a half seconds.
  var FUSE = 2500;
  function light(p) { p.fuse = FUSE; p.shown = Math.ceil(FUSE / 1000); p.el.classList.add('lit'); p.badge.textContent = p.shown; sfx.fuse(p.shown); burn(p); }
  function quench(p) { p.fuse = 0; p.el.classList.remove('lit'); p.badge.textContent = ''; burn(p); }
  // The fuse is drawn as long as it has left to burn, with the spark at its end: whole when it is not lit.
  function burn(p) {
    var line = p.el.querySelector('.fuse'), spark = p.el.querySelector('.spark'), left = p.fuse > 0 ? p.fuse / FUSE : 1;
    var at = line.getPointAtLength(line.getTotalLength() * left);
    line.setAttribute('stroke-dasharray', left.toFixed(3) + ' 1');
    spark.setAttribute('transform', 'translate(' + at.x.toFixed(4) + ' ' + at.y.toFixed(4) + ')');
    repaint(p);
  }

  // Shapes that move by themselves: from where each was, to where it now is, over ms.
  // Nothing can be picked up meanwhile.
  function glide(from, ms, done) {
    var crowd = pieces, to = pieces.map(pose), start = performance.now();
    shaking = true;
    (function frame(t) {
      if (crowd !== pieces) { shaking = false; return; }   // another level has been dealt
      var k = ms ? Math.min(1, Math.max(0, (t - start) / ms)) : 1, e = 1 - Math.pow(1 - k, 3);
      pieces.forEach(function (p, i) {
        if (to[i][0] === from[i][0] && to[i][1] === from[i][1] && to[i][2] === from[i][2]) return;
        p.x = from[i][0] + (to[i][0] - from[i][0]) * e; p.y = from[i][1] + (to[i][1] - from[i][1]) * e;
        p.angle = k < 1 ? from[i][2] + Math.round((to[i][2] - from[i][2]) * e) : to[i][2];
        if (k === 1) { p.x = to[i][0]; p.y = to[i][1]; }
        render(i);
      });
      if (k < 1) { requestAnimationFrame(frame); return; }
      shaking = false;
      placeHandle(); done();
    })(start);
  }
  // does any part of an outline come within r of a point?
  function reaches(V, x, y, r) {
    return V.some(function (a, k) {
      var b = V[(k + 1) % V.length], ex = b[0] - a[0], ey = b[1] - a[1], u = clamp(((x - a[0]) * ex + (y - a[1]) * ey) / (ex * ex + ey * ey), 0, 1);
      return Math.hypot(a[0] + ex * u - x, a[1] + ey * u - y) <= r;
    });
  }
  // The magnet is only a magnet in the hand. While it is held (carried, or turned by its knob), waves
  // stand round it out to its reach, and every shape inside them is drawn towards it, a little at a time,
  // until something stops it. Put the magnet down and it lets go of everything.
  var REACH = 1.6, waves = null, tugged = false;
  // And it hums for as long as it is held: a low mains buzz, three notes stacked on one another and
  // made to flutter. It is the one sound here that goes on, so it is made in place and not in sounds.js.
  var humming = null;
  function hum(on) {
    if (!on) {
      if (!humming) return;
      var h = humming; humming = null;
      try { h.out.gain.cancelScheduledValues(h.ctx.currentTime); h.out.gain.setTargetAtTime(0.0001, h.ctx.currentTime, 0.03); h.all.forEach(function (o) { o.stop(h.ctx.currentTime + 0.2); }); } catch (e) {}
      return;
    }
    if (humming || !actx || actx.state !== 'running') return;
    var t = actx.currentTime, out = actx.createGain(), all = [];
    out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(0.05, t + 0.1);
    [[60, 'sawtooth', 1], [120, 'square', 0.45], [180, 'triangle', 0.5]].forEach(function (n) {
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = n[1]; o.frequency.value = n[0]; g.gain.value = n[2];
      o.connect(g); g.connect(out); o.start(t); all.push(o);
    });
    var flutter = actx.createOscillator(), depth = actx.createGain();   // the buzz in it: the loudness wobbling thirty times a second
    flutter.frequency.value = 30; depth.gain.value = 0.02;
    flutter.connect(depth); depth.connect(out.gain); flutter.start(t); all.push(flutter);
    out.connect(actx.destination);
    humming = { ctx: actx, out: out, all: all };
  }
  function attract() {
    var i = -1;
    if (lv && lv.powers && drag && !won && !shaking) pieces.forEach(function (p, k) { if (p.power === 'magnet' && (drag.mode === 'move' ? drag.i : sel) === k) i = k; });
    if (i < 0) { if (waves) { waves.parentNode.removeChild(waves); waves = null; tugged = false; } hum(false); return; }
    hum(!save.mute);
    var m = pieces[i], any = false;
    if (!waves) {
      waves = el('g', 'waves');
      [0.45, 0.72, 1].forEach(function (k, n) { var c = el('circle', 'wave w' + n); c.setAttribute('r', REACH * k); waves.appendChild(c); });
      board.insertBefore(waves, layer);
    }
    waves.setAttribute('transform', 'translate(' + m.x.toFixed(4) + ' ' + m.y.toFixed(4) + ')');
    pieces.map(function (q, j) { return j; }).filter(function (j) {
      var q = pieces[j];
      return j !== i && q.power !== 'ghost' && !(q.power === 'sticky' && q.mate >= 0) && reaches(G.verts(q), m.x, m.y, REACH);   // any part of it inside the waves
    }).sort(function (a, b) {
      return Math.hypot(pieces[a].x - m.x, pieces[a].y - m.y) - Math.hypot(pieces[b].x - m.x, pieces[b].y - m.y);   // the nearest first, so those behind close up after it
    }).forEach(function (j) {
      var q = pieces[j], dx = m.x - q.x, dy = m.y - q.y, d = Math.hypot(dx, dy), A = G.verts(q), t = Infinity;
      if (d < 1e-6) return;
      dx /= d; dy /= d;
      // What it is resting against must not hold it back unless it is being pulled into it: a shape
      // snapped to a neighbour touches it, and a touch counts as a stop whichever way it is going.
      // So the way is felt out with the shape drawn a hair small, and then it backs off until it is clear.
      var slim = grown(G.makeContainer(A), -0.012), stops = [];
      pieces.forEach(function (b, k) { if (k !== j && b.power !== 'ghost' && !(b.power === 'sticky' && b.mate === j)) stops.push(G.verts(b)); });
      stops.forEach(function (B) { t = Math.min(t, G.sweep(slim, B, dx, dy)); });
      t = Math.min(t, d, 0.07);   // so far each time, which is a steady slide and no jump
      var clash = function (by) {
        var V = A.map(function (v) { return [v[0] + dx * by, v[1] + dy * by]; });
        return stops.some(function (B) { var o = G.overlap(V, B); return o && o.depth > G.EPS; });
      };
      if (clash(0)) return;   // already in something's way: it is not pulled deeper
      if (clash(t)) {
        for (var lo = 0, hi = t, n = 0; n < 16; n++) { var mid = (lo + hi) / 2; if (clash(mid)) hi = mid; else lo = mid; }
        t = lo;
      }
      if (t < 0.004) return;
      q.x += dx * t; q.y += dy * t; keepInView(q); carry(j); render(j);
      any = true;
    });
    if (any) { if (!tugged) { tugged = true; sfx.pull(); } judge(); }
  }
  setInterval(attract, 40);
  // the puffer, puffing
  function swell(p) {
    if (calm) return;
    var crowd = pieces, start = performance.now();
    (function frame(t) {
      if (crowd !== pieces) return;
      var k = (t - start) / 420;
      if (k >= 1) { p.pop.removeAttribute('transform'); return; }
      if (k > 0) p.pop.setAttribute('transform', 'scale(' + (1 + 0.28 * Math.sin(k * Math.PI)).toFixed(3) + ')');
      requestAnimationFrame(frame);
    })(start);
  }

  // A shape has been put down, or turned. The powers have their say, in this order: the
  // puffer, then Sticky, then the mine's fuse. If any shape is moved
  // by them this returns true, and the move is judged once they have all come to rest.
  function react() {
    var from = pieces.map(pose), noise = {}, ev = evaluate();

    // The puffer puffs up whenever it is put down in the box, and shoves away every shape it is
    // touching: so it has to go in before its neighbours do. A shape put down on top of it is shoved off too.
    pieces.forEach(function (p, i) {
      if (p.power !== 'puffer' || !inPlay(p)) return;
      var A = G.verts(p), skin = grown(G.makeContainer(A), 0.04), any = false;
      pieces.forEach(function (q, j) {
        if (j === i || q.power === 'ghost' || !inPlay(q)) return;
        var o = G.overlap(i === sel ? skin : A, G.verts(q));   // its own move: a touch is enough. Another's: only if it is lying over it
        if (!o || (i !== sel && o.depth < 0.03)) return;
        var dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
        if (d < 1e-6) { var a = Math.random() * 6.283; dx = Math.cos(a); dy = Math.sin(a); d = 1; }
        unstick(j);
        q.x += dx / d * 0.55; q.y += dy / d * 0.55; keepInView(q);
        any = true;
      });
      if (any) { noise.puff = 1; swell(p); }
    });

    var moved = pieces.some(function (p, i) { return p.x !== from[i][0] || p.y !== from[i][1] || p.angle !== from[i][2]; });

    // Sticky, in the box and glued to nothing, glues itself to the nearest shape it is touching.
    pieces.forEach(function (s, i) {
      if (s.power !== 'sticky' || s.mate >= 0 || !inPlay(s)) return;
      var skin = grown(G.makeContainer(G.verts(s)), 0.03), best = -1, least = Infinity;
      pieces.forEach(function (q, j) {
        if (j === i || q.power === 'ghost' || !inPlay(q) || !G.overlap(skin, G.verts(q))) return;
        var d = Math.hypot(q.x - s.x, q.y - s.y);
        if (d < least) { least = d; best = j; }
      });
      if (best < 0) return;
      s.mate = best; setRel(s); s.el.classList.add('glued'); gum(s); noise.glue = 1;
    });

    // The mine, put down where it fits, goes out.
    ev = evaluate();
    pieces.forEach(function (p, i) { if (p.fuse > 0 && ev.states[i].good) { quench(p); noise.fizz = 1; } });

    Object.keys(noise).forEach(function (k) { sfx[k](); });
    if (!moved) return false;
    glide(from, calm ? 0 : 280, function () { commit(true, true); });
    return true;
  }

  // The mine goes off. It, and every shape it is touching, is thrown out of the box.
  function boom(i) {
    var p = pieces[i], from = pieces.map(pose);
    quench(p);
    if (drag) {   // whatever was in hand is let go of
      if (drag.mode === 'move') pieces[drag.i].el.classList.remove('held'); else { handle.classList.remove('spin'); bubble.classList.remove('show'); }
      drag = null; pending = null;
    }
    var skin = grown(G.makeContainer(G.verts(p)), 0.06);
    pieces.forEach(function (q, j) {
      if (j !== i && !G.overlap(skin, G.verts(q))) return;
      var spot = traySpot();
      unstick(j); q.x = spot[0]; q.y = spot[1]; standOff(q);
      if (q.fuse > 0) quench(q);
    });
    select(-1);
    sfx.boom(); haptic();
    var r = board.getBoundingClientRect();
    burst(r.left + (from[i][0] - view.x) * view.scale, r.top + (from[i][1] - view.y) * view.scale, 36);
    glide(from, calm ? 0 : 420, function () { commit(true, true); });
  }
  // The fuses burn while a mine is held and the level is being played: not behind a sheet, nor while shapes are flying.
  setInterval(function () {
    if (!lv || !lv.powers || won || shaking || document.hidden || document.querySelector('.sheet.open')) return;
    pieces.forEach(function (p, i) {
      if (!(p.fuse > 0) || shaking) return;
      // The fuse only burns in the hand: while the mine is being carried, or turned by its knob or with
      // two fingers. Let go of it, anywhere at all, and it goes out.
      if (!(drag && (drag.mode === 'move' ? drag.i : sel) === i)) { if (p.fuse < FUSE - 400) sfx.fizz(); quench(p); return; }
      p.fuse -= 100;
      if (p.fuse <= 0) { boom(i); return; }
      burn(p);
      var left = Math.ceil(p.fuse / 1000);
      if (left !== p.shown) { p.shown = left; p.badge.textContent = left; sfx.fuse(left); }
    });
  }, 100);

  /* ---------- levels ---------- */

  // fresh: deal the pieces out again even if a half-packed board was saved.
  function startLevel(i, fresh) {
    level = i; lv = LEVELS[i];
    coach(false); clearTimeout(coachTimer);
    var was = save.done[lv.name];
    $('best').hidden = !was;
    if (was) $('best').textContent = 'Your best: ' + clock(was.t) + ' · ' + was.m + (was.m === 1 ? ' move' : ' moves');
    C = lv.containers ? G.makeBoxes(lv.containers) : G.makeContainer(lv.container); cb = G.bounds(lv.container);
    clearTimeout(partyTimer); $('finale').classList.remove('show'); $('grand').classList.remove('show'); shareAll = false;
    $('go-next').hidden = true; dock.classList.remove('won');
    won = false; drag = null; sel = -1; dirty = false; moves = 0; t0 = 0; elapsed = 0; carried = 0;
    clearInterval(ticker);
    stuck = false; $('b-hint').classList.remove('nag');
    syms = symmetries(lv.container); showGhost(null);
    save.last = lv.name; persist();

    var ch = chap(lv);
    $('lv-word').textContent = ch ? 'Ch ' + (ch + 1) + ' \u00B7' : 'Level';
    $('lv-num').textContent = among(i);
    $('lv-of').textContent = chapSize(ch);
    document.body.classList.toggle('powers', !!lv.powers);   // the chapter of powers is played at night
    document.body.classList.toggle('twists', !!lv.twist);   // and the chapter of twists on squared paper
    $('ribbon').setAttribute('hidden', '');
    $('lv-name').textContent = lv.name;
    $('lv-intro').textContent = lv.intro;
    $('clock').textContent = '0:00';
    var title = $('title');
    title.classList.remove('swap'); void title.offsetWidth; title.classList.add('swap');

    bin.setAttribute('class', '');
    bin.style.animation = 'none'; void bin.getBoundingClientRect(); bin.style.animation = '';

    layer.textContent = ''; $('seams').textContent = ''; $('seals').textContent = ''; $('gums').textContent = '';
    var colors = shuffled(COLORS), kits = shuffled(OUTFITS), pips = $('pips');
    pips.textContent = '';
    pieces = lv.pieces.map(function (type, n) {
      var pip = document.createElement('i');
      if (type !== 'square') pip.className = type.charAt(0);
      pip.kind = type;
      pips.appendChild(pip);
      return { type: type, size: 1, x: 0, y: 0, angle: 0, color: kits[n % kits.length].color || colors[n % colors.length], kit: kits[n % kits.length], good: false };
    });
    // Entangled shapes come in sets (twins), the shapes of a set alike: one colour, one face. Each keeps its angle
    // from the others for good: the difference between the spots they have in the solution. In a geared
    // set (gears) each shape after the first turns against the first, and it is their sum that is kept.
    [[lv.twins || [], 1], [lv.gears || [], -1]].forEach(function (kind) {
      kind[0].forEach(function (set) {
        var sign = set.map(function (n, k) { return k ? kind[1] : 1; });
        set.forEach(function (i, a) {
          pieces[i].kit = pieces[set[0]].kit; pieces[i].color = pieces[set[0]].color;
          pieces[i].kin = [];
          if (lv.divide != null) pieces[i].half = lv.solution[i][0] < lv.divide ? -1 : 1;
          set.forEach(function (j, b) {
            if (j === i) return;
            var s = sign[a] * sign[b];   // q turns s times as p does, and q.angle - s * p.angle stays at k
            pieces[i].kin.push({ i: j, s: s, k: lv.solution[j][2] - s * lv.solution[i][2] });
          });
        });
      });
    });
    var kept = save.board;
    if (lv.powers) {
      (!fresh && kept && kept.l === lv.name && kept.q && kept.q.every(function (g) { return !g || POWERS[g.w]; }) ? kept.q : dealPowers()).forEach(function (g, n) {   // a board saved with a power there no longer is, is dealt afresh
        if (!g) return;
        var p = pieces[n];
        if (!p) {   // the ghost: one shape more than the level has
          p = pieces[n] = { type: g.t, size: 1, x: 0, y: 0, angle: 0, good: false };
          var pip = document.createElement('i');
          if (g.t !== 'square') pip.className = g.t.charAt(0);
          pip.kind = g.t;
          pips.appendChild(pip);
        }
        p.power = g.w; p.kit = POWERS[g.w]; p.color = p.kit.color;
        if (g.w === 'chameleon') {
          p.forms = g.o; p.form = g.n; p.tint = g.c; p.type = p.forms[p.form]; p.color = CHAM[(p.form + p.tint) % CHAM.length];
          // Nothing may say which shape is its own. Its place in the row of shapes would, so that is
          // taken out, and a blank one with a question mark goes on the end.
          var mark = pips.children[n]; mark.className = 'q'; mark.kind = '?'; pips.appendChild(mark);
        }
        if (g.w === 'sticky') { p.mate = g.m == null ? -1 : g.m; p.rel = g.r || null; }
      });
    }
    layout();
    if (!fresh && kept && kept.l === lv.name && kept.p && kept.p.length === pieces.length) {
      pieces.forEach(function (p, n) { p.x = kept.p[n][0]; p.y = kept.p[n][1]; p.angle = kept.p[n][2]; keepInView(p); });
      moves = kept.m || 0; carried = kept.t || 0;
      $('clock').textContent = clock(carried);
    } else {
      scatter(); sfx.deal(pieces.length);
      pieces.forEach(function (p, n) { (p.kin || []).forEach(function (k) { if (k.i > n) pieces[k.i].angle = k.s * p.angle + k.k; }); });
    }
    pieces.forEach(function (p, n) { buildPiece(p, n); render(n); });
    tether();
    notePower(null); countHints();
    if (masked()) $('lv-intro').textContent = 'One of these is a chameleon in disguise. Its true shape is for you to find.';   // the usual line would count the shapes out
    judge(); showAngle(); placeHandle(); nag();
    lookForShake();
    if (i === EYE_LEVEL) {
      if (save.eyes) { save.eyes = false; persist(); }   // whatever was chosen before, the level after this one starts without it
      if (save.eyeTip) eye(true); else { eye(false); coachTimer = setTimeout(offerEyes, 900); }
    } else eye(!lv.powers && !!save.eyes);   // as it was left; but a level of powers always starts without it, so the powers are seen first
    if (i === EYE_LEVEL) $('b-eye').removeAttribute('data-tip'); else $('b-eye').setAttribute('data-tip', 'Eyesight');   // no label where it cannot be changed
  }

  /* ---------- shake ---------- */

  // After each move, quietly check whether a shake would finish the board
  // (every piece within a hair and a degree of a solved spot). If it would,
  // the box shakes itself.
  function lookForShake() {
    clearTimeout(shakeTimer);
    shakeTimer = setTimeout(function () {
      if (won || drag || shaking) return;
      if (evaluate().solved) return;
      // The shake works on the shapes that take up room. The ghost is left out of it, and then
      // goes along with the shape it is lying over; the box is only shaken if that leaves it packed too.
      var real = pieces.filter(function (p) { return p.power !== 'ghost'; }), got = G.shake(real, C, 150);
      if (!got) return;
      var to = pieces.map(function (p) {
        if (p.power !== 'ghost') return got[real.indexOf(p)];
        var under = real.filter(function (q) { return q.type === p.type && Math.hypot(q.x - p.x, q.y - p.y) < 0.25 && Math.abs(off(q.angle, p.angle, p.type)) < 6; })[0];
        return under ? { x: got[real.indexOf(under)].x, y: got[real.indexOf(under)].y, angle: p.angle + off(got[real.indexOf(under)].angle, p.angle, p.type) } : { x: p.x, y: p.y, angle: p.angle };
      });
      // The shake only knows the plain rules. If the board would still not count as packed after it
      // (a chameleon in the wrong shape, a ghost sharing with nobody), there is no shake: or it
      // would shake, find nothing finished, and shake again, for ever.
      var was = pieces.map(pose);
      pieces.forEach(function (p, i) { p.x = to[i].x; p.y = to[i].y; p.angle = to[i].angle; });
      var fine = evaluate().solved && pieces.every(function (p) { return (p.kin || []).every(function (k) { return pieces[k.i].angle - k.s * p.angle === k.k; }); });   // (and no twin is turned without the other)
      pieces.forEach(function (p, i) { p.x = was[i][0]; p.y = was[i][1]; p.angle = was[i][2]; });
      if (!fine) return;
      shake(to);
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

  // the solution's spots, turned or flipped one of the ways the box allows
  function slotsFor(t) {
    return lv.solution.map(function (s, i) {
      return { type: lv.pieces[i], x: t.m * s[0] * t.c - s[1] * t.s, y: t.m * s[0] * t.s + s[1] * t.c, angle: norm(t.m * s[2] + t.r) };
    });
  }
  // is there a chameleon in this deal? Then nothing may say what shapes the level is made of.
  function masked() { return !!lv.powers && pieces.some(function (p) { return p.power === 'chameleon'; }); }
  // is this shape already sitting in one of the solution's spots, in any turn of it?
  function slotsNear(p) { return syms.some(function (t) { return slotsFor(t).some(function (s) { return near(p, s, 0.15, 3); }); }); }
  // roughly where in the box the chameleon's spot is, in words
  function whereabouts() {
    var n = -1;
    pieces.forEach(function (p, k) { if (p.power === 'chameleon') n = k; });
    var s = lv.solution[n], u = (s[0] - cb.minX) / (cb.maxX - cb.minX), v = (s[1] - cb.minY) / (cb.maxY - cb.minY);
    var row = v < 0.38 ? 'top' : v > 0.62 ? 'bottom' : '', col = u < 0.38 ? 'left' : u > 0.62 ? 'right' : '';
    return row && col ? 'at the ' + row + ' ' + col : row ? 'at the ' + row : col ? 'on the ' + col : 'in the middle';
  }
  // An empty spot from the solution, for one piece that is not packed yet.
  function pickSpot() {
    var best = null;
    syms.forEach(function (t) {
      var slots = slotsFor(t);
      // A spot is taken once the right shape is sitting in it, whether or not that shape is happy:
      // one being squashed by a stray neighbour is still where it belongs.
      var open = slots.filter(function (s) { return !pieces.some(function (p) { return near(p, s, 0.15, 3); }); });
      if (!best || open.length < best.length) best = open;
    });
    // With a chameleon about, no spot may be shown that only it could fill, or the outline would
    // give away its real shape. So a spot is on offer only while a plain shape of that kind is
    // still waiting to go in. (It also keeps the hint off the ghost, which has no spot at all.)
    if (masked()) {
      best = best.filter(function (s) {
        return pieces.some(function (p) { return !p.power && p.type === s.type && !slotsNear(p); });
      });
    }
    var packed = pieces.filter(function (p) { return p.good; }).map(G.verts);
    var clear = best.filter(function (s) {
      var V = G.verts(s);
      return !packed.some(function (B) { var o = G.overlap(V, B); return o && o.depth > G.EPS; });
    });
    return clear[0] || best[0] || null;
  }
  // The hinted spot is drawn like the shapes round it: a soft dashed outline as a rule, and
  // under eyesight the shape's true outline in one flat colour, with no line.
  function ghostPath(type) { return eyeOn ? loop(G.SHAPES[type]) : drawn(type); }
  function showGhost(s) {
    var e = $('ghost');
    ghost = s;
    e.toggleAttribute('hidden', !s);
    if (!s) return;
    e.setAttribute('d', ghostPath(s.type));
    e.setAttribute('transform', 'translate(' + s.x.toFixed(4) + ' ' + s.y.toFixed(4) + ') rotate(' + s.angle + ')');
  }
  // The hinted spot pulls the right kind of piece into it: carried anywhere
  // near, at anything like the right angle, the piece jumps exactly into place.
  function intoGhost(i) {
    var p = pieces[i];
    if (!ghost || !near(p, ghost, 0.34, 25)) return false;
    var x = p.x, y = p.y, a = p.angle, by = off(ghost.angle, p.angle, p.type);
    p.x = ghost.x; p.y = ghost.y; p.angle += by;
    if (evaluate().states[i].good) { turnTwin(p, by); return true; }
    p.x = x; p.y = y; p.angle = a;
    return false;
  }
  // The hint stays up until a piece is sitting exactly in it. One lying over
  // it crooked, or a little to one side, does not count.
  function seatGhost() {
    if (!ghost) return;
    if (sel >= 0 && intoGhost(sel)) { render(sel); showAngle(); placeHandle(); }
    if (pieces.some(function (p) { return near(p, ghost, 0.004, 0.5); })) showGhost(null);
  }

  function win() {
    won = true;
    if (level === EYE_LEVEL) eye(false);   // the eyesight level is over: the shapes get their faces back for the party
    countMove();
    clearTimeout(shakeTimer);
    pieces.forEach(function (p) { if (p.fuse > 0) quench(p); });
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
    // The whole game, the first time the last of its levels is packed, whichever level that is: that is the big one. The seventeenth has a party of its own, a smaller one.
    var whole = !save.finished && LEVELS.every(function (l) { return save.done[l.name]; });
    if (whole) { save.finished = true; persist(); finale = false; }
    confetti(whole ? 320 : finale ? 190 : again && !faster ? 50 : 150);
    setTimeout(function () { if (won) tieRibbon(); }, calm ? 0 : 550);

    var all = LEVELS.every(function (l) { return chap(l) || save.done[l.name]; }), total = { t: 0, m: 0 };
    if (all) LEVELS.forEach(function (l) { if (!chap(l)) { total.t += save.done[l.name].t; total.m += save.done[l.name].m; } });
    if (whole) { total = { t: 0, m: 0 }; LEVELS.forEach(function (l) { total.t += save.done[l.name].t; total.m += save.done[l.name].m; }); }   // of every level there is
    $('finale-sum').textContent = 'That was the hard one.';
    $('grand-sum').textContent = 'All ' + LEVELS.length + ' levels: ' + clock(total.t) + ' · ' + total.m + ' moves';
    if (whole) grand(); else if (finale) party();
    $('win-all').hidden = !(whole || (all && level === MAIN - 1)); $('win-one').hidden = !$('win-all').hidden;   // the last win shows the totals alone
    shareAll = whole; $('win-share').classList.toggle('star', whole);   // and its way on is to tell somebody
    $('all-time').textContent = clock(total.t);
    $('all-moves').textContent = total.m;
    $('win-title').textContent = whole ? 'Packman!' : finale ? 'Seventeen!' : faster ? 'New best!' : PRAISE[Math.floor(Math.random() * PRAISE.length)];
    $('win-sub').textContent = whole ? 'You\u2019ve finished the game: all ' + LEVELS.length + ' levels, packed. Go on, tell somebody.'
      : finale ? 'This was a hard one. Congrats on finishing it!'
      : faster ? lv.name + ', packed ' + clock(prev.t - elapsed) + ' faster than your best.'
      : again ? lv.name + ', packed again. Your best is still ' + clock(prev.t) + '.'
      : label(level) + ', ' + lv.name + ', is all packed up.';
    if (finale) {   // two sentences, each kept whole: where both will not go on a line, the second goes under the first
      $('win-sub').textContent = '';
      ['This was a hard one.', ' ', 'Congrats on finishing it!'].forEach(function (s) { var e = s === ' ' ? document.createTextNode(s) : document.createElement('span'); if (s !== ' ') { e.className = 'whole'; e.textContent = s; } $('win-sub').appendChild(e); });
    }
    $('win-best').parentNode.classList.toggle('new', faster);
    $('win-time').textContent = clock(elapsed);
    $('win-moves').textContent = moves;
    $('win-best').textContent = clock(best);
    $('win-fact').hidden = !lv.fact;
    $('win-fact').textContent = lv.fact || '';
    $('win-next').hidden = level === LEVELS.length - 1;
    // once the win sheet is put away, the way on stays in the bar at the bottom
    $('go-next').hidden = level === LEVELS.length - 1; dock.classList.add('won');
    setTimeout(function () { if (won) openSheet($('m-win')); }, calm ? (whole ? 3200 : 200) : whole ? 6600 : finale ? 3300 : again ? 1250 : 1700);
  }

  // The last box of the seventeen gets a banner, a handful of fireworks and one more wave from the pieces.
  // (It had the works once. They are kept now for the end of the whole game: see grand.)
  var partyTimer = 0, shareAll = false;
  function party() {
    var banner = $('finale');
    banner.classList.add('show');
    setTimeout(function () { banner.classList.remove('show'); }, calm ? 2400 : 3000);
    if (calm) return;
    if (navigator.vibrate && touchy) { try { navigator.vibrate([30, 60, 30]); } catch (e) {} }
    rockets(5, 34, 360);
  }
  // Fireworks, one after another, all over the top of the screen.
  function rockets(many, size, gap, waves) {
    var n = 0;
    (function rocket() {
      if (!won || n >= many) return;
      burst(innerWidth * (0.12 + Math.random() * 0.76), innerHeight * (0.12 + Math.random() * 0.45), size);
      sfx.pop();
      if (n % 4 === 3) { if (waves) confetti(70); cheer(); }
      n++;
      partyTimer = setTimeout(rocket, gap + Math.random() * 220);
    })();
  }

  // The end of the whole game gets the works. A card comes up over the board with the game's name on it; every kind of
  // shape, each with a face, runs in from off the screen, gathers round the name and bounces there; a fanfare plays, and
  // fireworks go off over the lot. Then the win sheet, whose way on is to tell somebody.
  var HUES = ['#FF6B6B', '#FFC93C', '#3DDBB4', '#4DA8FF', '#9B7BFF', '#FF8FCB', '#FF9F45', '#B5E655', '#45D9E6', '#D987F5', '#FFB59E'];
  function grand() {
    var card = $('grand'), svg = $('grand-crowd'), E = PackmanPiece.el, name = $('grand-name'), logo = document.querySelector('.logo');
    // a square of the crowd, in pixels: so that the name and a ring of shapes round it fit the screen, upright or on its side
    var unit = Math.min(innerWidth / 8.2, innerHeight / 9.5, 96), W = innerWidth / unit, Hh = innerHeight / unit, tall = Hh > W;
    card.style.setProperty('--s', (unit * (tall ? 0.92 : 0.95)).toFixed(1) + 'px');
    name.textContent = ''; name.appendChild(logo.querySelector('svg').cloneNode(true)); name.appendChild(logo.querySelector('.word').cloneNode(true));
    svg.textContent = '';
    svg.setAttribute('viewBox', [-W / 2, -Hh / 2, W, Hh].map(function (v) { return v.toFixed(3); }).join(' '));
    svg.style.setProperty('--u', (1 / unit).toFixed(5));
    var faces = shuffled(PackmanFaces.filter(function (k) { return !k.color; })), many = tall ? 12 : 16;
    var rx = Math.min(W / 2 - 0.8, 5.9), ry = Math.min(Hh / 2 - 1.1, tall ? 5.2 : 3.55);
    for (var n = 0; n < many; n++) {
      // round an oval, the long shapes kept to its top and bottom where there is room for them beside the name
      var a = (n + 0.5) / many * 2 * Math.PI, up = Math.abs(Math.sin(a)), x = rx * Math.cos(a), y = ry * Math.sin(a) + (tall ? 0.15 : 0.1);
      var type = up > 0.8 ? (n % 2 ? 'domino' : 'hexagon') : n % 2 ? 'triangle' : 'square';
      if (up > 0.55 && up <= 0.8 && !tall) y *= 1.08;
      var at = E('g', '', { transform: 'translate(' + x.toFixed(3) + ' ' + y.toFixed(3) + ') rotate(' + Math.round((Math.random() - 0.5) * 34) + ')' });
      var run = E('g', 'in'), hop = E('g', 'hop piece good');
      // from where it runs in: out past the edge of the screen, the way it lies from the middle
      var far = Math.max(W, Hh) * 0.75 / Math.hypot(x, y);
      run.style.setProperty('--n', n); run.style.setProperty('--fx', (x * far).toFixed(2)); run.style.setProperty('--fy', (y * far).toFixed(2));
      run.style.setProperty('--spin', (n % 2 ? 300 : -300) + 'deg');
      hop.style.setProperty('--n', n); hop.style.setProperty('--c', HUES[n % HUES.length]); hop.style.setProperty('--lean', (n % 2 ? 7 : -7) + 'deg');
      hop.appendChild(E('path', 'fill', { d: drawn(type, 1 / unit) }));
      hop.appendChild(PackmanPiece.face(faces[n % faces.length], type).face);
      run.appendChild(hop); at.appendChild(run); svg.appendChild(at);
    }
    card.classList.add('show');
    setTimeout(function () { card.classList.remove('show'); }, calm ? 3000 : 6200);
    if (calm) return;
    sfx.deal(9);
    setTimeout(function () { if (won) { sfx.fanfare(); confetti(150); } }, 900);
    if (navigator.vibrate && touchy) { try { navigator.vibrate([30, 60, 30, 60, 30, 60, 120]); } catch (e) {} }
    setTimeout(function () { rockets(14, 38, 260, true); }, 700);
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
    if (calm || eyeOn) return;   // under eyesight the shapes are a diagram, and a diagram does not hop
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
  function openSheet(s) { if (!s.classList.contains('open')) sfx.open(); s.classList.add('open'); var b = s.querySelector('.btn.go:not([hidden])') || s.querySelector('.btn:not([hidden])'); if (b) setTimeout(function () { b.focus({ preventScroll: true }); }, 60); }
  // 'How to pack' counts as seen only once it is closed, so a load nobody looked at does not use it up
  function closeSheet(s) {
    if (s.id === 'm-name' && nameless()) return wanted();   // no way out of it without a name
    if (s.classList.contains('open')) sfx.close();
    s.classList.remove('open');
    if (s.id === 'm-help' && !save.seen) { save.seen = true; persist(); }
    if (s.id === 'm-name') named();
  }
  Array.prototype.forEach.call(document.querySelectorAll('.sheet'), function (s) {
    s.addEventListener('click', function (e) { if (e.target === s || e.target.hasAttribute('data-close')) closeSheet(s); });
  });

  // 'Show a spot' is on offer ten times a chapter, to spend on whichever of its levels they are
  // wanted. A chapter that is short of its ten gets one back every eight hours. What is kept for a
  // chapter is how many it has (n), and when the eight hours it is now waiting through began (at).
  var HINTS = 10, EVERY = 8 * 36e5, waiter = 0;
  function purse() {
    save.hints = save.hints || {};
    var key = 'chapter ' + (lv.twist ? 3 : lv.powers ? 2 : lv.bonus ? 1 : 0), h = save.hints[key], now = Date.now();   // (numbered as the chapters were when hints were first kept this way)
    if (!h || Array.isArray(h)) h = save.hints[key] = { n: HINTS - (Array.isArray(h) ? Math.min(h.length, HINTS) : 0), at: now };   // (a list of times, from when each came back after a day)
    if (h.n < HINTS) {
      if (!(h.at <= now)) h.at = now;   // a clock that has been put back
      var back = Math.floor((now - h.at) / EVERY);
      if (back > 0) { h.n = Math.min(HINTS, h.n + back); h.at += back * EVERY; }
    }
    return h;
  }
  // How long until the next one comes back: hours, then minutes inside the last hour, then seconds inside the
  // last minute, each rounded down. With 7 hours 59 minutes to go it says 7 hours.
  function wait(ms) {
    var n = ms >= 36e5 ? Math.floor(ms / 36e5) : ms >= 6e4 ? Math.floor(ms / 6e4) : Math.max(1, Math.floor(ms / 1000));
    return n + (ms >= 36e5 ? ' hour' : ms >= 6e4 ? ' minute' : ' second') + (n === 1 ? '' : 's');
  }
  // the number on the hint button: what this chapter has left
  function countHints() {
    var n = purse().n, e = $('hints-left');
    e.textContent = n; e.classList.toggle('none', !n);
    $('b-hint').setAttribute('aria-label', 'Hint, ' + n + ' left to show a spot');
  }
  function showSpots() {
    var h = purse(), left = h.n;
    countHints();
    var none = !won && masked() && !pickSpot();   // nothing to show that would not unmask the chameleon
    $('hint-spot').disabled = !left || none;
    $('spots').textContent = left;
    $('hint-wait').hidden = (!!left && !none) || won;
    if (!left) $('hint-wait').textContent = 'Next hint in ' + wait(h.at + EVERY - Date.now()) + '.';
    else if (none) $('hint-wait').textContent = 'The only spots left would give the chameleon away.';
  }

  function showHint() {
    $('hint-h').textContent = lv.name;
    // The written hint names every shape in the box, the chameleon's real one among them: so with a chameleon in play it is kept back.
    // It says where the chameleon goes, and nothing of what it is: in the level's own words if it has them, or else only whereabouts.
    $('hint-text').textContent = masked() ? lv.masked || 'The chameleon belongs ' + whereabouts() + '. The rest of the written hint is sealed: it would give away its true shape. You can still be shown a spot for one of the other shapes.' : lv.hint;
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

  // A player's picture: a real shape, as it is in the game, with a face that looks about and blinks. It may be a square
  // or a triangle (the two that are one square across: a brick or a hexagon would have to be shrunk twice as far to sit in
  // the same row, and would no longer match), and wear any of the personalities or any of the powers. Nobody picks theirs;
  // it comes from their id, so it is the same wherever it is shown.
  // (A face or power added later must not change anybody's picture: these are the ones there were when this was written.)
  var CAST = OUTFITS.slice(0, 19).concat(PackmanPowers.slice(0, 7)), FORMS = ['square', 'triangle'];
  function avatar(h) {
    var kit = CAST[(h >>> 8) % CAST.length];
    return portrait(kit, kit.color || COLORS[h % COLORS.length], FORMS[(h >>> 24) % FORMS.length]);   // a power, and the goth, come in their own colour
  }
  // Any face, on any shape of any colour: the piece exactly as the board draws it when a square is SHOWN pixels across,
  // from the same outline (drawn), the same face and pour (faces.js) and the same lines (--u). Wherever it is put it is that
  // one drawing, only bigger or smaller, seen through a window the size of the shape.
  var SHOWN = 52, onShow = [];
  function portrait(kit, color, type) {
    type = type || 'square';
    var P = PackmanPiece, poly = G.SHAPES[type], px = 1 / SHOWN, lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
    poly.forEach(function (v) { for (var a = 0; a < 2; a++) { lo[a] = Math.min(lo[a], v[a]); hi[a] = Math.max(hi[a], v[a]); } });
    var side = Math.max(hi[0] - lo[0], hi[1] - lo[1]);
    var s = P.el('svg', 'avatar' + (kit.power ? ' p-' + kit.power : ''), { 'aria-hidden': 'true',
      viewBox: [(lo[0] + hi[0] - side) / 2, (lo[1] + hi[1] - side) / 2, side, side].map(function (n) { return n.toFixed(4); }).join(' ') });
    s.style.setProperty('--c', color); s.style.setProperty('--u', px.toFixed(5));
    if (kit.ink) s.style.setProperty('--face', kit.ink);
    s.appendChild(P.el('path', 'fill', { d: drawn(type, px) }));
    var goo = P.pour(kit, type, drawn(type, px, 1.25));   // up to the inside of the line round the shape, as outline() has it
    if (goo) s.appendChild(goo.g);
    var made = P.face(kit, type);
    s.appendChild(made.face);
    onShow.push({ svg: s, kit: kit, eyes: made.eyes.querySelectorAll('.eye'), look: '' });
    return s;
  }
  // The pictures watch the pointer as the shapes on the board do, wherever on the page it is; only the two dots move.
  // Those on a sheet that is put away are left alone, and those no longer on the page are forgotten.
  function seen(a) { var sh = a.svg.closest('.sheet'); return !sh || sh.classList.contains('open'); }
  var peerAt = null, peerFrame = 0;
  function peer() {
    peerFrame = 0;
    onShow = onShow.filter(function (a) { return a.svg.isConnected; });
    onShow.forEach(function (a) {
      if (a.kit.still || !seen(a)) return;
      var tf = '';
      if (peerAt) {
        var r = a.svg.getBoundingClientRect(), u = 1 / (r.width || 1), dx = (peerAt[0] - r.left - r.width / 2) * u, dy = (peerAt[1] - r.top - r.height / 2) * u, d = Math.hypot(dx, dy);
        if (d > 0.3) { var k = Math.min(0.04, d * 0.03) / d; tf = (dx * k).toFixed(3) + ' ' + (dy * k).toFixed(3); }
      }
      if (tf === a.look) return;
      a.look = tf;
      var by = tf ? tf.split(' ') : [0, 0];
      Array.prototype.forEach.call(a.eyes, function (e) { e.setAttribute('cx', +e.getAttribute('data-x') + +by[0]); e.setAttribute('cy', +e.getAttribute('data-y') + +by[1]); });
    });
  }
  function peek(e) {
    if (calm || !onShow.length) return;
    if (e) peerAt = e.clientX == null ? null : [e.clientX, e.clientY];
    if (!peerFrame) peerFrame = requestAnimationFrame(peer);
  }
  document.addEventListener('pointermove', peek);
  document.addEventListener('pointerdown', peek);
  document.documentElement.addEventListener('pointerleave', function () { peek({}); });
  $('board-ranks').addEventListener('scroll', function () { peek(); }, { passive: true });   // the rows move under a pointer that has not
  // and now and then some of them blink: not the ones with shades or hollow eyes, nor the one that is asleep
  setInterval(function () {
    if (document.hidden) return;
    var up = onShow.filter(function (a) { return a.svg.isConnected && seen(a) && !a.kit.stare && a.kit.power !== 'sleeper'; });
    for (var n = Math.ceil(up.length / 12); n > 0; n--) (function (a) {
      a.svg.classList.add('blink');
      setTimeout(function () { a.svg.classList.remove('blink'); }, 220);
    })(up[Math.floor(Math.random() * up.length)]);
  }, 800);

  // Asked once, before anything else, and there is no skipping it: the sheet stays until there is a name.
  // Whoever skipped it when they could is asked again.
  var afterName = null;
  function nameless() { return !save.name || save.name === alias(me); }
  function wanted() { var f = $('name'); f.classList.remove('no'); void f.offsetWidth; f.classList.add('no'); f.focus(); }
  function askName(then) {
    afterName = then || null;
    $('name-face').textContent = ''; $('name-face').appendChild(avatar(me));
    $('name').value = nameless() ? '' : save.name;
    $('name-go').textContent = save.name ? 'Save' : 'Start \u2192';
    openSheet($('m-name'));
  }
  function named() {
    renames = 0; sync();   // tells the board the name, if it has anything under another
    var then = afterName; afterName = null;
    if (then) then();
  }
  $('name-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = tidy($('name').value);
    if (!name || name === alias(me)) return wanted();
    save.name = name; persist();
    $('name').blur();
    closeSheet($('m-name'));
  });

  function ask(url, body) {
    return fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
      .then(function (r) { return r.json().then(function (d) { d.status = r.status; return d; }); });
  }
  // The board: most levels packed first, then fewest moves, then least time. Everyone's
  // three numbers are shown. Whoever is looking is picked out, and added underneath if
  // they are further down than the rows on show.
  // The first three wear a medal in place of their number: gold, silver, bronze, with the number on it.
  function medal(pos) {
    return '<svg viewBox="0 0 26 28" role="img" aria-label="' + nth(pos) + '"><path class="tail" d="M5.5 1.5h6l3 9h-6zM20.5 1.5h-6l-3 9h6z"/>' +
      '<circle class="disc" cx="13" cy="17" r="9"/><circle class="ring" cx="13" cy="17" r="6.3"/><text x="13" y="20.6">' + pos + '</text></svg>';
  }
  function ranks(list, data, limit) {
    list.textContent = '';
    var mine = false;
    function cell(li, tag, cls, text) { var e = document.createElement(tag); e.className = cls; e.textContent = text; li.appendChild(e); return e; }
    function line(pos, r, own) {
      var li = document.createElement('li');
      var place = cell(li, 'b', 'pos', pos);
      if (pos <= 3) { place.innerHTML = medal(pos); li.className = 'top t' + pos; }
      li.appendChild(avatar(r.a));
      cell(li, 'span', 'who', own ? called() : r.name);
      cell(li, 'span', 'fig', r.n); cell(li, 'span', 'fig', r.m); cell(li, 'span', 'fig t', clock(r.t));
      if (own) { li.className += ' me'; mine = true; }
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
  // Whoever plays as Swordfish, however it is spelt in capitals, plays off the record: the board is read and never written to.
  function offRecord() { return /^swordfish$/i.test(String(called()).trim()); }
  function report(score) {
    var box = $('win-lb'), note = $('win-lb-note'), skip = LOCAL || offRecord(), mark = ++sent, before = null;
    box.hidden = true; $('win-coup').hidden = true; $('win-prize').hidden = true;
    function show(d, why) {
      ranks($('win-ranks'), d, 5);
      note.textContent = why || standing(d);
      note.hidden = !note.textContent;
      box.hidden = false;
    }
    if (SHOW && /^coup[123]$/.test(SHOW)) {   // a look at a place being taken: a board made up for it, a moment after the win as the real one comes
      setTimeout(function () { var made = pretend(+SHOW.charAt(4)); if (mark === sent) { show(made[1]); coup(made[0], made[1]); } }, 900);
      return;
    }
    // The board is asked where the player stands before the win is sent as well as after, to tell whether it moved them up.
    (skip ? Promise.resolve(null) : ask(SCORES + '?pid=' + save.pid).catch(function () { return null; })).then(function (b) {
      before = b && b.top ? b : null;
      return skip ? ask(SCORES + '?pid=' + save.pid) : ask(SCORES, score);
    }).then(function (d) {
      if (mark !== sent) return;   // another win has gone since
      if (d.error === 'name') {   // the board will not take that name: fall back to the stand-in and send it again
        save.name = alias(me); persist(); score.name = save.name;
        return report(score);
      }
      if (!d.top) return;
      if (!skip) { save.sent = save.sent || {}; save.sent[score.level] = 1; save.as = score.name; persist(); }
      show(d, LOCAL ? 'Scores are not sent from a copy on this machine.' : skip ? 'Scores are not sent under this name.' : '');
      if (!skip && !coup(before, d) && d.rank === 1) sfx.top();
    }).catch(function () {});   // no board today: the win sheet simply goes without one
  }

  // A win that carries the player up into the first three, or up within them, has overthrown whoever stood there:
  // fourth past third, third past second, second past first, or from further down into any of the three. The win
  // sheet says who, under a medal. The first time a player gets in among the three from outside, they have won the
  // prize as well, and are told so, once. (before: the board as it stood; after: as it stands. True if there was a coup.)
  function coup(before, after) {
    var now = after.rank, was = before ? before.rank || Infinity : 0;   // (not on the board before: below everyone. The board not got before: nothing can be said)
    if (!now || now > 3 || now >= was) return false;
    var held = before.top && before.top[now - 1], say = $('coup-say'), box = $('win-coup');
    if (held && held.a === me) held = null;
    function part(tag, text) { var e = document.createElement(tag); e.textContent = text; say.appendChild(e); }
    say.textContent = '';
    if (held) { part('span', 'You overthrew '); part('b', held.name); } else part('span', 'You are in the top three');
    part('strong', 'You are ' + nth(now) + ' now!');
    $('coup-medal').innerHTML = medal(now);
    box.className = 'coup t' + now; box.hidden = false;
    sfx.top(); confetti(120);
    if (PRIZE && was > 3 && !save.top3) {
      save.top3 = { rank: now, over: held ? held.name : '', at: Date.now() }; persist();
      $('win-prize').hidden = false; $('win-lb').hidden = true;   // (the prize has the sheet to itself: it is what the screenshot is of)
    }
    return true;
  }
  // (for a look at it: the board as it would stand before and after the player takes this place)
  function pretend(to) {
    var rows = ['Haojun', 'KKG', 'Sonam', 'Sam', 'abc', 'wes'].map(function (n, i) { return { name: n, n: 47 - 5 * i, m: 930 - 60 * i, t: 4400 - 300 * i, a: 77 + i * 7919 }; });
    var mine = { name: called(), n: rows[to - 1].n + 1, m: 512, t: 2710, a: me };
    var below = { name: called(), n: rows[to].n - 1, m: 498, t: 2650, a: me }, was = rows.slice();
    was.splice(to + 1, 0, below);
    return [{ top: was, rank: to + 2 > 4 ? 4 : to + 1, of: 30 }, { top: rows.slice(0, to - 1).concat([mine], rows.slice(to - 1)), rank: to, of: 30 }];
  }
  // Whoever has won the prize is shown it every time they open the game, until they press Done on it.
  function latePrize() {
    var w = save.top3;
    $('win-title').textContent = 'Top three!';
    $('win-sub').textContent = (w.over ? 'You overthrew ' + w.over + ' and took ' : 'You took ') + nth(w.rank) + ' place on the leaderboard.';
    $('win-one').hidden = true; $('win-all').hidden = true; $('win-fact').hidden = true; $('win-next').hidden = true;
    $('win-lb').hidden = true; $('win-coup').hidden = true; $('win-prize').hidden = false;
    confetti(160);
    openSheet($('m-win'));
  }

  // Bests the board has not had yet are sent as soon as the game opens, one at a time:
  // everything packed before there was a leaderboard, and any win that did not get through.
  // The pieces are long gone from the box, so the level's own solution goes along as the
  // proof. Until a name is given they go up under the stand-in, and the board is told the
  // real one the moment there is one.
  var syncing = false, renames = 0;   // renames: how often this visit has gone back just to change the name, in case the board keeps refusing
  function called() { return save.name || alias(me); }
  function sync() {
    if (LOCAL || offRecord() || syncing) return;
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
    ask(SCORES + '?pid=' + save.pid + '&top=100').then(function (d) {
      if (!d.top) throw 0;
      ranks(list, d, 100);   // the first hundred, to scroll through
      list.scrollTop = 0;
      note.textContent = standing(d);
    }).catch(function () {
      list.textContent = ''; note.textContent = 'The leaderboard is not available right now.';
    }).then(function () { list.classList.remove('wait'); });
    openSheet($('m-board'));
  }
  $('win-lb-all').addEventListener('click', function () { closeSheet($('m-win')); showBoard(); });
  $('board-rename').addEventListener('click', function () { closeSheet($('m-board')); askName(showBoard); });

  function showLevels() {
    var grid = $('grid'), jump = $('jump'), count = 0, heads = [];
    grid.textContent = ''; jump.textContent = '';
    LEVELS.forEach(function (l, n) {
      if (n === FIRST[chap(l)]) {
        var more = document.createElement('div');
        more.className = 'more'; more.textContent = 'Chapter ' + (chap(l) + 1) + ' \u00B7 ' + CHAPTERS[chap(l)];
        grid.appendChild(more); heads[chap(l)] = more;
      }
      var b = document.createElement('button'), s = el('svg'), bb = G.bounds(l.container), done = save.done[l.name];
      if (done) count++;
      var shut = !unlocked(n);
      b.className = 'lv' + (done ? ' done' : '') + (n === level ? ' here' : '') + (shut ? ' locked' : '');
      b.disabled = shut;
      b.style.setProperty('--n', Math.min(among(n) + 2 * chap(l), 22));
      b.setAttribute('aria-label', label(n) + (shut ? ', locked until the one before it is packed' : ', ' + l.name + (done ? ', packed in ' + clock(done.t) : '')));
      b.title = shut ? 'Pack the one before it first' : l.name + (done ? ' · best ' + clock(done.t) : '');
      s.setAttribute('viewBox', bb.minX + ' ' + bb.minY + ' ' + (bb.maxX - bb.minX) + ' ' + (bb.maxY - bb.minY));
      (l.containers || [l.container]).forEach(function (c) { var poly = el('polygon'); poly.setAttribute('points', pts(c)); s.appendChild(poly); });
      b.appendChild(s);
      b.appendChild(document.createTextNode(among(n)));
      if (done || shut) { var t = document.createElement('span'); t.className = 'tick'; t.textContent = done ? '✓' : '\uD83D\uDD12'; b.appendChild(t); }
      b.addEventListener('click', function () { closeSheet($('m-levels')); startLevel(n); });
      grid.appendChild(b);
    });
    $('levels-sub').textContent = (count ? count + ' of ' + LEVELS.length + ' packed. ' : '') + 'Start any chapter. Its levels open one by one.';
    // a button for each chapter, saying how much of it is packed; it brings that chapter to the top of the list
    CHAPTERS.forEach(function (name, k) {
      var b = document.createElement('button'), sm = document.createElement('small');
      var done = LEVELS.filter(function (l) { return chap(l) === k && save.done[l.name]; }).length;
      b.type = 'button'; b.textContent = name; sm.textContent = done + ' of ' + chapSize(k);
      b.appendChild(sm);
      if (k === chap(lv)) b.className = 'on';
      b.addEventListener('click', function () {
        var card = grid.closest('.card');
        var to = card.scrollTop + heads[k].getBoundingClientRect().top - card.getBoundingClientRect().top - jump.offsetHeight - 4;
        card.scrollTo({ top: k ? Math.max(0, to) : 0, behavior: calm ? 'auto' : 'smooth' });   // the first chapter: right back to the top
        Array.prototype.forEach.call(jump.children, function (c) { c.classList.toggle('on', c === b); });
      });
      jump.appendChild(b);
    });
    openSheet($('m-levels'));
    var here = grid.querySelector('.here');
    if (here) setTimeout(function () { here.scrollIntoView({ block: 'center' }); }, 60);
  }

  $('chip').addEventListener('click', showLevels);
  $('b-hint').addEventListener('click', showHint);
  $('hint-spot').addEventListener('click', function () {
    if (purse().n < 1) return;
    var spot = pickSpot();
    if (!spot && masked()) return;   // nothing to show that would not unmask the chameleon; the hint is not used up
    if (spot) { var h = purse(); if (h.n === HINTS) h.at = Date.now(); h.n--; persist(); countHints(); }   // the wait for one to come back starts when the purse stops being full
    closeSheet($('m-hint')); showGhost(spot);
    if (spot) sfx.spot();
  });
  $('b-board').addEventListener('click', showBoard);
  $('b-help').addEventListener('click', function () { openSheet($('m-help')); });

  // Starting from nothing: everything this browser remembers of the game is forgotten, and the page is
  // loaded afresh as for a new player. The leaderboard keeps the old scores, under an id nobody has any
  // more, unless the box on the sheet is ticked: then this player's line is taken off the board as well.
  function forget() {
    // both names the progress has been kept under: left behind, the old one would be read back in as if it were the player's
    try { localStorage.removeItem(STORE); localStorage.removeItem('packer.v1'); } catch (e) {}
  }
  function wipe(board) {
    // Taking the line off the board is not waited for. The id it is kept under is put on a list of its
    // own, which outlives the reset, and the board is asked to drop it now and every time the game is
    // opened until it says it has: so the reset always happens, and the line goes as soon as the board can be reached.
    if (board) { try { localStorage.setItem(GONE, JSON.stringify(gone().concat(save.pid))); } catch (e) {} }
    wiped = true;
    clearInterval(ticker); clearTimeout(shakeTimer); clearTimeout(partyTimer);
    forget();
    try { sessionStorage.setItem('packman.reset', '1'); } catch (e) {}
    location.replace(location.pathname + '?reset=' + Date.now());   // a new address, so the browser cannot hand back the old page
  }
  var GONE = 'packman.gone';
  function gone() { try { var l = JSON.parse(localStorage.getItem(GONE)); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function purge() {
    if (LOCAL) return;
    gone().forEach(function (pid) {
      fetch(SCORES + '?pid=' + pid, { method: 'DELETE' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (!d || d.gone == null) return;   // not taken off yet: it is asked again next time
          try { localStorage.setItem(GONE, JSON.stringify(gone().filter(function (p) { return p !== pid; }))); } catch (e) {}
        }).catch(function () {});
    });
  }
  purge();
  $('reset-ask').addEventListener('click', function () { closeSheet($('m-help')); $('reset-board').checked = false; openSheet($('m-reset')); });
  $('reset-go').addEventListener('click', function () { wipe($('reset-board').checked); });
  var armed = 0;
  function disarm() { clearTimeout(armed); armed = 0; $('b-reset').classList.remove('sure'); }
  $('b-reset').addEventListener('click', function () {
    var packed = pieces.filter(function (p) { return p.good; }).length;
    if (packed >= 3 && !armed && !won) { this.classList.add('sure'); armed = setTimeout(disarm, 2800); sfx.arm(); return; }
    disarm(); wake(); startLevel(level, true); sfx.drop();
  });
  $('b-sound').addEventListener('click', function () {
    save.mute = !save.mute; persist();
    showMute();
    if (!save.mute) { wake(); sfx.fit(); }
  });
  $('win-next').addEventListener('click', function () { closeSheet($('m-win')); startLevel(Math.min(level + 1, LEVELS.length - 1)); });
  $('prize-done').addEventListener('click', function () { if (save.top3) save.top3.done = true; persist(); closeSheet($('m-win')); });
  // On the leaderboard, where the prize is spoken of, there it is, turning: the mug, a thing of CSS alone (mug/, made by tools/mug.py).
  if (PRIZE) { $('board-prize').innerHTML = PackmanMug + '<span>Finish in the <b>top 3</b> and win a <b>prize</b>, shipped to your door.</span>'; $('board-prize').hidden = false; }
  $('help-prize').innerHTML = GIFT;
  $('prize-gift').innerHTML = GIFT;
  $('go-next').addEventListener('click', function () { startLevel(Math.min(level + 1, LEVELS.length - 1)); });
  $('win-again').addEventListener('click', function () { closeSheet($('m-win')); startLevel(level, true); });
  $('win-levels').addEventListener('click', function () { closeSheet($('m-win')); showLevels(); });
  // Share sheet on a phone; elsewhere the brag and the link go on the clipboard.
  $('win-share').addEventListener('click', function () {
    var b = this.lastChild, url = location.href.split(/[?#]/)[0] + '?level=' + (level + 1);
    var text = 'I packed ' + lv.name + ', ' + label(level).toLowerCase() + ' of Packman, in ' + clock(elapsed) + '. Can you beat that?';
    if (shareAll) { url = location.href.split(/[?#]/)[0]; text = 'I finished Packman: all ' + LEVELS.length + ' levels, packed. Can you?'; }   // the whole game, not this level
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

  // A light tap under any button that has no sound of its own.
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('button') : null;
    if (b && b.id !== 'b-eye' && b.id !== 'b-sound' && b.id !== 'b-reset' && !b.closest('.dock')) sfx.tap();
  }, true);
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
    if (PRIZE && save.top3 && !save.top3.done) setTimeout(latePrize, 700);
    else if (SHOW === 'welcome') openSheet($('m-help'));
    else if (SHOW === 'board') showBoard();
    else if (SHOW) setTimeout(solve, 1100);   // a look at a moment: the level is packed for whoever is looking, and what follows is the game's own doing
    if (!save.seen) openSheet($('m-help'));
  };
  sync();
  if (nameless()) askName(opening); else opening();
  persist();

  // Packs the level as its own solution has it. (On this machine only: the Solver button, and a look at a moment with ?show.)
  function solve() {
    if (won) return;
    select(-1);
    pieces.forEach(function (p, i) {
      while (p.power === 'chameleon' && p.form) morph(p, i);
      var s = lv.solution[i] || lv.solution[lv.pieces.indexOf(p.type)] || lv.haunt;   // the ghost lies over one of its own kind, or where the level says
      p.x = s[0]; p.y = s[1]; p.angle = s[2]; render(i);
    });
    startClock(); commit(true, true);
  }
  // Developer tools, only when the game is served from this machine.
  if (LOCAL) {
    var dev = document.createElement('div');
    dev.className = 'dev';
    [['Solver', solve], ['Hard reset', function () {
      if (!window.confirm('Clear all Packman progress on this browser?')) return;
      wipe(false);
    }], ['Moments', function () { location.href = 'tools/states.html'; }]].forEach(function (b) {   // (the game's big moments, each played live: tools/states.html)
      var btn = document.createElement('button');
      btn.textContent = b[0]; btn.addEventListener('click', b[1]);
      dev.appendChild(btn);
    });
    if (SHOW) dev.hidden = true;   // a look at a moment is of the game as a player has it
    document.body.appendChild(dev);
  }

  window.Packman = { pieces: function () { return pieces; } };   // for poking at the board from the console
  if (LOCAL) {   // for the tests (tests/), and for trying things out
    window.Packman.commit = commit; window.Packman.render = render; window.Packman.level = function () { return lv; };
    window.Packman.play = function (name) { startLevel(LEVELS.map(function (l) { return l.name; }).indexOf(name), true); };
    window.Packman.me = function () { return me; };   // the number a player's row on the board is known by
  }
  if (REEL) {   // what reel/reel.js works the game with
    window.Packman.select = select; window.Packman.wake = wake; window.Packman.sfx = sfx;
    window.Packman.fresh = function () { save.done = {}; };   // so that every showing is a first win, with the whole party
    window.Packman.drawn = drawn; window.Packman.confetti = confetti;
    window.Packman.clock = startClock; window.Packman.judge = judge;   // the clock runs, and the board is looked over (shapes smile, the marks light) without the party a win brings
    var film = document.createElement('script'); film.src = 'reel/reel.js'; document.body.appendChild(film);
  }
})();
