# The geometry is right: geom.js by itself, on cases whose answers are known without it.
import math

H = math.sqrt(3) / 2
JS = '''(function () {
  var G = PackmanGeom;
  function P(type, x, y, angle) { return { type: type, size: 1, x: x, y: y, angle: angle || 0 }; }
  function box(s) { var h = s / 2; return [[-h, -h], [h, -h], [h, h], [-h, h]]; }
  function at(poly, dx) { return poly.map(function (p) { return [p[0] + dx, p[1]]; }); }
  return (%s);
})()'''

async def js(t, expr):
    page = await t.bare('geom.js', 'levels.js')
    out = await page.evaluate(JS % expr)
    assert not page.errors, page.errors
    return out

def near(a, b, tol=1e-9): return abs(a - b) <= tol

async def test_shapes_have_sides_of_one(t):
    S = await js(t, 'G.SHAPES')
    assert set(S) == {'square', 'triangle', 'domino', 'hexagon'}
    for name, poly in S.items():
        sides = [math.dist(poly[i], poly[(i + 1) % len(poly)]) for i in range(len(poly))]
        want = [2, 1, 2, 1] if name == 'domino' else [1] * len(poly)
        assert all(near(a, b) for a, b in zip(sides, want)), '%s has sides %s' % (name, sides)
    tri = S['triangle']
    assert near(sum(p[0] for p in tri), 0) and near(sum(p[1] for p in tri), 0), 'the triangle is not centred on its middle'

async def test_a_shape_turns_about_its_middle(t):
    v = await js(t, '[G.verts(P("square", 3, 4, 0)), G.verts(P("square", 3, 4, 90)), G.verts(P("domino", 0, 0, 90)), G.verts({ type: "square", size: 2, x: 0, y: 0, angle: 0 })]')
    assert v[0] == [[2.5, 3.5], [3.5, 3.5], [3.5, 4.5], [2.5, 4.5]]
    assert all(near(a, b) for p, q in zip(v[1], [[3.5, 3.5], [3.5, 4.5], [2.5, 4.5], [2.5, 3.5]]) for a, b in zip(p, q)), v[1]   # a quarter turn carries each corner to the next
    assert near(max(p[1] for p in v[2]), 1) and near(max(p[0] for p in v[2]), 0.5), 'a brick stood on end is two high and one wide'
    assert near(max(p[0] for p in v[3]), 1), 'size scales a shape'

async def test_overlap_says_how_deep_and_which_way_out(t):
    r = await js(t, '''[
      G.overlap(G.verts(P("square", 0, 0)), G.verts(P("square", 0.7, 0))),      // 0.3 into each other, side by side
      G.overlap(G.verts(P("square", 0, 0)), G.verts(P("square", 1, 0))),        // touching along a side
      G.overlap(G.verts(P("square", 0, 0)), G.verts(P("square", 1.001, 0))),    // a hair apart
      G.overlap(G.verts(P("square", 0, 0)), G.verts(P("square", 0, 0))),        // one on top of the other
      G.overlap(G.verts(P("square", 0, 0)), G.verts(P("square", 0.9, 0.9, 45))),// a corner near a corner, apart
      G.overlap(G.verts(P("triangle", 0, 0)), G.verts(P("triangle", 0, 0.5774, 180)))  // point to point down a shared side: apart
    ]''')
    assert r[0] and near(r[0]['depth'], 0.3) and near(r[0]['nx'], -1) and near(r[0]['ny'], 0), 'two squares 0.3 into each other: %s' % r[0]
    assert r[1] is None, 'squares that only touch do not overlap: %s' % r[1]
    assert r[2] is None
    assert r[3] and near(r[3]['depth'], 1)
    assert r[4] is None, 'a square and a tilted one, corners apart: %s' % r[4]
    assert r[5] is None or r[5]['depth'] < 1e-4, r[5]

async def test_a_box_knows_inside_from_outside(t):
    r = await js(t, '''(function () { var C = G.makeContainer(box(2)); return [
      G.pointInside(C, 0, 0), G.pointInside(C, 0.999, -0.999), G.pointInside(C, 1.001, 0), G.pointInside(C, 0, -5),
      G.zone(G.verts(P("square", 0.5, 0.5)), C),      // snug in a corner
      G.zone(G.verts(P("square", 0.501, 0.5)), C),    // into the wall by less than a hair counts as in
      G.zone(G.verts(P("square", 0.51, 0.5)), C),     // into the wall by more does not
      G.zone(G.verts(P("square", 1, 0)), C),          // half in, half out
      G.zone(G.verts(P("square", 1.5, 0)), C),        // outside, touching the wall
      G.zone(G.verts(P("square", 4, 4)), C),          // far away
      G.excess(G.verts(P("square", 0.7, 0)), C.walls[1]), C.walls.length ]; })()''')
    assert r[:4] == [True, True, False, False], r[:4]
    assert r[4:10] == ['in', 'in', 'edge', 'edge', 'out', 'out'], r[4:10]
    assert near(r[10], 0.2) and r[11] == 4

