# The twists of the fourth chapter. (Begun: how Duality is dealt.)
from harness import player, tick

DEALT = '''(function () { var lv = Packman.level(), G = PackmanGeom, P = Packman.pieces(), V = P.map(G.verts), W = innerWidth, H = innerHeight;
  var C = G.makeBoxes(lv.containers);
  return { divide: lv.divide, shapes: P.map(function (p, i) {
    var S = V[i].map(function (v) { return T.screen(v[0], v[1]); }), on = S.every(function (q) { return q[0] >= -1 && q[1] >= -1 && q[0] <= W + 1 && q[1] <= H + 1; });
    var over = P.some(function (q, j) { var o = j !== i && G.overlap(V[i], V[j]); return o && o.depth > 0.02; });
    return { i: i, half: p.half || 0, x: p.x, y: p.y, on: on, over: over, box: G.zone(V[i], C) }; }) }; })()'''

async def test_duality_deals_the_free_shapes_on_the_line(t):
    """Two of Duality's squares are entangled with nothing and may go in either box: they are dealt on the line between the
    two sides, where neither box has a claim on them. The entangled ones are dealt on their own sides, as before."""
    for size in ({'width': 393, 'height': 852}, {'width': 360, 'height': 640}, {'width': 1280, 'height': 800}, {'width': 844, 'height': 390}):
        for seed in (1, 2, 3):
            page = await player(await t.page(level='Duality', seed=seed, **size))
            d = await page.evaluate(DEALT)
            free = [s for s in d['shapes'] if not s['half']]; tied = [s for s in d['shapes'] if s['half']]
            where = '%dx%d, deal %d' % (size['width'], size['height'], seed)
            assert len(free) == 2 and len(tied) == 6, where
            assert all(abs(s['x'] - d['divide']) < 0.05 for s in free), '%s: the free shapes are dealt at x = %s, and the line is at %s' % (where, [round(s['x'], 2) for s in free], d['divide'])
            assert all((s['x'] - d['divide']) * s['half'] > 0.5 for s in tied), '%s: an entangled shape is dealt on the line or across it' % where
            assert all(s['on'] and s['box'] == 'out' for s in d['shapes']), '%s: a shape is dealt off the screen or into a box: %s' % (where, [s['i'] for s in d['shapes'] if not s['on'] or s['box'] != 'out'])
            assert not any(s['over'] for s in free), '%s: a shape on the line is dealt on top of another' % where
            assert not page.errors, page.errors
            await page.context.close()
