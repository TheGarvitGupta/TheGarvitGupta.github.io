# The game plays: the real page in a real browser, worked with a mouse as a player works it.
import json
from harness import player, drag, tap, tick, turn, put, saved

NAMES = 'PackmanLevels.map(function (l) { return { name: l.name, n: l.pieces.length, powers: l.powers || 0 }; })'

async def game(t, level='Four Square', **how):
    page = await player(await t.page(level=level, **how))
    assert not page.errors, page.errors
    return page

async def state(page): return await page.evaluate('T.state()')
async def pieces(page): return await page.evaluate('T.pieces()')

async def every_level_opens(t, width, height):
    page = await t.bare('geom.js', 'levels.js')
    levels = await page.evaluate(NAMES)
    bad = []
    page = await player(await t.page(width=width, height=height))
    for l in levels:
        del page.errors[:]
        await page.evaluate('Packman.play(%s)' % json.dumps(l['name'])); await tick(page, 2500)   # (one page for them all: opening each afresh takes minutes)
        r = await page.evaluate('''(function () {
          var lv = Packman.level(), C = lv.containers ? PackmanGeom.makeBoxes(lv.containers) : PackmanGeom.makeContainer(lv.container), out = [];
          var P = Packman.pieces(), W = innerWidth, Hh = innerHeight, one = Math.abs(T.screen(1, 0)[0] - T.screen(0, 0)[0]);   // one: the side of a square, on the screen
          P.forEach(function (p, i) {
            // (by its corners, not by what the page says it takes up: a shape has parts that are not seen, wider than it is)
            var S = PackmanGeom.verts(p).map(function (v) { return T.screen(v[0], v[1]); }), xs = S.map(function (q) { return q[0]; }), ys = S.map(function (q) { return q[1]; });
            var r = { left: Math.min.apply(null, xs), right: Math.max.apply(null, xs), top: Math.min.apply(null, ys), bottom: Math.max.apply(null, ys) };
            if (!p.el.isConnected || r.right - r.left < 8) out.push('shape ' + i + ' is not drawn');
// A shape's middle is kept four tenths of a square inside the screen, so a long one may hang over the edge a little
            // and can still be got hold of. More than a third of a square over, or its middle off, and something is wrong.
            var c = T.screen(p.x, p.y), slack = one / 3 + 1;
            if (c[0] < 0 || c[1] < 0 || c[0] > W || c[1] > Hh) out.push('shape ' + i + ' is dealt with its middle off the screen');
            else if (r.left < -slack || r.top < -slack || r.right > W + slack || r.bottom > Hh + slack) out.push('shape ' + i + ' hangs off the screen: ' + [r.left, r.top, r.right, r.bottom].map(Math.round));
            if (PackmanGeom.zone(PackmanGeom.verts(p), C) !== 'out') out.push('shape ' + i + ' is dealt into the box');
            if (p.half && (p.x - lv.divide) * p.half < 0) out.push('entangled shape ' + i + ' is dealt on the wrong side of the line');
          });
          var bin = document.getElementById('bin').getBoundingClientRect();
          if (bin.left < 0 || bin.right > W || bin.top < 0 || bin.bottom > Hh) out.push('the box runs off the screen');
          return { name: lv.name, n: P.length, shown: document.getElementById('lv-name').textContent, intro: document.getElementById('lv-intro').textContent,
                   powers: P.filter(function (p) { return p.power; }).length, ghosts: P.filter(function (p) { return p.power === 'ghost'; }).length, out: out }; })()''')
        said = list(r['out']) + page.errors
        if r['name'] != l['name'] or r['shown'] != l['name']: said.append('opened as %r, shown as %r' % (r['name'], r['shown']))
        if r['n'] - r['ghosts'] != l['n']: said.append('%d shapes dealt of %d' % (r['n'] - r['ghosts'], l['n']))   # (the ghost is one more: it takes up no room)
        if r['powers'] != l['powers']: said.append('%d powers dealt of %d' % (r['powers'], l['powers']))
        if not r['intro'].strip(): said.append('no line under its name')
        if said: bad.append('%s: %s' % (l['name'], '; '.join(said)))
    assert not bad, '\n'.join(bad)

async def test_every_level_opens_on_a_phone(t): await every_level_opens(t, 393, 852)
async def test_every_level_opens_on_a_small_phone(t): await every_level_opens(t, 360, 640)
async def test_every_level_opens_on_a_desktop(t): await every_level_opens(t, 1280, 800)

