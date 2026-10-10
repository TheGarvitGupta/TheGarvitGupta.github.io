# Each power does what it says. (Begun: so far only what a level asks for in the deal.)
import json
from harness import player, tick

async def test_short_fuse_deals_a_mine_to_each_brick(t):
    """A level may pin a power to several shapes when it deals it more than once. Whatever the deal, both bricks are mines and no triangle is."""
    for seed in (1, 2, 3, 4):
        page = await player(await t.page(level='Short Fuse', seed=seed))
        P = await page.evaluate('T.pieces()')
        got = [(p['type'], p['power']) for p in P]
        assert got == [('triangle', None)] * 4 + [('domino', 'mine')] * 2, 'dealt %s' % got
        assert not page.errors, page.errors
        await page.context.close()

async def test_short_fuse_packs_with_both_mines_in(t):
    page = await player(await t.page(level='Short Fuse'))
    await page.evaluate('''(function () { var l = Packman.level(); Packman.pieces().forEach(function (p, i) { var s = l.solution[i]; p.x = s[0]; p.y = s[1]; p.angle = s[2]; Packman.render(i); }); Packman.commit(); })()''')
    await tick(page, 3000)
    st = await page.evaluate('T.state()')
    assert st['solved'] and st['sheet'] == 'm-win' and 'Short Fuse' in st['save']['done'], 'packed as the solution says, and: %s' % {k: st[k] for k in ('solved', 'sheet', 'packed')}
    assert not page.errors, page.errors
