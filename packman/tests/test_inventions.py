# The inventions of the fifth chapter: each level's rule of its own, judged by geom.js and worked in the real page.
from harness import player, tick, drag, turn, put, tap

async def level(t, name, **how):
    page = await player(await t.page(level=name, **how))
    assert not page.errors, page.errors
    return page

async def shapes(page): return await page.evaluate('T.pieces()')
async def won(page): return await page.evaluate('document.getElementById("bin").classList.contains("win")')
async def solution(page): return await page.evaluate('Packman.level().solution')
def at(p, x, y, tol=0.03): return abs(p['x'] - x) < tol and abs(p['y'] - y) < tol

# ---- the rules, as geom.js judges them (and the leaderboard with it) ----

VERDICT = '''(function () {
  var G = PackmanGeom, L = {};
  PackmanLevels.forEach(function (l) { L[l.name] = l; });
  function judge(l, spots) {
    var C = G.makeContainer(l.container), P = l.pieces.map(function (t, i) { var s = spots[i]; return { type: t, size: 1, x: s[0], y: s[1], angle: s[2] }; });
    return G.evaluate(P, C).solved && G.verdict(l, P, C).ok;
  }
  var see = L['Seesaw'], seat = L['Sam’s Seating Plan'], s = seat.solution.map(function (v) { return v.slice(); }), t;
  t = s[3]; s[3] = s[6]; s[6] = t;   // the cat and the kid change places
  var w = see.solution.map(function (v) { return [-v[0], v[1], v[2]]; });   // the seesaw's packing, turned round end to end
  return { seesaw: judge(see, see.solution), backwards: judge(see, w), seating: judge(seat, seat.solution), swapped: judge(seat, s),
           sad: G.verdict(seat, seat.pieces.map(function (k, i) { return { type: k, size: 1, x: s[i][0], y: s[i][1], angle: s[i][2] }; }), G.makeContainer(seat.container)).sad };
})()'''

async def test_the_rules_of_a_level_are_judged_with_the_packing(t):
    """A packing that fits is not enough where a level has rules of its own: Seesaw's packed end to end the wrong way does not
    balance, and Seating Plan's with two guests changed round leaves both of them unhappy."""
    page = await t.bare('geom.js', 'levels.js')
    r = await page.evaluate(VERDICT)
    assert r['seesaw'] and r['seating'], 'the solutions themselves do not keep their rules: %s' % r
    assert not r['backwards'], 'Seesaw packed the wrong way round still balances'
    assert not r['swapped'], 'Seating Plan with the cat and the kid changed round is still judged packed'
    assert [i for i, v in enumerate(r['sad']) if v] == [3, 6], 'the unhappy guests are %s, and should be the cat and the kid' % r['sad']

# ---- in the page ----

async def test_a_kaleidoscope_copy_goes_where_its_shape_goes(t):
    page = await level(t, 'Kaleidoscope')
    sol = await solution(page)
    await put(page, 0, sol[0])
    p = await shapes(page)
    for j, a in ((3, 120), (6, 240)):   # a third, and two thirds, of a turn round the middle
        import math
        r = math.radians(a); x = p[0]['x'] * math.cos(r) - p[0]['y'] * math.sin(r); y = p[0]['x'] * math.sin(r) + p[0]['y'] * math.cos(r)
        assert at(p[j], x, y, 1e-3) and (p[j]['angle'] - p[0]['angle'] - a) % 360 == 0, 'copy %d is at %s, and its shape at %s' % (j, p[j], p[0])
        assert 'away' not in p[j]['cls'], 'copy %d is hidden with its shape in the box' % j
    await drag(page, 0, 0, 3.4)   # out under the box, where the tray is on a phone
    p = await shapes(page)
    assert all('away' in p[j]['cls'] for j in (3, 6)), 'a shape taken out of the box leaves its copies in it'
    for i in (0, 1, 2): await put(page, i, sol[i])   # (the first going in first: in among the others, the magnet would straighten it the last few degrees)
    await tick(page, 1500)
    assert await won(page), 'three shapes in their places, and their copies in theirs, is not a win'
    assert not page.errors, page.errors