async def test_the_walls_face_out_whichever_way_a_box_is_listed(t):
    r = await js(t, '''[box(2), box(2).slice().reverse()].map(function (poly) { var C = G.makeContainer(poly);
      return [G.pointInside(C, 0, 0), G.pointInside(C, 1.5, 0), G.zone(G.verts(P("square", 0, 0)), C)]; })''')
    assert r[0] == r[1] == [True, False, 'in'], r

async def test_the_judge_counts_what_is_packed(t):
    r = await js(t, '''(function () { var C = G.makeContainer(box(2)); function go(Q) { var e = G.evaluate(Q, C); return [e.packed, e.solved, e.states.map(function (s) { return s.zone + (s.hit ? "!" : ""); }).join(" ")]; }
      var four = [P("square", -0.5, -0.5), P("square", 0.5, -0.5), P("square", -0.5, 0.5), P("square", 0.5, 0.5)];
      return [ go(four),
        go(four.slice(0, 3).concat([P("square", 5, 5)])),                 // one still in the tray
        go(four.slice(0, 3).concat([P("square", 0.4, 0.5)])),             // one a tenth into its neighbour
        go(four.slice(0, 3).concat([P("square", 0.5, 0.5, 20)])),         // one turned so it pokes into two neighbours and the wall
        go([P("square", 5, 5), P("square", 5.2, 5)]),                     // two overlapping out in the tray: no matter
        go([]) ]; })()''')
    assert r[0] == [4, True, 'in in in in'], r[0]
    assert r[1] == [3, False, 'in in in out'], r[1]
    assert r[2][0] == 2 and r[2][1] is False and r[2][2] == 'in in in! in!', r[2]
    assert r[3][1] is False and r[3][2].endswith('edge!'), r[3]
    assert r[4] == [0, False, 'out out'], r[4]
    assert r[5] == [0, True, ''], 'an empty board is packed: %s' % r[5]

async def test_two_boxes_on_one_board(t):
    r = await js(t, '''(function () { var L = at(box(2), -2), R = at(box(1), 2), C = G.makeBoxes([L, R]);
      function z(x, y) { return G.zone(G.verts(P("square", x, y)), C); }
      return [ C.parts.length, C.walls.length, G.pointInside(C, -2, 0), G.pointInside(C, 2, 0), G.pointInside(C, 0, 0),
        G.part(C, -2.2, 0) === C.parts[0], G.part(C, 2.1, 0) === C.parts[1], G.part(C, 0.9, 0) === C.parts[1], G.part(C, -0.6, 0) === C.parts[0],
        z(-2.5, -0.5), z(2, 0), z(0, 0), z(-1, 0), z(2.3, 0),
        G.evaluate([P("square", -2.5, -0.5), P("square", -1.5, -0.5), P("square", -2.5, 0.5), P("square", -1.5, 0.5), P("square", 2, 0)], C).solved,
        G.evaluate([P("square", -2.5, -0.5), P("square", 2, 0), P("square", 2, 0)], C).packed ]; })()''')
    assert r[:5] == [2, 8, True, True, False], r[:5]
    assert r[5:9] == [True, True, True, True], 'a point belongs to the box it is in, or the nearer: %s' % r[5:9]
    assert r[9:14] == ['in', 'in', 'out', 'edge', 'edge'], r[9:14]
    assert r[14] is True, 'four in the big box and one in the small one is packed'
    assert r[15] == 1, 'two in the same place in the small box: neither counts'

async def test_settling_pushes_a_shape_clear_and_no_further(t):
    r = await js(t, '''(function () { var C = G.makeContainer(box(2));
      function go(Q, i) { var ok = G.settle(Q, i, C); return [ok, Q[i].x, Q[i].y, Q.map(function (p) { return [p.x, p.y]; })]; }
      return [ go([P("square", 0.6, 0.55)], 0),                               // a little through two walls: back to the corner
               go([P("square", -0.5, -0.5), P("square", 0.4, -0.5)], 1),      // a tenth into a neighbour: pushed off it, and the neighbour left alone
               go([P("square", 0.9, 0)], 0),                                  // far through a wall: too deep to push out of
               go([P("square", 3, 3)], 0),                                    // in the tray
               go([P("square", -0.5, -0.5), P("square", -0.4, -0.45)], 1) ]; })()''')
    assert r[0][0] and near(r[0][1], 0.5) and near(r[0][2], 0.5), r[0]
    assert r[1][0] and near(r[1][1], 0.5) and r[1][3][0] == [-0.5, -0.5], r[1]
    assert r[2][0] is False and r[2][1] == 0.9, 'left where it was: %s' % r[2]
    assert r[3][0] is False and r[3][1] == 3
    assert r[4][0] is False and r[4][1] == -0.4, 'buried in another: left where it was: %s' % r[4]

