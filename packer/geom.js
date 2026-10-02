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
  var MAX_BUDGE = 0.2; // furthest a drop may shove any other piece aside

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

  // The drop fallback: let every piece in the container shuffle over a little,
  // the way real blocks would, so piece i can squeeze in. All or nothing: if the
  // shuffle does not leave piece i clean, or spoils a piece that was fine, undo it.
  function shuffle(pieces, i, C) {
    var n = pieces.length, before = evaluate(pieces, C), saved = [], movers = [], fixed = [], j, k, a, b, o;
    if (!pointInside(C, pieces[i].x, pieces[i].y)) return false;
    for (j = 0; j < n; j++) {
      saved.push([pieces[j].x, pieces[j].y]);
      if (pointInside(C, pieces[j].x, pieces[j].y)) movers.push(j);
      else if (before.states[j].zone !== 'out') fixed.push(verts(pieces[j]));
    }
    var ok = true;
    for (var it = 0; it < 200 && ok; it++) {
      var worst = 0;
      for (a = 0; a < movers.length && ok; a++) {
        var p = pieces[movers[a]];
        for (k = 0; k < C.walls.length; k++) {
          var w = C.walls[k], e = excess(verts(p), w);
          if (e > 1e-10) { if (e > SNAP) { ok = false; break; } worst = Math.max(worst, e); p.x -= w.nx * e; p.y -= w.ny * e; }
        }
        for (k = 0; k < fixed.length && ok; k++) {
          o = overlap(verts(p), fixed[k]);
          if (o && o.depth > 1e-10) { if (o.depth > SNAP) { ok = false; break; } worst = Math.max(worst, o.depth); p.x += o.nx * o.depth; p.y += o.ny * o.depth; }
        }
        for (b = a + 1; b < movers.length && ok; b++) {
          var q = pieces[movers[b]];
          o = overlap(verts(p), verts(q));
          if (o && o.depth > 1e-10) {
            if (o.depth > SNAP) { ok = false; break; }
            worst = Math.max(worst, o.depth);
            var h = o.depth / 2;
            p.x += o.nx * h; p.y += o.ny * h; q.x -= o.nx * h; q.y -= o.ny * h;
          }
        }
      }
      if (worst < EPS / 4) break;
    }
    if (ok) {
      for (j = 0; j < n; j++) {
        var dx = pieces[j].x - saved[j][0], dy = pieces[j].y - saved[j][1];
        var lim = j === i ? MAX_SLIDE : MAX_BUDGE;
        if (dx * dx + dy * dy > lim * lim) ok = false;
      }
    }
    if (ok) {
      var after = evaluate(pieces, C);
      if (!after.states[i].good) ok = false;
      for (j = 0; j < n; j++) if (before.states[j].good && !after.states[j].good) ok = false;
    }
    if (!ok) for (j = 0; j < n; j++) { pieces[j].x = saved[j][0]; pieces[j].y = saved[j][1]; }
    return ok;
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
    pointInside: pointInside, zone: zone, evaluate: evaluate, settle: settle, shuffle: shuffle, bounds: bounds
  };
})();
