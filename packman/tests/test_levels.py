# The levels are sound: levels.js looked at by itself, with the game's own geometry to judge the solutions.
from harness import read

CHAPTERS = [17, 15, 9, 9]   # the seventeen, the powers, the bricks and hexagons, the twists
TURNS = {'square': 90, 'triangle': 120, 'domino': 180, 'hexagon': 60}

# Everything the tests ask of a level, worked out in the page and handed back as plain numbers and words.
LOOK = '''(function () {
  var G = PackmanGeom;
  return PackmanLevels.map(function (l) {
    var C = l.containers ? G.makeBoxes(l.containers) : G.makeContainer(l.container);
    var sol = l.solution || [];
    var P = l.pieces.map(function (t, i) { var s = sol[i] || [99, 99, 0]; return { type: t, size: 1, x: s[0], y: s[1], angle: s[2] }; });
    var ev = G.evaluate(P, C), deep = 0, V = P.map(G.verts);
    P.forEach(function (p, i) {
      G.part(C, p.x, p.y).walls.forEach(function (w) { deep = Math.max(deep, G.excess(V[i], w)); });
      for (var j = i + 1; j < P.length; j++) { var o = G.overlap(V[i], V[j]); if (o) deep = Math.max(deep, o.depth); }
    });
    var boxes = (l.containers || [l.container]).map(function (poly) {
      var turn = 0, n = poly.length;   // convex: every corner turns the same way
      for (var i = 0; i < n; i++) { var a = poly[i], b = poly[(i + 1) % n], c = poly[(i + 2) % n], z = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]); if (z > 1e-9) turn |= 1; if (z < -1e-9) turn |= 2; }
      return { corners: n, convex: turn !== 3 };
    });
    return { name: l.name, intro: l.intro, hint: l.hint, pieces: l.pieces, places: sol.length, solved: ev.solved, good: ev.states.map(function (s) { return s.good; }), deep: deep,
      boxes: boxes, twist: !!l.twist, powers: l.powers || 0, bonus: !!l.bonus, sure: l.sure || [], pool: l.pool || null, pin: l.pin || {}, chameleon: l.chameleon, masked: l.masked,
      twins: l.twins || [], gears: l.gears || [], divide: l.divide == null ? null : l.divide, ghost: l.ghost || null, haunt: l.haunt || null,
      xs: V.map(function (v) { return [Math.min.apply(null, v.map(function (q) { return q[0]; })), Math.max.apply(null, v.map(function (q) { return q[0]; }))]; }),
      angles: sol.map(function (s) { return s[2]; }), eps: G.EPS };
  });
})()'''

async def levels(t):
    page = await t.bare('geom.js', 'levels.js', 'faces.js')
    L = await page.evaluate(LOOK)
    powers = await page.evaluate('PackmanPowers.map(function (p) { return p.power; })')
    assert not page.errors, page.errors
    return L, powers

def chap(l): return 3 if l['twist'] else 1 if l['powers'] else 2 if l['bonus'] else 0

def each(L, wrong):
    """Every level put to a question; the ones that fail it, named."""
    bad = ['%s: %s' % (l['name'], w) for l in L for w in [wrong(l)] if w]
    assert not bad, '\n'.join(bad)

async def test_there_are_fifty_in_four_chapters(t):
    L, _ = await levels(t)
    sizes = [sum(1 for l in L if chap(l) == k) for k in range(4)]
    assert sizes == CHAPTERS, 'chapters hold %s levels, and should hold %s' % (sizes, CHAPTERS)

async def test_names_are_all_different(t):
    L, _ = await levels(t)
    names = [l['name'] for l in L]
    twice = sorted(set(n for n in names if names.count(n) > 1))
    assert not twice, 'progress is saved by name, and these are used twice: %s' % twice
    each(L, lambda l: 'no name' if not l['name'] or l['name'] != l['name'].strip() else '')

async def test_every_level_says_what_to_do_and_has_a_hint(t):
    L, _ = await levels(t)
    each(L, lambda l: ', '.join(w for w in ('intro', 'hint') if not (l[w] or '').strip()) and 'has no ' + ', '.join(w for w in ('intro', 'hint') if not (l[w] or '').strip()))

async def test_every_box_is_convex(t):
    """The judge takes a box as walls with the inside all on one side of each, which is only so of a convex one."""
    L, _ = await levels(t)
    each(L, lambda l: '' if all(b['convex'] and b['corners'] >= 3 for b in l['boxes']) else 'a box that is not convex: %s' % l['boxes'])

async def test_every_solution_packs(t):
    L, _ = await levels(t)
    def wrong(l):
        if l['places'] != len(l['pieces']): return '%d shapes and %d places in the solution' % (len(l['pieces']), l['places'])
        if not l['solved']: return 'the solution does not pack: shapes %s are not in' % [i for i, g in enumerate(l['good']) if not g]
    each(L, wrong)