async def test_putting_a_shape_down_seats_it(t):
    """place is what the game calls when a shape is let go: near enough to a nook, it is drawn into it."""
    r = await js(t, '''(function () { var C = G.makeContainer(box(2.004));
      var Q = [P("square", -0.5, -0.5), P("square", 0.5, -0.5), P("square", -0.5, 0.5), P("square", 0.46, 0.53, 2)];
      Q[0].x = -0.501; Q[0].y = -0.501; Q[1].x = 0.501; Q[1].y = -0.501; Q[2].x = -0.501; Q[2].y = 0.501;
      var said = G.place(Q, 3, C), e = G.evaluate(Q, C);
      var out = [P("square", 5, 5, 10)], far = G.place(out, 0, C);
      return [said, e.solved, Q[3].angle, far, out[0].x, out[0].angle]; })()''')
    assert r[0] in ('snap', 'fit') and r[1] is True, 'the fourth square, dropped a little off and a little turned: %s' % r
    assert r[2] % 90 == 0, 'it is turned square to the box: %s' % r[2]
    assert r[3] == 'bad' and r[4] == 5 and r[5] == 10, 'a shape put down in the tray is left alone: %s' % r[3:]

async def test_a_sweep_says_how_far_before_two_shapes_meet(t):
    r = await js(t, '''(function () { var A = G.verts(P("square", 0, 0)), B = G.verts(P("square", 3, 0));
      return [G.sweep(A, B, 1, 0), G.sweep(A, B, -1, 0) === Infinity, G.sweep(A, B, 0, 1) === Infinity, G.sweep(A, G.verts(P("square", 3, 2)), 1, 0) === Infinity,
              G.bounds(G.verts(P("domino", 1, 1)))]; })()''')
    assert near(r[0], 2) and r[1:4] == [True, True, True], r[:4]
    assert r[4] == {'minX': 0, 'minY': 0.5, 'maxX': 2, 'maxY': 1.5}, r[4]

# Every level, played by a simple machine: each shape let go on its place (or a hair off it), one after another in
# the order they are listed, with whatever the magnet and the settling then do to it, and the box shaken at the end
# if it is not yet packed, as the game shakes it.
PLAY = '''PackmanLevels.map(function (l) {
    var C = l.containers ? G.makeBoxes(l.containers) : G.makeContainer(l.container);
    var seed = %d, rnd = function () { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff - 0.5; };
    var Q = l.pieces.map(function (t) { return P(t, 50, 50); });
    l.solution.forEach(function (s, i) { Q[i].x = s[0] + rnd() * %f; Q[i].y = s[1] + rnd() * %f; Q[i].angle = s[2]; G.place(Q, i, C); });
    var e = G.evaluate(Q, C);
    if (!e.solved) { var s = G.shake(Q, C, 400); if (s) { s.forEach(function (q, i) { Q[i].x = q.x; Q[i].y = q.y; Q[i].angle = q.angle; }); e = G.evaluate(Q, C); } }
    return { name: l.name, solved: e.solved };
  })'''

# The two it cannot do. Their solutions have shapes that touch nothing until the rest are in, and the magnet slides
# them away to the nearest wall; a player puts them in last, or holds them off. They are tight on purpose.
FIDDLY = {'Eleven', 'Eleven Bricks'}

async def test_a_simple_machine_can_pack_every_level_but_the_two_tightest(t):
    """If another level joins the two, the magnet or the settling has changed how shapes sit, or a new level wants
    more care than a player will have: look before adding it to FIDDLY. If one of the two now packs, take it out."""
    stuck = set()
    for seed, off in ((1, 0), (1, 0.004), (2, 0.004)):
        stuck |= set(l['name'] for l in await js(t, PLAY % (seed, off, off)) if not l['solved'])
    assert stuck == FIDDLY, 'the machine could not pack %s; it is known not to manage %s' % (sorted(stuck) or 'nothing', sorted(FIDDLY))

async def test_a_packing_a_hair_out_is_shaken_home(t):
    """Every shape of a finished board pushed two hundredths off its place, this way and that: the shake finds the packing again."""
    r = await js(t, '''PackmanLevels.map(function (l) {
      var C = l.containers ? G.makeBoxes(l.containers) : G.makeContainer(l.container);
      var Q = l.pieces.map(function (t, i) { var s = l.solution[i]; return P(t, s[0] + (i % 2 ? 0.02 : -0.02), s[1] + (i % 3 ? 0.015 : -0.015), s[2]); });
      if (G.evaluate(Q, C).solved) return { name: l.name, home: true };
      var got = G.shake(Q, C, 400);
      return { name: l.name, home: !!got && G.evaluate(got.map(function (q, i) { return P(l.pieces[i], q.x, q.y, q.angle); }), C).solved };
    })''')
    lost = set(l['name'] for l in r if not l['home'])
    assert lost == FIDDLY, 'the shake did not finish %s; it is known not to finish %s' % (sorted(lost) or 'nothing', sorted(FIDDLY))
