# The sixth chapter, Game Night: duels with Packman on the squares of a box, played in the real page.
import re, json
import datetime
from harness import player, tick, put

DUELS = ['Opening Hand', 'Square Off', 'Rock Bottom', 'House Rules', 'Double Cross', 'The Long Game', 'Endgame']   # the chapter's levels, in order

async def level(t, name, **how):
    page = await player(await t.page(level=name, **how))
    assert not page.errors, page.errors
    return page

async def said(page): return await page.evaluate('document.getElementById("count").textContent')
async def sheet(page): return (await page.evaluate('T.state()'))['sheet']

async def test_every_duel_is_won_by_its_winning_line(t):
    """The Solver plays the hint's spot, move after move, while Packman answers as best it can: every duel can be won."""
    for n, name in enumerate(DUELS, 1):
        page = await level(t, name)
        await tick(page, 1500)   # (Packman opens the fourth)
        await page.click('.dev button:has-text("Solver")'); await tick(page, 25000)
        assert await sheet(page) == 'm-win', '%s was not won by its winning line: %s' % (name, await said(page))
        assert not page.errors, page.errors

async def test_a_bad_opening_loses_and_start_over_starts_again(t):
    page = await level(t, DUELS[1])
    await put(page, 0, [-1, -1, 0]); await tick(page, 3000)   # the square in a corner, not the middle
    await put(page, 1, [0.5, 1, 0]); await tick(page, 4000)
    assert await sheet(page) == 'm-lose', 'no sheet for the loss: %s' % await said(page)
    assert 'Packman wins' in await said(page)
    await page.click('#lose-again'); await tick(page, 1500)
    assert await sheet(page) is None and await said(page) == 'Your turn'
    assert await page.evaluate('Packman.pieces().every(function (p) { return !p.nailed; })'), 'the box is not empty again'
    assert not page.errors, page.errors

async def test_a_shape_carried_over_the_box_is_only_ever_on_squares_it_fits(t):
    page = await level(t, DUELS[6])
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
    page = await level(t, DUELS[0], live=True)
    await page.clock.set_system_time(datetime.datetime(2026, 10, 22, 12)); await page.reload(); await tick(page, 3000); page = await player(page)   # the day before the first
    assert await page.evaluate('!document.getElementById("soon").hidden'), 'no banner'
    assert 'Opens' in await page.inner_text('#soon')
    assert re.search(r'in \d+ hours\b', await page.inner_text('#soon-left')), await page.inner_text('#soon-left')   # (half a day off)
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

async def test_a_level_weeks_off_counts_down_in_days(t):
    page = await level(t, DUELS[2], live=True)
    await page.evaluate('''(function (n) { var s = JSON.parse(localStorage.getItem('packman.v1')); s.done = s.done || {};   // (the two before it packed, so it can be reached)
      n.slice(0, 2).forEach(function (k) { s.done[k] = { t: 60, m: 9 }; }); s.last = n[2]; localStorage.setItem('packman.v1', JSON.stringify(s)); })(%s)''' % json.dumps(DUELS))
    await page.clock.set_system_time(datetime.datetime(2026, 10, 22, 12)); await page.reload(); await tick(page, 3000); page = await player(page)
    left = await page.inner_text('#soon-left')
    assert re.fullmatch(r'in 1[67] days', left.strip()), (left, (await page.evaluate('T.state()'))['level'])   # (8 November, not 400-odd hours)
    assert not page.errors, page.errors

async def test_on_this_machine_every_level_is_open(t):
    page = await level(t, DUELS[6])
    assert await page.evaluate('document.getElementById("soon").hidden')
    assert not page.errors, page.errors

async def test_the_seventeenth_level_has_five_spots_more_of_its_own(t):
    page = await level(t, 'Seventeen')
    await page.click('#b-hint'); await tick(page, 400)
    assert int(await page.inner_text('#spots')) == 8
    for k in range(5):
        await page.click('#hint-spot'); await tick(page, 800)
        assert await sheet(page) != 'm-hint', 'no spot shown: %s' % await page.inner_text('#m-hint')
        await page.click('#b-hint'); await tick(page, 400)
    assert int(await page.inner_text('#spots')) == 3, 'its own five were not spent first'
    await page.keyboard.press('Escape'); await tick(page, 600)
    await page.evaluate('Packman.play("Home")'); await tick(page, 600)
    await page.click('#b-hint'); await tick(page, 400)
    assert int(await page.inner_text('#spots')) == 3, 'the five were for the chapter'
    assert not page.errors, page.errors

async def test_a_locked_level_cannot_be_opened_from_the_list(t):
    page = await level(t, 'Four Square', live=True)
    await page.click('#chip'); await tick(page, 700)
    shut = await page.evaluate('document.querySelectorAll("#grid .lv.locked").length')
    assert shut > 0
    for k in range(3):   # (however many times, and even if the browser lets the tap through)
        await page.evaluate('var b = document.querySelector("#grid .lv.locked"); b.disabled = false; b.click(); b.disabled = true')
        await tick(page, 300)
    assert (await page.evaluate('T.state()'))['level'] == 'Four Square'
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

async def test_the_levels_list_keeps_its_shape_around_the_days_they_open(t):
    """In the list a level not out yet has the day it opens under it. Every tile stays a square inside the sheet, and
    Close stays under the last of them, before the first is out and after (Safari once widened them past the edge)."""
    for when in ((2026, 10, 22, 19), (2026, 10, 23, 19)):
        for w, h in ((393, 852), (1280, 800)):
            page = await level(t, 'Home', live=True, width=w, height=h)
            await page.clock.set_system_time(datetime.datetime(*when)); await page.reload(); await tick(page, 3000); page = await player(page)
            await page.click('#chip'); await tick(page, 1500)
            await page.click('.jump button:last-child'); await tick(page, 1500)
            r = await page.evaluate('''(function () { var g = document.getElementById('grid').getBoundingClientRect(), all = [].slice.call(document.querySelectorAll('#grid .lv')),
              close = document.querySelector('#m-levels [data-close]').getBoundingClientRect(), b = all.map(function (e) { return e.getBoundingClientRect(); });
              return { over: b.filter(function (x) { return x.right > g.right + 1; }).length, below: close.top >= b[b.length - 1].bottom, squares: b.every(function (x) { return Math.abs(x.width - x.height) < 2; }),
                       dates: [].map.call(document.querySelectorAll('#grid .lv.soon .when'), function (e) { return e.textContent; }) }; })()''')
            what = '%s at %dpx' % ('before' if when[2] == 22 else 'after', w)
            assert not r['over'] and r['below'] and r['squares'], '%s: %s' % (what, r)
            assert len(r['dates']) == (7 if when[2] == 22 else 6) and r['dates'][-1] == '6 Dec', '%s: %s' % (what, r['dates'])
            await page.context.close()   # (one page at a time: four of the site at once, each with its clock moved, is more than it serves in time)