async def test_no_solution_is_at_the_edge_of_the_tolerance(t):
    """Shapes may sink a hair into each other or a wall and still count (EPS, in geom.js). A solution is written to
    four places of decimals and whole degrees, so a tight one does sink a little; one that uses nearly all of the
    hair would stop packing at the least change to the box or the judge. (The deepest now: Eleven Bricks, at 86%.)"""
    L, _ = await levels(t)
    each(L, lambda l: 'its shapes are %.5f into each other or a wall, of the %.3f allowed' % (l['deep'], l['eps']) if l['deep'] > 0.9 * l['eps'] else '')

async def test_powers_named_by_a_level_exist(t):
    L, powers = await levels(t)
    def wrong(l):
        named = l['sure'] + (l['pool'] or []) + list(l['pin'].keys()) + ([l['ghost']] if isinstance(l['ghost'], str) and l['ghost'] in powers else [])
        odd = [p for p in named if p not in powers]
        if odd: return 'names powers there are none of: %s' % odd
        if l['powers'] > len(l['pieces']): return 'deals %d powers to %d shapes' % (l['powers'], len(l['pieces']))
        if len(l['sure']) > l['powers']: return 'is sure of %d powers and deals %d' % (len(l['sure']), l['powers'])
        if l['pool'] is not None and any(p not in l['pool'] for p in l['sure']): return 'is sure of a power that is not in its pool'
        twice = sorted(set(p for p in l['sure'] if l['sure'].count(p) > 1))
        if any(len(l['pin'].get(p) if isinstance(l['pin'].get(p), list) else []) != l['sure'].count(p) for p in twice): return 'deals %s more than once without saying which shapes get it' % twice
        if l['powers'] == 0 and (l['sure'] or l['pin'] or l['chameleon'] is not None): return 'names powers and deals none'
    each(L, wrong)

async def test_shapes_named_by_a_level_exist(t):
    L, _ = await levels(t)
    def wrong(l):
        n = len(l['pieces']); out = []
        pins = {power: (i if isinstance(i, list) else [i]) for power, i in l['pin'].items()}   # one shape, or several for a power dealt more than once
        for power, where in pins.items():
            if any(not (isinstance(i, int) and 0 <= i < n) for i in where): out.append('%s is pinned to shape %s of %d' % (power, where, n))
            if l['sure'].count(power) != len(where): out.append('%s is pinned to %d shapes and is sure to be dealt %d times' % (power, len(where), l['sure'].count(power)))
        if l['chameleon'] is not None:
            if not 0 <= l['chameleon'] < n: out.append('the chameleon is shape %s of %d' % (l['chameleon'], n))
            if 'chameleon' not in l['sure']: out.append('says which shape is the chameleon and may not deal one')
            if not (l['masked'] or '').strip(): out.append('has a chameleon for certain and no hint for it (masked)')
        seen = []
        for kind in ('twins', 'gears'):
            for s in l[kind]:
                if len(s) < 2: out.append('an entangled set of one: %s' % s)
                if any(not (isinstance(i, int) and 0 <= i < n) for i in s): out.append('%s names a shape that is not there: %s' % (kind, s)); continue
                if len(set(l['pieces'][i] for i in s)) > 1: out.append('%s ties shapes of different kinds: %s' % (kind, [l['pieces'][i] for i in s]))
                seen += s
            if kind == 'gears' and any(len(s) != 2 for s in l[kind]): out.append('gears turn in pairs: %s' % l[kind])
        if len(seen) != len(set(seen)): out.append('a shape is in two entangled sets')
        tied = set(seen)
        for power, where in pins.items():
            if tied & set(where): out.append('%s is pinned to an entangled shape' % power)
        if l['powers'] and len(l['pieces']) - len(tied) < l['powers']: out.append('%d powers to deal and only %d shapes that are free to have one' % (l['powers'], len(l['pieces']) - len(tied)))
        return '; '.join(out)
    each(L, wrong)

async def test_entangled_shapes_can_be_packed_on_their_own_sides(t):
    """In a level with a line (Duality), an entangled shape keeps to the side its place is on. Its place must be
    wholly on one side, or it could never be put there; and a line with nothing entangled does nothing."""
    L, _ = await levels(t)
    def wrong(l):
        if l['divide'] is None: return ''
        tied = [i for s in l['twins'] + l['gears'] for i in s]
        if not tied: return 'has a line and no entangled shapes'
        across = [i for i in tied if l['xs'][i][0] < l['divide'] - 1e-9 and l['xs'][i][1] > l['divide'] + 1e-9]
        if across: return 'the places of shapes %s lie across the line at x = %s' % (across, l['divide'])
        if len(l['boxes']) < 2: return 'has a line and one box'
    each(L, wrong)
    assert any(l['divide'] is not None for l in L), 'no level has a line: has Duality gone?'

async def test_the_first_level_of_each_chapter_is_where_the_game_thinks(t):
    """The chapters are told apart by what a level has (twist, powers, bonus), and each must be all together in the
    list but for the fourth, which the game numbers on its own: a level put in the wrong place would be numbered into the wrong chapter."""
    L, _ = await levels(t)
    order = [chap(l) for l in L]
    for k in range(4):
        where = [i for i, c in enumerate(order) if c == k]
        assert where == list(range(where[0], where[0] + len(where))), 'chapter %d is not all together: its levels are at %s' % (k + 1, where)
