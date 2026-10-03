// Packer: the board, the dragging and spinning, and the celebrations.
(function () {
  'use strict';

  var G = PackerGeom, LEVELS = PackerLevels;
  var NS = 'http://www.w3.org/2000/svg';
  var COLORS = ['#FF6B6B', '#FFC93C', '#3DDBB4', '#4DA8FF', '#9B7BFF', '#FF8FCB', '#FF9F45'];
  var PRAISE = ['Packed!', 'Snug!', 'Tidy!', 'Nailed it!', 'So neat!', 'Boxed!'];
  var STORE = 'packer.v1';
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
  function drawn(type) {
    var px = 1 / view.scale, gap = 2.6 * px;
    var base = G.SHAPES[type], inr = type === 'square' ? 0.5 : G.H / 3, k = (inr - gap) / inr;
    return rounded(base.map(function (p) { return [p[0] * k, p[1] * k]; }), Math.min(6 * px, 0.12));
  }
  // The box's outline is drawn just outside the real walls, so a piece resting
  // against a wall shows the same sliver of gap as two pieces side by side.
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
  function clock(sec) { sec = Math.round(sec); return Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2); }
  function shuffled(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  var board = $('board'), stage = $('stage'), layer = $('pieces'), bin = $('bin'), handle = $('handle'),
      bubble = $('bubble'), dock = $('dock'), ang = $('ang');

  var save = { done: {}, last: 0, mute: false, seen: false };
  try { var raw = JSON.parse(localStorage.getItem(STORE)); if (raw && raw.done) save = raw; } catch (e) {}
  function persist() { try { localStorage.setItem(STORE, JSON.stringify(save)); } catch (e) {} }

  var level = 0, lv, C, cb;            // current level, its container, the container's bounds
  var pieces = [], sel = -1, drag = null, won = false;
  var view = { x: 0, y: 0, w: 10, h: 10, scale: 50, land: true };
  var moves = 0, t0 = 0, elapsed = 0, carried = 0, ticker = 0;

  /* ---------- sound ---------- */

  var actx = null;
  function wake() {
    if (save.mute || actx) { if (actx && actx.state === 'suspended') actx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (AC) try { actx = new AC(); } catch (e) {}
  }
  function tone(freq, dur, opts) {
    if (save.mute || !actx) return;
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
    tick: function () { tone(1250, 0.025, { type: 'triangle', vol: 0.035 }); },
    win: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, 0.22, { at: i * 0.09, type: 'triangle', vol: 0.13 }); }); }
  };
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
    bin.firstElementChild.setAttribute('d', rounded(grown(C, 3.4 * px), Math.min(9 * px, 0.16)));
    pieces.forEach(function (p) { if (p.fill) p.fill.setAttribute('d', drawn(p.type)); });
    $('knob').setAttribute('r', 11 * px);
    $('knob-hit').setAttribute('r', 22 * px);
    $('knob-dot').setAttribute('r', 4 * px);
    for (var i = 0; i < pieces.length; i++) { keepInView(pieces[i]); if (pieces[i].el) render(i); }
    placeHandle();
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
      p.angle = lv.scramble ? 15 * Math.floor(Math.random() * (p.type === 'square' ? 6 : 24)) : 0;
      keepInView(p);
    });
  }

  /* ---------- drawing ---------- */

  function buildPiece(p, i) {
    var g = el('g', 'piece fresh'), pop = el('g', 'pop'), body = el('g', 'body'), fill = el('path', 'fill'), face = el('g', 'face');
    g.dataset.i = i;
    g.style.setProperty('--c', p.color);
    g.style.setProperty('--d', (60 + i * 28) + 'ms');
    fill.setAttribute('d', drawn(p.type));
    if (p.type === 'triangle') face.setAttribute('transform', 'translate(0 0.03) scale(0.74)');
    var eyes = el('g', 'eyes');
    [-0.13, 0.13].forEach(function (x) {
      var e = el('circle', 'eye');
      e.setAttribute('cx', x); e.setAttribute('cy', -0.06); e.setAttribute('r', 0.048);
      eyes.appendChild(e);
    });
    var shut = el('path', 'shut');
    shut.setAttribute('d', 'M-0.18 -0.06H-0.08M0.08 -0.06H0.18');
    eyes.appendChild(shut);
    face.appendChild(eyes);
    var idle = el('path', 'mouth m-idle'), good = el('path', 'mouth m-good'), bad = el('circle', 'mouth m-bad');
    idle.setAttribute('d', 'M-0.07 0.1 Q0 0.15 0.07 0.1');
    good.setAttribute('d', 'M-0.12 0.07 Q0 0.24 0.12 0.07');
    bad.setAttribute('cx', 0); bad.setAttribute('cy', 0.13); bad.setAttribute('r', 0.045);
    face.appendChild(idle); face.appendChild(good); face.appendChild(bad);
    body.appendChild(fill); body.appendChild(face);
    pop.appendChild(body); g.appendChild(pop);
    p.el = g; p.pop = pop; p.body = body; p.fill = fill; p.tf = p.rot = '';
    layer.appendChild(g);
    setTimeout(function () { g.classList.remove('fresh'); }, 620 + i * 28);
  }

  function render(i) {
    var p = pieces[i], tf = 'translate(' + p.x.toFixed(4) + 'px,' + p.y.toFixed(4) + 'px)', rot = 'rotate(' + p.angle + 'deg)';
    if (tf !== p.tf) { p.el.style.transform = p.tf = tf; }
    if (rot !== p.rot) { p.body.style.transform = p.rot = rot; }
  }

  function knobPos(p) {
    var r = (p.angle - 90) * Math.PI / 180, reach = (p.type === 'square' ? 0.72 : 0.6) + 30 / view.scale;
    return [p.x + Math.cos(r) * reach, p.y + Math.sin(r) * reach];
  }

  function placeHandle() {
    var show = sel >= 0 && !won && !(drag && drag.mode === 'move');
    handle.toggleAttribute('hidden', !show);
    if (!show) { bubble.classList.remove('show'); return; }
    var p = pieces[sel], k = knobPos(p), line = handle.firstElementChild;
    line.setAttribute('x1', p.x); line.setAttribute('y1', p.y); line.setAttribute('x2', k[0]); line.setAttribute('y2', k[1]);
    ['knob', 'knob-hit', 'knob-dot'].forEach(function (id) { $(id).setAttribute('cx', k[0]); $(id).setAttribute('cy', k[1]); });
    if (drag && drag.mode === 'spin') {
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
      if (s.good && !p.good) {
        fitted = true;
      }
      p.good = s.good;
    });
    for (var k = 0; k < pips.length; k++) pips[k].classList.toggle('on', k < ev.packed);
    $('count').textContent = ev.packed + ' of ' + pieces.length + ' packed';
    ev.fitted = fitted;
    return ev;
  }

  // After a move is finished: count it, make the right noise, maybe win.
  function commit(quiet) {
    var ev = judge();
    moves++;
    if (ev.solved) { win(); return; }
    save.board = {
      l: level, m: moves, t: t0 ? Math.round((performance.now() - t0) / 1000) : carried,
      p: pieces.map(function (p) { return [+p.x.toFixed(4), +p.y.toFixed(4), p.angle]; })
    };
    persist();
    if (quiet) return;
    if (ev.fitted) sfx.fit(); else if (sel >= 0 && pieces[sel].el.classList.contains('bad')) sfx.bad(); else sfx.drop();
  }

  function startClock() {
    if (t0 || won) return;
    t0 = performance.now() - carried * 1000;
    ticker = setInterval(function () { $('clock').textContent = clock((performance.now() - t0) / 1000); }, 500);
  }

  /* ---------- selecting, moving, spinning ---------- */

  function select(i) {
    if (sel >= 0 && pieces[sel]) pieces[sel].el.classList.remove('sel');
    sel = i;
    if (i >= 0) { pieces[i].el.classList.add('sel'); layer.appendChild(pieces[i].el); }
    showAngle(); placeHandle();
  }

  function spin(i, by) {
    if (!by || won) return;
    var p = pieces[i];
    startClock();
    p.angle += by;
    G.settle(pieces, i, C);
    render(i); placeHandle(); showAngle(); tick();
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

  board.addEventListener('pointerdown', function (e) {
    if (won || drag || e.button > 0) return;
    wake();
    if (document.activeElement === ang) ang.blur();
    var w = world(e), t = e.target, pe = t.closest ? t.closest('.piece') : null;
    if ((t.id === 'knob' || t.id === 'knob-hit') && sel >= 0) {
      drag = { mode: 'spin', id: e.pointerId, from: pieces[sel].angle };
      handle.classList.add('spin'); bubble.classList.add('show');
      placeHandle();
    } else if (pe) {
      var i = +pe.dataset.i, p = pieces[i];
      select(i);
      drag = { mode: 'move', id: e.pointerId, i: i, ox: p.x - w.x, oy: p.y - w.y, sx: e.clientX, sy: e.clientY, moved: false, a0: p.angle, stuck: false,
        home: pieces.map(function (q) { return [q.x, q.y]; }) };
      layer.classList.add('dragging');
      p.el.classList.add('held');
      placeHandle(); sfx.pick();
    } else { select(-1); return; }
    try { board.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
  });

  // Pointer moves can arrive faster than the screen redraws; only the latest
  // one per frame is worth working out.
  var pending = null, frame = 0;
  board.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    pending = { clientX: e.clientX, clientY: e.clientY };
    if (!frame) frame = requestAnimationFrame(moveTo);
  });

  function moveTo() {
    frame = 0;
    var e = pending; pending = null;
    if (!e || !drag) return;
    var w = world(e), p;
    if (drag.mode === 'spin') {
      p = pieces[sel];
      spinTo(sel, notched(Math.atan2(w.y - p.y, w.x - p.x) * 180 / Math.PI + 90));
      judge();
      return;
    }
    if (!drag.moved && Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) < 4) return;
    drag.moved = true; startClock();
    p = pieces[drag.i];
    // Work out the whole board from where it was when this drag began, so
    // what you see while dragging is exactly what you get when you let go:
    // the magnet lines the piece up, and if it still overlaps a little, the
    // neighbours visibly scoot over to make room (or it stays red).
    pieces.forEach(function (q, k) { if (k !== drag.i) { q.x = drag.home[k][0]; q.y = drag.home[k][1]; } });
    p.x = w.x + drag.ox; p.y = w.y + drag.oy; p.angle = drag.a0;
    keepInView(p);
    var stuck = G.place(pieces, drag.i, C) === 'snap';
    if (stuck && !drag.stuck) sfx.snap();
    drag.stuck = stuck;
    for (var k = 0; k < pieces.length; k++) render(k);
    judge(); showAngle();
  }

  function release(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (frame) { cancelAnimationFrame(frame); moveTo(); }
    var d = drag; drag = null;
    try { board.releasePointerCapture(e.pointerId); } catch (err) {}
    if (d.mode === 'spin') {
      handle.classList.remove('spin'); bubble.classList.remove('show');
      if (pieces[sel].angle !== d.from) commit(); else placeHandle();
      return;
    }
    var p = pieces[d.i];
    p.el.classList.remove('held');
    layer.classList.remove('dragging');
    if (d.moved) commit();
    placeHandle();
  }
  board.addEventListener('pointerup', release);
  board.addEventListener('pointercancel', release);

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
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var open = document.querySelector('.sheet.open');
    if (e.key === 'Escape') { if (open) closeSheet(open); else select(-1); return; }
    if (open || won) return;
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
    C = G.makeContainer(lv.container); cb = G.bounds(lv.container);
    won = false; drag = null; sel = -1; moves = 0; t0 = 0; elapsed = 0; carried = 0;
    clearInterval(ticker);
    save.last = i; persist();

    $('lv-num').textContent = i + 1;
    $('lv-name').textContent = lv.name;
    $('lv-intro').textContent = lv.intro;
    $('clock').textContent = '0:00';
    var title = $('title');
    title.classList.remove('swap'); void title.offsetWidth; title.classList.add('swap');

    bin.setAttribute('class', '');
    bin.style.transformOrigin = ((cb.minX + cb.maxX) / 2) + 'px ' + ((cb.minY + cb.maxY) / 2) + 'px';
    bin.style.animation = 'none'; void bin.getBoundingClientRect(); bin.style.animation = '';

    layer.textContent = '';
    var colors = shuffled(COLORS), pips = $('pips');
    pips.textContent = '';
    pieces = lv.pieces.map(function (type, n) {
      var pip = document.createElement('i');
      if (type === 'triangle') pip.className = 't';
      pips.appendChild(pip);
      return { type: type, size: 1, x: 0, y: 0, angle: 0, color: colors[n % colors.length], good: false };
    });
    layout();
    var kept = save.board;
    if (!fresh && kept && kept.l === i && kept.p && kept.p.length === pieces.length) {
      pieces.forEach(function (p, n) { p.x = kept.p[n][0]; p.y = kept.p[n][1]; p.angle = kept.p[n][2]; keepInView(p); });
      moves = kept.m || 0; carried = kept.t || 0;
      $('clock').textContent = clock(carried);
    } else scatter();
    pieces.forEach(function (p, n) { buildPiece(p, n); render(n); });
    judge(); showAngle(); placeHandle();
  }

  function win() {
    won = true;
    clearInterval(ticker);
    elapsed = t0 ? (performance.now() - t0) / 1000 : 0;
    $('clock').textContent = clock(elapsed);
    var prev = save.done[level], best = prev ? Math.min(prev.t, elapsed) : elapsed;
    save.done[level] = { t: best, m: prev ? Math.min(prev.m, moves) : moves };
    if (save.board && save.board.l === level) save.board = null;
    persist();

    select(-1);
    bin.setAttribute('class', 'win');
    sfx.win();
    var last = level === LEVELS.length - 1;
    confetti(last ? 320 : 150);

    var all = LEVELS.every(function (_, n) { return save.done[n]; });
    $('win-title').textContent = last ? 'Seventeen!' : PRAISE[Math.floor(Math.random() * PRAISE.length)];
    $('win-sub').textContent = last
      ? (all ? 'That was the hard one, and you have now packed all ten. Take a bow.' : 'That was the hard one. Take a bow.')
      : 'Level ' + (level + 1) + ', ' + lv.name + ', is all packed up.';
    $('win-time').textContent = clock(elapsed);
    $('win-moves').textContent = moves;
    $('win-best').textContent = clock(best);
    $('win-fact').hidden = !lv.fact;
    $('win-fact').textContent = lv.fact || '';
    $('win-next').hidden = last;
    setTimeout(function () { if (won) openSheet($('m-win')); }, calm ? 200 : 1250);
  }

  /* ---------- sheets ---------- */

  function openSheet(s) { s.classList.add('open'); var b = s.querySelector('.btn:not([hidden])'); if (b) setTimeout(function () { b.focus({ preventScroll: true }); }, 60); }
  function closeSheet(s) { s.classList.remove('open'); }
  Array.prototype.forEach.call(document.querySelectorAll('.sheet'), function (s) {
    s.addEventListener('click', function (e) { if (e.target === s || e.target.hasAttribute('data-close')) closeSheet(s); });
  });

  function showHint() {
    $('hint-h').textContent = lv.name;
    $('hint-text').textContent = lv.hint;
    $('hint-fact').hidden = !lv.fact;
    $('hint-fact').textContent = lv.fact || '';
    openSheet($('m-hint'));
  }

  function showLevels() {
    var grid = $('grid'), count = 0;
    grid.textContent = '';
    LEVELS.forEach(function (l, n) {
      var b = document.createElement('button'), s = el('svg'), poly = el('polygon'), bb = G.bounds(l.container), done = save.done[n];
      if (done) count++;
      b.className = 'lv' + (done ? ' done' : '') + (n === level ? ' here' : '');
      b.style.setProperty('--n', n);
      b.setAttribute('aria-label', 'Level ' + (n + 1) + ', ' + l.name + (done ? ', packed in ' + clock(done.t) : ''));
      b.title = l.name + (done ? ' · best ' + clock(done.t) : '');
      s.setAttribute('viewBox', bb.minX + ' ' + bb.minY + ' ' + (bb.maxX - bb.minX) + ' ' + (bb.maxY - bb.minY));
      poly.setAttribute('points', pts(l.container));
      s.appendChild(poly); b.appendChild(s);
      b.appendChild(document.createTextNode(n + 1));
      if (done) { var t = document.createElement('span'); t.className = 'tick'; t.textContent = '✓'; b.appendChild(t); }
      b.addEventListener('click', function () { closeSheet($('m-levels')); startLevel(n); });
      grid.appendChild(b);
    });
    $('levels-sub').textContent = count ? count + ' of ' + LEVELS.length + ' packed. They get harder as you go.' : 'Ten boxes. They get harder as you go.';
    openSheet($('m-levels'));
  }

  $('chip').addEventListener('click', showLevels);
  $('b-hint').addEventListener('click', showHint);
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
    $('b-sound').classList.toggle('off', save.mute);
    if (!save.mute) { wake(); sfx.fit(); }
  });
  $('win-next').addEventListener('click', function () { closeSheet($('m-win')); startLevel(Math.min(level + 1, LEVELS.length - 1)); });
  $('win-again').addEventListener('click', function () { closeSheet($('m-win')); startLevel(level, true); });
  $('win-levels').addEventListener('click', function () { closeSheet($('m-win')); showLevels(); });

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
    if (!p.el) return;
    p.el.classList.add('blink');
    setTimeout(function () { p.el.classList.remove('blink'); }, 220);
  }, 900);

  // The page is a game board, not a document: no pinch or double-tap zoom.
  // iOS Safari ignores user-scalable=no, so its gesture events are cancelled too.
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) {
    document.addEventListener(n, function (e) { e.preventDefault(); }, { passive: false });
  });
  document.addEventListener('touchmove', function (e) { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

  if (window.ResizeObserver) new ResizeObserver(layout).observe(stage);
  else window.addEventListener('resize', layout);

  $('b-sound').classList.toggle('off', !!save.mute);
  var asked = /[?&#]level=(\d+)/.exec(location.search + location.hash);
  var first = asked ? +asked[1] - 1 : save.last || 0;
  startLevel(clamp(first, 0, LEVELS.length - 1));
  if (!save.seen) { save.seen = true; persist(); openSheet($('m-help')); }

  window.Packer = { pieces: function () { return pieces; } };   // for poking at the board from the console
})();
