// Packer geometry: convex-polygon overlap, containment, and the drop "settle".
// World units: a size-1 square has side 1. Angles are whole degrees, y points down.
var PackerGeom = (function () {
  'use strict';

  var H = Math.sqrt(3) / 2;
  var SHAPES = {
    square: [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]],
    triangle: [[0, -2 * H / 3], [0.5, H / 3], [-0.5, H / 3]]   // centroid at the origin
  };

  // How much pieces may sink into each other or a wall and still count as packed.
  // Kept tiny on purpose: the last level's container is only ~0.03 tighter than
  // the easy 45-degree packing, so a generous tolerance would let that one through.
  var EPS = 0.002;
  var SNAP = 0.22;      // deepest overlap the settle will push out of
  var MAX_SLIDE = 0.5;  // furthest a settle may move a piece from where it was dropped

  function verts(p) {
    var base = SHAPES[p.type], s = p.size || 1;
    var r = p.angle * Math.PI / 180, c = Math.cos(r), n = Math.sin(r);
    var out = [];
    for (var i = 0; i < base.length; i++) {
      var x = base[i][0] * s, y = base[i][1] * s;
      out.push([p.x + x * c - y * n, p.y + x * n + y * c]);
    }
    return out;
  }

  function normals(poly) {
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.sqrt(dx * dx + dy * dy);
      out.push([dy / l, -dx / l]);
    }
    return out;
  }

  // Separating-axis test. null if apart; otherwise the shallowest way out,
  // as a unit direction to move A plus the distance.
  function overlap(A, B) {
    var best = null, axes = normals(A).concat(normals(B));
    for (var k = 0; k < axes.length; k++) {
      var nx = axes[k][0], ny = axes[k][1];
      var minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity, i, d;
      for (i = 0; i < A.length; i++) { d = A[i][0] * nx + A[i][1] * ny; if (d < minA) minA = d; if (d > maxA) maxA = d; }
      for (i = 0; i < B.length; i++) { d = B[i][0] * nx + B[i][1] * ny; if (d < minB) minB = d; if (d > maxB) maxB = d; }
      var fwd = maxB - minA, back = maxA - minB;
      if (fwd <= 0 || back <= 0) return null;
      if (!best || fwd < best.depth) best = { depth: fwd, nx: nx, ny: ny };
      if (back < best.depth) best = { depth: back, nx: -nx, ny: -ny };
    }
    return best;
  }

  // A convex container as half-planes with outward normals: inside is n.p <= d.
  function makeContainer(poly) {
    var cx = 0, cy = 0, i;
    for (i = 0; i < poly.length; i++) { cx += poly[i][0] / poly.length; cy += poly[i][1] / poly.length; }
    var ns = normals(poly), walls = [];
    for (i = 0; i < poly.length; i++) {
      var nx = ns[i][0], ny = ns[i][1], d = poly[i][0] * nx + poly[i][1] * ny;
      if (cx * nx + cy * ny > d) { nx = -nx; ny = -ny; d = -d; }
      walls.push({ nx: nx, ny: ny, d: d });
    }
    return { poly: poly, walls: walls };
  }

  // How far a polygon pokes through one wall (negative when clear of it).
  function excess(A, w) {
    var m = -Infinity;
    for (var i = 0; i < A.length; i++) { var d = A[i][0] * w.nx + A[i][1] * w.ny; if (d > m) m = d; }
    return m - w.d;
  }

  function pointInside(C, x, y) {
    for (var i = 0; i < C.walls.length; i++) {
      var w = C.walls[i];
      if (x * w.nx + y * w.ny > w.d) return false;
    }
    return true;
  }

  // 'in' fully inside, 'out' clear of the container, 'edge' straddling a wall.
  function zone(A, C) {
    var worst = -Infinity;
    for (var i = 0; i < C.walls.length; i++) { var e = excess(A, C.walls[i]); if (e > worst) worst = e; }
    if (worst <= EPS) return 'in';
    var o = overlap(A, C.poly);
    return (!o || o.depth <= EPS) ? 'out' : 'edge';
  }

  // Judge the whole board. Pieces left out in the tray never count as colliding.
  function evaluate(pieces, C) {
    var n = pieces.length, V = [], st = [], i, j, packed = 0;
    for (i = 0; i < n; i++) { V.push(verts(pieces[i])); st.push({ zone: zone(V[i], C), hit: false }); }
    for (i = 0; i < n; i++) {
      if (st[i].zone === 'out') continue;
      for (j = i + 1; j < n; j++) {
        if (st[j].zone === 'out') continue;
        var o = overlap(V[i], V[j]);
        if (o && o.depth > EPS) { st[i].hit = true; st[j].hit = true; }
      }
    }
    for (i = 0; i < n; i++) { st[i].good = st[i].zone === 'in' && !st[i].hit; if (st[i].good) packed++; }
    return { states: st, packed: packed, solved: packed === n };
  }

  // Nudge piece i out of shallow overlaps so it rests flush against walls and
  // neighbours. Only that piece moves. Returns false (and leaves it alone) when
  // it is in the tray, buried too deep, or there is no clean resting spot nearby.
  function settle(pieces, i, C) {
    var p = pieces[i];
    if (!pointInside(C, p.x, p.y)) return false;
    var x0 = p.x, y0 = p.y, others = [], j, k, A, e, o;
    for (j = 0; j < pieces.length; j++) {
      if (j === i) continue;
      var B = verts(pieces[j]);
      if (zone(B, C) !== 'out') others.push(B);
    }
    var ok = true;
    for (var it = 0; it < 60 && ok; it++) {
      var moved = false;
      for (k = 0; k < C.walls.length && ok; k++) {
        var w = C.walls[k];
        e = excess(verts(p), w);
        if (e > 1e-10) {
          if (e > SNAP) { ok = false; break; }
          p.x -= w.nx * e; p.y -= w.ny * e; moved = true;
        }
      }
      for (k = 0; k < others.length && ok; k++) {
        o = overlap(verts(p), others[k]);
        if (o && o.depth > 1e-10) {
          if (o.depth > SNAP) { ok = false; break; }
          p.x += o.nx * o.depth; p.y += o.ny * o.depth; moved = true;
        }
      }
      if (!moved) break;
    }
    if (ok) {
      var dx = p.x - x0, dy = p.y - y0;
      if (dx * dx + dy * dy > MAX_SLIDE * MAX_SLIDE) ok = false;
    }
    if (ok) {
      A = verts(p);
      for (k = 0; k < C.walls.length; k++) if (excess(A, C.walls[k]) > EPS) ok = false;
      for (k = 0; k < others.length && ok; k++) { o = overlap(A, others[k]); if (o && o.depth > EPS) ok = false; }
    }
    if (!ok) { p.x = x0; p.y = y0; }
    return ok;
  }

  // The magnet. A piece dropped near others turns the last few degrees to line
  // up with a nearby edge, then slides into contact with whatever is closest
  // and along that contact until it meets a second neighbour, so it seats
  // itself in the nook it was dropped beside. Only this piece moves.
  var MAG_TURN = 7;      // degrees the magnet may turn a piece
  var MAG_REACH = 0.2;   // how far the magnet may pull a piece towards its nearest neighbour
  var MAG_SLIDE = 0.2;   // and then along that neighbour to meet a second one

  function edgeList(V) {
    var cx = 0, cy = 0, out = [], i;
    for (i = 0; i < V.length; i++) { cx += V[i][0] / V.length; cy += V[i][1] / V.length; }
    var ns = normals(V);
    for (i = 0; i < V.length; i++) {
      var a = V[i], b = V[(i + 1) % V.length], nx = ns[i][0], ny = ns[i][1];
      if ((a[0] + b[0]) / 2 * nx + (a[1] + b[1]) / 2 * ny < cx * nx + cy * ny) { nx = -nx; ny = -ny; }
      out.push({ a: a, b: b, nx: nx, ny: ny });
    }
    return out;
  }

  // A line the piece may rest against: contact is when the piece's furthest
  // point along (ux, uy) reaches d.
  function reach(V, t) {
    var m = -Infinity;
    for (var i = 0; i < V.length; i++) { var v = V[i][0] * t.ux + V[i][1] * t.uy; if (v > m) m = v; }
    return t.d - m;
  }
  function shared(e, t) {
    var tx = -t.uy, ty = t.ux;
    var p1 = e.a[0] * tx + e.a[1] * ty, p2 = e.b[0] * tx + e.b[1] * ty;
    var q1 = t.a[0] * tx + t.a[1] * ty, q2 = t.b[0] * tx + t.b[1] * ty;
    return Math.min(Math.max(p1, p2), Math.max(q1, q2)) - Math.max(Math.min(p1, p2), Math.min(q1, q2));
  }
  function turnTo(e, t) {
    var d = (Math.atan2(t.uy, t.ux) - Math.atan2(e.ny, e.nx)) * 180 / Math.PI;
    return ((d % 360) + 540) % 360 - 180;
  }

  function span(V, nx, ny) {
    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i < V.length; i++) { var d = V[i][0] * nx + V[i][1] * ny; if (d < lo) lo = d; if (d > hi) hi = d; }
    return [lo, hi];
  }
  // How far outline A can slide along unit direction (dx, dy) before it
  // touches convex B: 0 if already touching or overlapping, Infinity if never.
  function sweep(A, B, dx, dy) {
    var axes = normals(A).concat(normals(B)), enter = -Infinity, exit = Infinity;
    for (var k = 0; k < axes.length; k++) {
      var nx = axes[k][0], ny = axes[k][1], a = span(A, nx, ny), b = span(B, nx, ny), v = dx * nx + dy * ny;
      if (Math.abs(v) < 1e-9) {
        if (a[1] <= b[0] + 1e-9 || b[1] <= a[0] + 1e-9) return Infinity;
        continue;
      }
      var t1 = (b[0] - a[1]) / v, t2 = (b[1] - a[0]) / v;
      enter = Math.max(enter, Math.min(t1, t2)); exit = Math.min(exit, Math.max(t1, t2));
    }
    if (enter > exit - 1e-9 || exit <= 1e-9) return Infinity;
    return Math.max(enter, 0);
  }
  // How far A can slide before anything stops it: a neighbour or a wall.
  function travel(A, others, C, dx, dy) {
    var best = Infinity, k;
    for (k = 0; k < others.length; k++) best = Math.min(best, sweep(A, others[k], dx, dy));
    for (k = 0; k < C.walls.length; k++) {
      var w = C.walls[k], v = dx * w.nx + dy * w.ny;
      if (v > 1e-9) best = Math.min(best, Math.max(0, -excess(A, w) / v));
    }
    return best;
  }

  // Slide piece p into contact with the nearest thing, then along that
  // contact into a second one. Returns true if it moved.
  function seat(p, others, C) {
    var V = verts(p), dirs = [], k, best = null;
    for (k = 0; k < C.walls.length; k++) dirs.push([C.walls[k].nx, C.walls[k].ny]);
    others.forEach(function (B) {
      // head for B along the axis that separates the two the most
      var axes = normals(V).concat(normals(B)), pick = null;
      axes.forEach(function (n) {
        var a = span(V, n[0], n[1]), b = span(B, n[0], n[1]);
        if (b[0] - a[1] > (pick ? pick.gap : -Infinity)) pick = { gap: b[0] - a[1], x: n[0], y: n[1] };
        if (a[0] - b[1] > pick.gap) pick = { gap: a[0] - b[1], x: -n[0], y: -n[1] };
      });
      if (pick && pick.gap > 1e-9 && pick.gap <= MAG_REACH) dirs.push([pick.x, pick.y]);
    });
    dirs.forEach(function (d) {
      var t = travel(V, others, C, d[0], d[1]);
      if (t > 1e-9 && t <= MAG_REACH && (!best || t < best.t)) best = { t: t, x: d[0], y: d[1] };
    });
    if (!best) return false;
    p.x += best.x * best.t; p.y += best.y * best.t;
    V = verts(p);
    var tx = -best.y, ty = best.x, f = travel(V, others, C, tx, ty), r = travel(V, others, C, -tx, -ty);
    if (Math.min(f, r) <= MAG_SLIDE) {
      var s = f <= r ? f : -r;
      p.x += tx * s; p.y += ty * s;
    }
    return true;
  }

  // Returns true when the piece snapped somewhere clean. With keep, it stays
  // lined up even when the spot is not clean (and returns true).
  function magnet(pieces, i, C, keep) {
    var p = pieces[i];
    if (!pointInside(C, p.x, p.y)) return false;
    var x0 = p.x, y0 = p.y, a0 = p.angle, targets = [], others = [], j, k;
    for (k = 0; k < C.walls.length; k++) {
      var w = C.walls[k];
      targets.push({ ux: w.nx, uy: w.ny, d: w.d, a: C.poly[k], b: C.poly[(k + 1) % C.poly.length] });
    }
    for (j = 0; j < pieces.length; j++) {
      if (j === i) continue;
      var B = verts(pieces[j]);
      if (zone(B, C) === 'out') continue;
      others.push(B);
      edgeList(B).forEach(function (e) {
        targets.push({ ux: -e.nx, uy: -e.ny, d: -(e.nx * e.a[0] + e.ny * e.a[1]), a: e.a, b: e.b });
      });
    }

    // turn to match the nearest almost-parallel edge
    var best = null;
    edgeList(verts(p)).forEach(function (e) {
      targets.forEach(function (t) {
        var turn = turnTo(e, t);
        if (Math.abs(turn) > MAG_TURN + 1e-9) return;
        var gap = reach(verts(p), t);
        if (gap < -SNAP || gap > MAG_REACH || shared(e, t) < 0.15) return;
        var score = Math.abs(gap) + Math.abs(turn) * 0.02;
        if (!best || score < best.score) best = { turn: turn, score: score };
      });
    });
    if (best) p.angle = a0 + Math.round(best.turn);

    settle(pieces, i, C);              // out of any shallow overlap first
    var moved = seat(p, others, C);
    if (!best && !moved && p.x === x0 && p.y === y0) return false;

    var V = verts(p);
    var ok = (p.x - x0) * (p.x - x0) + (p.y - y0) * (p.y - y0) <= MAX_SLIDE * MAX_SLIDE;
    for (k = 0; k < C.walls.length && ok; k++) if (excess(V, C.walls[k]) > EPS) ok = false;
    for (k = 0; k < others.length && ok; k++) { var o = overlap(V, others[k]); if (o && o.depth > EPS) ok = false; }
    if (!ok && !keep) { p.x = x0; p.y = y0; p.angle = a0; }
    return keep ? true : ok;
  }

  // Everything that happens to a piece as it is dragged to (x, y). Only that
  // piece ever moves: snap it to a nearby edge if that is a clean fit; else
  // nudge it out of shallow overlaps; else still line it up with the nearest
  // edge so a slightly crooked piece is at least straight (it stays red).
  // Returns 'snap', 'fit' or 'bad'.
  function place(pieces, i, C) {
    var p = pieces[i], x = p.x, y = p.y, a = p.angle;
    if (magnet(pieces, i, C)) return 'snap';
    if (pointInside(C, x, y) && settle(pieces, i, C)) return 'fit';
    p.x = x; p.y = y;
    if (magnet(pieces, i, C, true) && p.angle !== a) { settle(pieces, i, C); return 'bad'; }
    p.x = x; p.y = y; p.angle = a;
    settle(pieces, i, C);
    return 'bad';
  }

  // The shake. If every piece is in the box and each is within a hair of a
  // spot that would finish the board (SHAKE_MOVE away, SHAKE_TURN degrees),
  // return those spots; otherwise null. All pieces may move here, but only
  // when the player asks for a shake.
  var SHAKE_MOVE = 0.08, SHAKE_TURN = 1;

  function relaxAll(Q, home, C, iters) {
    var n = Q.length, V = Q.map(verts), worst = 0, i, j, k;
    function shift(i, dx, dy) {
      Q[i].x += dx; Q[i].y += dy;
      for (var m = 0; m < V[i].length; m++) { V[i][m][0] += dx; V[i][m][1] += dy; }
    }
    for (var it = 0; it < iters; it++) {
      worst = 0;
      for (i = 0; i < n; i++) {
        for (k = 0; k < C.walls.length; k++) {
          var e = excess(V[i], C.walls[k]);
          if (e > 0) { worst = Math.max(worst, e); shift(i, -C.walls[k].nx * e, -C.walls[k].ny * e); }
        }
        for (j = i + 1; j < n; j++) {
          var o = overlap(V[i], V[j]);
          if (o && o.depth > 0) {
            worst = Math.max(worst, o.depth);
            var h = o.depth / 2;
            shift(i, o.nx * h, o.ny * h); shift(j, -o.nx * h, -o.ny * h);
          }
        }
      }
      for (i = 0; i < n; i++) {   // nobody wanders further than a hair from where it was
        var dx = Q[i].x - home[i].x, dy = Q[i].y - home[i].y, d = Math.sqrt(dx * dx + dy * dy);
        if (d > SHAKE_MOVE) { var f = SHAKE_MOVE / d; shift(i, home[i].x + dx * f - Q[i].x, home[i].y + dy * f - Q[i].y); }
      }
      if (worst < EPS / 4) break;
    }
    // how much overlap is left, in total
    var left = 0;
    for (i = 0; i < n; i++) {
      for (k = 0; k < C.walls.length; k++) left += Math.max(0, excess(V[i], C.walls[k]));
      for (j = i + 1; j < n; j++) { var q = overlap(V[i], V[j]); if (q) left += q.depth; }
    }
    return { worst: worst, left: left };
  }

  function shake(pieces, C, budgetMs) {
    var n = pieces.length, i;
    for (i = 0; i < n; i++) if (!pointInside(C, pieces[i].x, pieces[i].y)) return null;
    var home = pieces.map(function (p) { return { x: p.x, y: p.y }; }), base = pieces.map(function (p) { return p.angle; });
    var until = Date.now() + (budgetMs || 150);
    function attempt(angles) {
      var Q = pieces.map(function (p, k) { return { type: p.type, size: p.size, x: p.x, y: p.y, angle: angles[k] }; });
      var r = relaxAll(Q, home, C, 250);
      return { Q: Q, r: r.left, solved: r.worst < EPS && evaluate(Q, C).solved };
    }
    var angles = base.slice(), cur = attempt(angles);
    // pieces meant to sit at a round angle are usually a degree off it, so try that first
    var round = base.map(function (a) { var r = Math.round(a / 5) * 5; return Math.abs(r - a) <= SHAKE_TURN ? r : a; });
    if (!cur.solved && round.some(function (a, k) { return a !== base[k]; })) {
      var rr = attempt(round);
      if (rr.solved || rr.r < cur.r) { cur = rr; angles = round; }
    }
    // then try turning single pieces by a degree, keeping whatever helps
    for (var pass = 0; pass < 3 && !cur.solved && Date.now() < until; pass++) {
      var st = evaluate(cur.Q, C).states;
      for (i = 0; i < n && !cur.solved && Date.now() < until; i++) {
        if (st[i].good && pass === 0) continue;   // the culprits first, then anyone
        for (var d = -SHAKE_TURN; d <= SHAKE_TURN && !cur.solved; d++) {
          var trial = angles.slice(); trial[i] = base[i] + d;
          if (trial[i] === angles[i]) continue;
          var r = attempt(trial);
          if (r.solved || r.r < cur.r - 1e-6) { cur = r; angles = trial; }
        }
      }
    }
    return cur.solved ? cur.Q.map(function (q) { return { x: q.x, y: q.y, angle: q.angle }; }) : null;
  }

  function bounds(poly) {
    var b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (var i = 0; i < poly.length; i++) {
      if (poly[i][0] < b.minX) b.minX = poly[i][0]; if (poly[i][0] > b.maxX) b.maxX = poly[i][0];
      if (poly[i][1] < b.minY) b.minY = poly[i][1]; if (poly[i][1] > b.maxY) b.maxY = poly[i][1];
    }
    return b;
  }

  return {
    H: H, EPS: EPS, SHAPES: SHAPES,
    verts: verts, overlap: overlap, makeContainer: makeContainer, excess: excess,
    pointInside: pointInside, zone: zone, evaluate: evaluate, settle: settle, magnet: magnet, place: place, shake: shake, bounds: bounds
  };
})();