async def test_one_shot_nails_a_shape_down(t):
    page = await level(t, 'One Shot')
    sol = await solution(page)
    await put(page, 4, sol[4])
    before = (await shapes(page))[4]
    assert 'nailed' in before['cls'], 'let go of in the box, the hexagon is not nailed'
    g = await page.evaluate('T.grip(4)')
    await page.mouse.move(*g['at']); await page.mouse.down(); await tick(page, 40)
    await page.mouse.move(g['at'][0] + 120, g['at'][1]); await tick(page, 60); await page.mouse.up(); await tick(page, 200)
    after = (await shapes(page))[4]
    assert (after['x'], after['y'], after['angle']) == (before['x'], before['y'], before['angle']), 'a nailed shape moved'
    for i in (0, 1, 2, 3): await put(page, i, sol[i])
    await tick(page, 1500)
    assert await won(page)
    assert not page.errors, page.errors

async def test_a_landslide_fills_from_the_bottom(t):
    """A shape let go of high in the box slides down to the bottom corner, and the next comes to rest beside it.
    Shapes go in over the top: the two walls under the box stop them."""
    page = await level(t, 'Landslide')
    for i, x in ((4, -0.5), (5, 0.8)):
        await turn(page, i, 45)
        p = (await shapes(page))[i]
        await drag(page, i, p['x'], -3.2)   # up, clear of the box
        await drag(page, i, x, -3.2); await drag(page, i, x, -0.8); await tick(page, 1500)
    p = await shapes(page)
    assert at(p[4], 0, 2.1213), 'the first square came to rest at (%.3f, %.3f), not in the bottom corner' % (p[4]['x'], p[4]['y'])
    assert at(p[5], 0.7071, 1.4142) or at(p[5], -0.7071, 1.4142), 'the second square came to rest at (%.3f, %.3f), not beside the first' % (p[5]['x'], p[5]['y'])
    assert not page.errors, page.errors

async def test_the_loading_dock_lets_shapes_in_by_the_door_only(t):
    page = await level(t, 'Loading Dock')
    p = (await shapes(page))[0]
    side = 1 if p['x'] > 0 else -1
    await drag(page, 0, side * 3.2, -0.9 * side)   # out to one side, level with a wall
    await drag(page, 0, 0, -0.9 * side, steps=20)
    p = (await shapes(page))[0]
    assert abs(p['x']) > 2.0 or abs(p['y']) > 1.5, 'a square was carried in through a wall, to (%.2f, %.2f)' % (p['x'], p['y'])
    await drag(page, 0, side * 3.2, 2.3 * side); await drag(page, 0, 3.2, 2.3 * side); await drag(page, 0, 3.2, 0.85)   # round the outside, to the door
    await drag(page, 0, 0.5, 0.85, steps=24)
    p = (await shapes(page))[0]
    assert at(p, 0.5, 0.85, 0.05), 'a square carried in through the door stopped at (%.2f, %.2f)' % (p['x'], p['y'])
    assert not page.errors, page.errors

