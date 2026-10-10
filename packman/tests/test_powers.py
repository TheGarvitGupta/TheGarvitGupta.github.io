# Each power does what it says. (Begun: so far only what a level asks for in the deal.)
import json
from harness import player, tick

async def test_what_to_do_with_a_power_is_said_three_times_and_not_again(t):
    """Over the first three boards with a power on them; after that the strip is empty until a shape with a power is picked up. A reset of the game starts the count again."""
    SEEN = 'getComputedStyle(document.getElementById("power-idle")).display !== "none" && !document.getElementById("power-idle").hidden'
    page = await player(await t.page(level='Minefield'))
    seen = [await page.evaluate(SEEN)]
    for _ in range(3):
        await page.click('#b-reset'); await tick(page, 600)
        seen.append(await page.evaluate(SEEN))
    assert seen == [True, True, True, False], 'shown %s' % seen
    assert await page.evaluate('JSON.parse(localStorage.getItem("packman.v1")).powerTip') == 3
    assert await page.evaluate('getComputedStyle(document.getElementById("power-row")).display') == 'flex', 'the strip itself is gone, and with it the room for what a power says'
    assert not page.errors, page.errors
    page = await player(await t.page(level='Minefield', save={'v': 3, 'done': {}, 'last': 'Minefield', 'name': 'Packer', 'pid': 'test-0000-0000-0000-0000', 'seen': True, 'eyeTip': 1}))
    assert await page.evaluate(SEEN), 'a game begun afresh does not say it'

async def test_minefield_deals_a_mine_to_every_shape(t):
    """A level may pin a power to several shapes when it deals it more than once. Whatever the deal, every shape of Minefield is a mine."""
    for seed in (1, 2, 3, 4):
        page = await player(await t.page(level='Minefield', seed=seed))
        P = await page.evaluate('T.pieces()')
        got = [(p['type'], p['power']) for p in P]
        assert got == [('triangle', 'mine')] * 4 + [('domino', 'mine')] * 2, 'dealt %s' % got
        assert not page.errors, page.errors
        await page.context.close()

async def test_minefield_packs_with_every_mine_in(t):
    page = await player(await t.page(level='Minefield'))
    await page.evaluate('''(function () { var l = Packman.level(); Packman.pieces().forEach(function (p, i) { var s = l.solution[i]; p.x = s[0]; p.y = s[1]; p.angle = s[2]; Packman.render(i); }); Packman.commit(); })()''')
    await tick(page, 3000)
    st = await page.evaluate('T.state()')
    assert st['solved'] and st['sheet'] == 'm-win' and 'Minefield' in st['save']['done'], 'packed as the solution says, and: %s' % {k: st[k] for k in ('solved', 'sheet', 'packed')}
    assert not page.errors, page.errors