async def test_a_shape_goes_where_it_is_carried(t):
    page = await game(t)
    before = await pieces(page)
    x, y = before[0]['x'] - 0.3, before[0]['y'] + 0.25   # a little way, still out in the open
    await drag(page, 0, x, y)
    after = await pieces(page)
    assert abs(after[0]['x'] - x) < 0.03 and abs(after[0]['y'] - y) < 0.03, 'carried to (%.2f, %.2f) and it is at (%.2f, %.2f)' % (x, y, after[0]['x'], after[0]['y'])
    assert all(a['x'] == b['x'] and a['y'] == b['y'] for a, b in zip(after[1:], before[1:])), 'another shape moved with it'
    assert (await state(page))['clock'] != '', 'the clock'
    assert not page.errors, page.errors

async def test_a_level_packed_by_hand_is_won_and_saved(t):
    page = await game(t)
    for i, s in enumerate(await page.evaluate('Packman.level().solution')):
        st = await state(page); assert st['packed'] == i and st['sheet'] is None, st
        await drag(page, i, s[0], s[1])
    await tick(page, 3000)
    st = await state(page)
    assert st['solved'] and st['sheet'] == 'm-win', 'packed, and the win is not shown: %s' % st['sheet']
    done = st['save']['done'].get('Four Square')
    assert done and done['m'] == 4 and 0 < done['t'] < 60, 'saved as %s' % done
    assert all('good' in p['cls'] for p in await pieces(page)), 'the shapes are not all smiling'
    assert not page.errors, page.errors

async def test_progress_is_still_there_when_the_page_is_opened_again(t):
    page = await game(t)
    for i, s in enumerate(await page.evaluate('Packman.level().solution')): await drag(page, i, s[0], s[1])
    await tick(page, 3000)
    await page.click('#win-next'); await tick(page, 1500)
    assert (await state(page))['level'] == 'Flip', 'Next level did not go on to the second'
    await page.reload(); await tick(page, 3000); await player(page)
    st = await state(page)
    assert st['level'] == 'Flip', 'opened again at %s' % st['level']
    assert 'Four Square' in st['save']['done'], 'the win is forgotten'
    assert st['sheet'] is None and st['packed'] == 0

async def test_the_marks_light_for_the_shape_that_went_in(t):
    """The row at the top right has a mark for every shape. A triangle put in lights a triangle, not the next mark
    along (as it once did, when the first mark was a square)."""
    page = await game(t, 'Home')
    P = await pieces(page); sol = await page.evaluate('Packman.level().solution')
    tri = [p['i'] for p in P if p['type'] == 'triangle'][0]
    await put(page, tri, sol[tri])
    lit = await page.evaluate('[].map.call(document.getElementById("pips").children, function (e) { return [e.kind, e.classList.contains("on")]; })')
    assert [k for k, on in lit if on] == ['triangle'], 'a triangle went in and the marks lit are %s (the row is %s)' % ([k for k, on in lit if on], [k for k, _ in lit])
    sq = [p['i'] for p in P if p['type'] == 'square'][0]
    await put(page, sq, sol[sq])
    lit = await page.evaluate('[].map.call(document.getElementById("pips").children, function (e) { return [e.kind, e.classList.contains("on")]; })')
    assert sorted(k for k, on in lit if on) == ['square', 'triangle'], lit

async def test_a_shape_in_hand_is_turned_by_the_buttons(t):
    page = await game(t)
    await tap(page, 1)
    assert 'sel' in (await pieces(page))[1]['cls'], 'a shape picked up and put down is not the one in hand'
    for by, want in ((15, 15), (1, 16), (-15, 1), (-1, 0), (-1, 359)):
        await page.click('.rb[data-r="%d"]' % by); await tick(page, 400)
        got = (await pieces(page))[1]['angle'] % 360
        assert got == want, 'turned by %d and it stands at %s, not %s' % (by, got, want)
    assert all(p['angle'] == 0 for p in (await pieces(page)) if p['i'] != 1), 'another shape turned with it'

async def test_a_shape_that_overlaps_does_not_count(t):
    page = await game(t)
    sol = await page.evaluate('Packman.level().solution')
    await drag(page, 0, sol[0][0], sol[0][1])
    await drag(page, 1, sol[0][0] + 0.45, sol[0][1] + 0.45)   # half over the first
    P = await pieces(page); st = await state(page)
    assert st['packed'] < 2 and not st['solved'], st
    assert 'bad' in P[1]['cls'] or 'bad' in P[0]['cls'] or st['packed'] == 1, 'two shapes lie one on the other and neither is marked: %s' % [p['cls'] for p in P[:2]]