async def test_the_loading_dock_can_be_packed_through_its_door(t):
    """The whole level played with the mouse, every shape carried round the outside and in by the door, the way the
    hint goes: a brick stood up in the middle, the next where there is only just room, and the third, with room
    nowhere, tipped up a few degrees at a time in the doorway."""
    page = await level(t, 'Loading Dock')
    async def bring(i, x, y=0.85):   # round the outside, under the box, to the bay in front of the door, and in
        p = (await shapes(page))[i]
        if p['x'] < 2.6: await drag(page, i, p['x'], 2.4); await drag(page, i, 3.7, 2.4)
        await drag(page, i, 3.7, 0.85); await drag(page, i, x, 0.85, steps=24)
        if y != 0.85: await drag(page, i, x, y, steps=12)
    def where(p): return [(round(q['x'], 3), round(q['y'], 3), q['angle']) for q in p]
    await bring(3, 0, 0); await turn(page, 3, 90); await drag(page, 3, -1.6, 0.6, steps=16)
    await bring(0, -1.5, 0); await drag(page, 0, -1.6, -1.1)
    await bring(4, 0.5, 0); await turn(page, 4, 90); await drag(page, 4, -0.5, -0.6, steps=16)
    await bring(5, 1.5, 0.7)
    for a in range(0, 60, 3):   # as a player does it: a few degrees, the room it then has to turn in found, and on
        x, y, n = await page.evaluate(ROOMY + '(5, %d, %d)' % (a, a + 3))
        assert n >= 25, 'at %d degrees the brick has room to turn on only %d spots' % (a, n)
        await drag(page, 5, x, y, steps=2); await twist(page, 5, a + 3)
    await turn(page, 5, 90); await drag(page, 5, 0.5, -0.6, steps=16)
    await bring(1, 1.5, 0.85); await drag(page, 1, 1.5, -1.1)
    await bring(2, 1.5, 0.85); await drag(page, 2, 1.5, 0)
    await bring(6, 1, 1.1)
    await tick(page, 1500)
    assert await won(page), 'packed through the door, the dock is not won: %s' % where(await shapes(page))
    assert not page.errors, page.errors
# The middle of the spots near the doorway where shape i could be turned from angle a to b, the walls and the shapes
# in the box where they are, and how many spots there are (on a grid a fiftieth of a square apart)
ROOMY = '''(function (i, a, b) {
  var G = PackmanGeom, lv = Packman.level(), P = Packman.pieces();
  var solid = lv.walls.map(function (w) { var dx = w[2] - w[0], dy = w[3] - w[1], l = Math.hypot(dx, dy), nx = dy / l, ny = -dx / l;
    if (w[0] * nx + w[1] * ny < 0) { nx = -nx; ny = -ny; }
    return [[w[0], w[1]], [w[2], w[3]], [w[2] + nx * 0.12, w[3] + ny * 0.12], [w[0] + nx * 0.12, w[1] + ny * 0.12]]; })
    .concat(P.filter(function (q, j) { return j !== i && Math.abs(q.x) < 2.1 && Math.abs(q.y) < 1.6; }).map(G.verts));
  function free(x, y, t) { var A = G.verts({ type: P[i].type, x: x, y: y, angle: t }); return !solid.some(function (B) { var o = G.overlap(A, B); return o && o.depth > G.EPS; }); }
  var sx = 0, sy = 0, n = 0;
  for (var x = 1.2; x <= 1.9; x += 0.02) for (var y = 0; y <= 0.9; y += 0.02) {
    var ok = true; for (var t = a; t <= b && ok; t++) ok = free(x, y, t);
    if (ok) { sx += x; sy += y; n++; } }
  return [sx / n, sy / n, n];
})'''
async def twist(page, i, angle):   # turned towards an angle, as far as it has room to go
    await tap(page, i); await page.fill('#ang', str(angle)); await page.press('#ang', 'Enter'); await tick(page, 200)

