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
    assert abs(p['x']) > 2.0 or abs(p['y']) > 1.15, 'a square was carried in through a wall, to (%.2f, %.2f)' % (p['x'], p['y'])
    await drag(page, 0, side * 3.2, 1.9 * side); await drag(page, 0, 3.2, 1.9); await drag(page, 0, 3.2, 0.5)   # round the outside, to the door
    await drag(page, 0, 0.5, 0.5, steps=24)
    p = (await shapes(page))[0]
    assert at(p, 0.5, 0.5, 0.05), 'a square carried in through the door stopped at (%.2f, %.2f)' % (p['x'], p['y'])
    assert not page.errors, page.errors

async def test_the_loading_dock_can_be_packed_through_its_door(t):
    """The whole level played with the mouse, every shape carried round the outside and in by the door: the bricks
    stood up in the middle and pushed to the back, the squares up to the ceiling, and the last brick along the floor."""
    page = await level(t, 'Loading Dock')
    async def bring(i):   # round the outside, under the box, to the bay in front of the door, and in
        p = (await shapes(page))[i]
        if p['x'] < 2.4: await drag(page, i, p['x'], 1.95); await drag(page, i, 3.4, 1.95)
        await drag(page, i, 3.4, 0.55); await drag(page, i, 0.6, 0.55, steps=24)
    for i, x in ((2, -1.5), (3, -0.5)):
        await bring(i)
        await drag(page, i, 0.5, 0)
        await turn(page, i, 90)
        await drag(page, i, x, 0, steps=16)
    await bring(0); await drag(page, 0, 0.5, 0.55); await drag(page, 0, 0.5, -0.65)
    await bring(1); await drag(page, 1, 1.51, 0.55); await drag(page, 1, 1.45, -0.65)   # up and a little in: it slides up the side of the first
    await bring(4)   # along the floor: in, it fits, and that is the box packed
    await tick(page, 1500)
    p = await shapes(page)
    assert await won(page), 'packed through the door, the dock is not won: %s' % [(round(q['x'], 3), round(q['y'], 3), q['angle']) for q in p]
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
    """The board lies under fog, and each shape clears it only round itself, where it is now. Packed, it lifts."""
    page = await level(t, 'Blind Box')
    fogged = 'getComputedStyle(document.querySelector(".fog .cloud")).opacity'
    assert float(await page.evaluate(fogged)) > 0.5, 'there is no fog over the box'
    sight = '(function () { var c = document.querySelectorAll(".fog .sees circle")[5]; return [+c.getAttribute("cx"), +c.getAttribute("cy")]; })()'
    sol = await solution(page)
    await put(page, 5, sol[5])
    at = await page.evaluate(sight)
    assert abs(at[0] - sol[5][0]) < 0.01 and abs(at[1] - sol[5][1]) < 0.01, 'the brick does not see from where it is'
    assert await page.evaluate('document.querySelectorAll(".fog .sees circle").length') == 6, 'something other than the shapes clears the fog'
    for i in range(5): await put(page, i, sol[i])
    await tick(page, 2500)
    assert await won(page) and float(await page.evaluate(fogged)) < 0.05, 'packed, the fog does not lift'
    assert not page.errors, page.errors