async def test_start_over_puts_everything_back(t):
    page = await game(t)
    sol = await page.evaluate('Packman.level().solution')
    await drag(page, 0, sol[0][0], sol[0][1]); await drag(page, 1, sol[1][0], sol[1][1])
    assert (await state(page))['packed'] == 2
    await page.click('#b-reset'); await tick(page, 200)
    if (await state(page))['packed'] == 2: await page.click('#b-reset')   # it asks to be pressed again
    await tick(page, 1500)
    st = await state(page)
    assert st['packed'] == 0 and st['clock'] == '0:00', 'after starting over: %s packed, the clock at %s' % (st['packed'], st['clock'])

async def test_eyesight_goes_on_and_off(t):
    page = await game(t)
    assert not (await state(page))['eyes']
    await page.click('#b-eye'); await tick(page, 400)
    assert (await state(page))['eyes'] and await page.get_attribute('#b-eye', 'aria-pressed') == 'true'
    await page.click('#b-eye'); await tick(page, 400)
    assert not (await state(page))['eyes'] and await page.get_attribute('#b-eye', 'aria-pressed') == 'false'
    assert not page.errors, page.errors

async def test_a_hint_shows_a_spot_and_is_counted(t):
    page = await game(t, 'Home')
    await page.click('#b-hint'); await tick(page, 400)
    assert (await state(page))['sheet'] == 'm-hint' and (await page.inner_text('#hint-text')).strip(), 'the hint sheet, with the level\'s hint in it'
    left = int(await page.inner_text('#spots'))
    await page.click('#hint-spot'); await tick(page, 800)
    assert await page.evaluate('!document.getElementById("ghost").hidden'), 'no spot is shown on the board'
    assert (await state(page))['sheet'] is None, 'the sheet stays up over the spot'
    await page.click('#b-hint'); await tick(page, 400)
    assert int(await page.inner_text('#spots')) == left - 1, 'a spot was shown and %s are left of %s' % (await page.inner_text('#spots'), left)

async def test_the_spot_a_hint_shows_is_one_from_the_solution(t):
    page = await game(t, 'Home')
    await page.click('#b-hint'); await tick(page, 400); await page.click('#hint-spot'); await tick(page, 800)
    r = await page.evaluate('''(function () { var r = document.getElementById("ghost").getBoundingClientRect(), one = Math.abs(T.screen(1, 0)[0] - T.screen(0, 0)[0]);
      return { at: [r.left + r.width / 2, r.top + r.height / 2], one: one, places: Packman.level().solution.map(function (s) { return T.screen(s[0], s[1]); }) }; })()''')
    near = min(abs(r['at'][0] - q[0]) + abs(r['at'][1] - q[1]) for q in r['places']) / r['one']
    assert near < 0.3, 'the spot shown is %.2f of a square from the nearest place of the solution' % near

async def test_every_sheet_opens_and_shuts(t):
    page = await game(t)
    for button, sheet in (('#b-help', 'm-help'), ('#chip', 'm-levels'), ('#b-hint', 'm-hint'), ('#b-board', None)):
        await page.click(button); await tick(page, 500)
        up = (await state(page))['sheet']
        assert up == sheet or (sheet is None and up in ('m-board', 'm-name')), '%s opened %s' % (button, up)
        await page.keyboard.press('Escape'); await tick(page, 500)
        if (await state(page))['sheet']: await page.click('.sheet.open [data-close]'); await tick(page, 500)
        assert (await state(page))['sheet'] is None, '%s would not shut' % up
    assert not page.errors, page.errors

async def test_a_level_is_chosen_from_the_list(t):
    page = await game(t)
    await page.click('#chip'); await tick(page, 500)
    n = await page.evaluate('document.querySelectorAll("#m-levels button[data-n], #m-levels .lv").length')
    target = await page.evaluate('''(function () { var all = [].slice.call(document.querySelectorAll('#m-levels button')); var b = all.filter(function (b) { return /^\\s*4\\s*$/.test(b.textContent); })[0]; if (b) b.click(); return !!b; })()''')
    assert target, 'no button for the fourth level in the list (%d found)' % n
    await tick(page, 1500)
    assert (await state(page))['level'] == 'Home', 'the fourth button opened %s' % (await state(page))['level']

async def test_a_new_player_is_welcomed(t):
    page = await player(await t.page(save={}))
    st = await state(page)
    assert st['sheet'] in ('m-help', 'm-name'), 'a first visit opens %s' % st['sheet']
    assert st['level'] == 'Four Square'
    assert not page.errors, page.errors
