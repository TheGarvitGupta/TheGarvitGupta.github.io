# The sixth chapter, Rivals: duels with Packman on the squares of a box, played in the real page.
import datetime
from harness import player, tick, put

async def level(t, name, **how):
    page = await player(await t.page(level=name, **how))
    assert not page.errors, page.errors
    return page

async def said(page): return await page.evaluate('document.getElementById("count").textContent')
async def sheet(page): return (await page.evaluate('T.state()'))['sheet']

async def test_every_duel_is_won_by_its_winning_line(t):
    """The Solver plays the hint's spot, move after move, while Packman answers as best it can: every duel can be won."""
    for n in range(1, 8):
        page = await level(t, 'Rival %d' % n)
        await tick(page, 1500)   # (Packman opens Rival 4)
        await page.click('.dev button:has-text("Solver")'); await tick(page, 25000)
        assert await sheet(page) == 'm-win', 'Rival %d was not won by its winning line: %s' % (n, await said(page))
        assert not page.errors, page.errors

async def test_a_bad_opening_loses_and_start_over_starts_again(t):
    page = await level(t, 'Rival 2')
    await put(page, 0, [-1, -1, 0]); await tick(page, 3000)   # the square in a corner, not the middle
    await put(page, 1, [0.5, 1, 0]); await tick(page, 4000)
    assert await sheet(page) == 'm-lose', 'no sheet for the loss: %s' % await said(page)
    assert 'Packman wins' in await said(page)
    await page.click('#lose-again'); await tick(page, 1500)
    assert await sheet(page) is None and await said(page) == 'Your turn'
    assert await page.evaluate('Packman.pieces().every(function (p) { return !p.nailed; })'), 'the box is not empty again'
    assert not page.errors, page.errors

async def test_a_shape_carried_over_the_box_is_only_ever_on_squares_it_fits(t):
    page = await level(t, 'Rival 7')
    await put(page, 0, [0, 0.5, 0]); await tick(page, 3000)
    g = await page.evaluate('T.grip(1)'); to = await page.evaluate('T.screen(0.3, 0.45)')   # over the brick already there
    await page.mouse.move(*g['at']); await page.mouse.down(); await tick(page, 40)
    for k in range(1, 9):
        await page.mouse.move(g['at'][0] + (to[0] - g['at'][0]) * k / 8, g['at'][1] + (to[1] - g['at'][1]) * k / 8); await tick(page, 32)
    p = await page.evaluate('(function (p) { return [p.x, p.y]; })(Packman.pieces()[1])')
    assert abs(p[0] % 1) < 1e-9 and abs(p[1] % 1 - 0.5) < 1e-9, 'held between squares, at %s' % p
    assert not await page.evaluate('''(function () { var a = Packman.pieces()[0], b = Packman.pieces()[1]; return Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 1; })()'''), 'held over the brick in the box'
    await page.mouse.up(); await tick(page, 200)
    assert not page.errors, page.errors

async def test_a_level_before_its_day_is_shown_and_cannot_be_played(t):
    """Online, a Rival level can be opened before its Sunday, but only looked at: a banner says when it opens, nothing
    can be picked up, and no spot is shown."""
    page = await level(t, 'Rival 1', live=True)
    await page.clock.set_system_time(datetime.datetime(2026, 10, 22, 12)); await page.reload(); await tick(page, 3000); page = await player(page)   # the day before the first
    assert await page.evaluate('!document.getElementById("soon").hidden'), 'no banner'
    assert 'Opens' in await page.inner_text('#soon')
    before = await page.evaluate('T.pieces()[0]')
    g = await page.evaluate('T.grip(0)')
    await page.mouse.move(*g['at']); await page.mouse.down(); await tick(page, 40)
    await page.mouse.move(g['at'][0], g['at'][1] - 150, steps=6); await tick(page, 100); await page.mouse.up(); await tick(page, 200)
    after = await page.evaluate('T.pieces()[0]')
    assert (before['x'], before['y']) == (after['x'], after['y']), 'a shape was moved before the level opened'
    await page.click('#b-hint'); await tick(page, 400)
    assert await page.evaluate('document.getElementById("hint-spot").disabled'), 'a spot is on offer'
    assert 'opens' in await page.inner_text('#hint-wait')
    assert not page.errors, page.errors

async def test_on_this_machine_every_level_is_open(t):
    page = await level(t, 'Rival 7')
    assert await page.evaluate('document.getElementById("soon").hidden')
    assert not page.errors, page.errors

async def test_three_spots_a_day(t):
    page = await level(t, 'Home')
    for k in range(3):
        await page.click('#b-hint'); await tick(page, 400)
        assert int(await page.inner_text('#spots')) == 3 - k
        await page.click('#hint-spot'); await tick(page, 800)
    await page.click('#b-hint'); await tick(page, 400)
    assert await page.evaluate('document.getElementById("hint-spot").disabled'), 'a fourth spot is on offer'
    assert 'midnight' in await page.inner_text('#hint-wait')
    assert not page.errors, page.errors