async def test_a_loading_dock_hint_shows_a_shape_its_whole_way(t):
    """One spot is one brick's way: in to the middle, stood up there, and pushed to the back, each shown as the last is done."""
    page = await level(t, 'Loading Dock')
    ghost = '''(function () { var g = document.getElementById("ghost"); if (g.hasAttribute("hidden")) return null;
      var m = g.transform.baseVal.consolidate().matrix; return [Math.round(m.e * 100) / 100, Math.round(m.f * 100) / 100, Math.round(Math.atan2(m.b, m.a) * 180 / Math.PI)]; })()'''
    await page.click('#b-hint'); await tick(page, 400); await page.click('#hint-spot'); await tick(page, 800)
    assert await page.evaluate(ghost) == [0, 0, 0], 'the first spot is not a brick lying in the middle: %s' % await page.evaluate(ghost)
    p = (await shapes(page))[3]
    await drag(page, 3, p['x'], 2.4); await drag(page, 3, 3.7, 2.4); await drag(page, 3, 3.7, 0.85); await drag(page, 3, 0, 0.85, steps=24); await drag(page, 3, 0, 0, steps=12)
    assert await page.evaluate(ghost) == [0, 0, 90], 'brought in, the brick is not shown stood up: %s' % await page.evaluate(ghost)
    await turn(page, 3, 90)
    assert await page.evaluate(ghost) == [-1.5, 0.5, 90], 'stood up, the brick is not shown its place at the back: %s' % await page.evaluate(ghost)
    assert await page.evaluate('!document.getElementById("ghost-way").hasAttribute("hidden")'), 'no line from where it stands to where it goes'
    await drag(page, 3, -1.5, 0.6, steps=16)
    assert await page.evaluate(ghost) is None, 'the brick is in its place and a spot still shows'
    assert not page.errors, page.errors

async def test_a_seesaw_has_to_balance(t):
    page = await level(t, 'Seesaw')
    sol = await solution(page)
    back = [[-s[0], s[1], s[2]] for s in sol]   # packed end to end the wrong way
    for i in (4, 3, 0, 1, 2): await put(page, i, back[i])
    await tick(page, 1500)
    assert not await won(page), 'a box that tips is won'
    assert 'tips' in await page.evaluate('document.querySelector(".scale .say").textContent'), 'nothing says which way the box tips'
    for i in range(5): await drag(page, i, -4 + i * 0.1, -2.2)   # all out again
    for i in (4, 3, 1, 2, 0): await put(page, i, sol[i])
    await tick(page, 1500)
    assert await won(page), 'the balanced packing is not won'
    assert not page.errors, page.errors

async def test_every_guest_has_a_wish_and_a_say(t):
    page = await level(t, 'Sam’s Seating Plan')
    sol = await solution(page)
    seats = [list(s) for s in sol]; seats[3], seats[6] = sol[6], sol[3]   # the cat and the kid in each other's places
    for i in range(9): await put(page, i, seats[i])
    await tick(page, 1500)
    p = await shapes(page)
    assert not await won(page), 'the party is won with two guests unhappy'
    assert [s['i'] for s in p if 'sad' in s['cls']] == [3, 6], 'the unhappy guests should be the cat and the kid'
    await tap(page, 6)
    assert 'four shapes' in await page.evaluate('document.getElementById("power-note").textContent'), 'the kid in hand does not say what it wants'
    assert not page.errors, page.errors

async def test_a_blind_box_is_seen_only_round_the_shapes(t):
    """The box is drawn only just round each shape, a few pixels past its edges, where it is now. Packed, it shows whole."""
    page = await level(t, 'Blind Box')
    masked = 'document.getElementById("bin").getAttribute("mask")'
    assert await page.evaluate(masked), 'the box can be seen'
    sight = '(function () { var t = document.querySelectorAll(".fog .sees path")[5].transform.baseVal.consolidate().matrix; return [t.e, t.f]; })()'
    sol = await solution(page)
    await put(page, 5, sol[5])
    at = await page.evaluate(sight)
    assert abs(at[0] - sol[5][0]) < 0.01 and abs(at[1] - sol[5][1]) < 0.01, 'the box does not show round the brick, where it is'
    assert await page.evaluate('document.querySelectorAll(".fog .sees path").length') == 6, 'the box shows round something other than the shapes'
    for i in range(5): await put(page, i, sol[i])
    await tick(page, 2500)
    assert await won(page) and not await page.evaluate(masked), 'packed, the box does not show whole'
    assert not page.errors, page.errors
