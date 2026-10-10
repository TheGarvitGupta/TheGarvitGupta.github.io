# What the tests share: the site served from this machine for as long as a test runs, and a page of the game
# opened in Chrome with everything that changes from one run to the next held still.
import asyncio, contextlib, functools, http.server, json, os, socketserver, threading

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))   # the root of the site
GAME = os.path.join(ROOT, 'packman')

class Skip(Exception):
    """Raised by a test that cannot be run as things are, with the reason: it is counted apart, neither passed nor failed."""

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True; daemon_threads = True
    def handle_error(self, request, client_address): pass   # a page shut while a file was on its way to it: no matter

@contextlib.contextmanager
def served():
    """The site at http://localhost:<port>/ (the game only opens every level, and keeps scores to itself, on localhost)."""
    with Server(('127.0.0.1', 0), functools.partial(Quiet, directory=ROOT)) as s:
        threading.Thread(target=s.serve_forever, daemon=True).start()
        try: yield 'http://localhost:%d' % s.server_address[1]
        finally: s.shutdown()

def saved(level='Home', **more):
    """A player's saved game: named, past the welcome, and about to open this level."""
    d = {'v': 3, 'done': {}, 'last': level, 'name': 'Packer', 'pid': 'test-0000-0000-0000-0000', 'seen': True, 'eyeTip': 1}
    d.update(more); return d

# Run before anything of the page's own: the same "random" numbers every time, so the same deal; the saved game;
# and a list of everything that goes wrong.
SEED = """
(function () {
  var a = %d;
  Math.random = function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  // (once: a page loaded again keeps what the game has saved since)
  if (%s && !sessionStorage.getItem('test.seeded')) try { localStorage.setItem(%s, JSON.stringify(%s)); sessionStorage.setItem('test.seeded', '1'); } catch (e) {}
})();
"""

async def opened(browser, base, path='/packman/', level='Home', save=None, store='packman.v1', width=393, height=852, scale=1,
                 dark=False, calm=True, seed=7, still=True):
    """A page of the site. Nothing leaves this machine but the request for the lettering: the counter of visits and
    the leaderboard are cut off. With still, the page's clock stands at a fixed moment and moves only when told to
    (page.clock.run_for); with calm, the page is told the player wants no animation, so no picture catches one midway."""
    ctx = await browser.new_context(viewport={'width': width, 'height': height}, device_scale_factor=scale,
                                    color_scheme='dark' if dark else 'light', reduced_motion='reduce' if calm else 'no-preference')
    seedSave = save if save is not None else saved(level)
    await ctx.add_init_script(SEED % (seed, 'true' if seedSave is not False else 'false', json.dumps(store), json.dumps(seedSave or {})))
    await ctx.route('**/*', lambda r: r.continue_() if r.request.url.startswith(base) or 'fonts.g' in r.request.url else r.abort())
    page = await ctx.new_page()
    page.errors = []
    page.on('pageerror', lambda e: page.errors.append('error: ' + str(e)))
    page.on('response', lambda r: page.errors.append('%d %s' % (r.status, r.url)) if r.status >= 400 else None)
    if still:
        await page.clock.install(time=1760000000000)
        await page.clock.pause_at(1760000001000)
    await page.goto(base + path)
    for _ in range(100):   # the lettering loaded (asked from here: the page's own timers are stopped)
        if await page.evaluate('document.fonts.status === "loaded"'): break
        await asyncio.sleep(0.05)
    if still: await page.clock.run_for(3000)   # the deal done and settled
    return page

async def chrome(p):
    return await p.chromium.launch(channel='chrome', headless=True)

async def bare(browser, scripts=('geom.js', 'levels.js')):
    """An empty page with only these of the game's scripts in it: for testing them by themselves."""
    ctx = await browser.new_context()
    page = await ctx.new_page()
    page.errors = []
    page.on('pageerror', lambda e: page.errors.append('error: ' + str(e)))
    await page.set_content('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>')
    for s in scripts: await page.add_script_tag(path=os.path.join(GAME, s))
    return page

def read(*path):
    """A file of the site, as text."""
    return open(os.path.join(ROOT, *path), encoding='utf-8').read()

# ---- playing the game with a mouse, as a player does ----

# Where things are, for a test to ask of the page. Board units are the game's own: a square has sides of one.
PLAYER = """
window.T = {
  // the game's shapes, as plain numbers
  pieces: function () { return Packman.pieces().map(function (p, i) { return { i: i, type: p.type, x: p.x, y: p.y, angle: p.angle, power: p.power || null,
    cls: p.el.getAttribute('class'), half: p.half || 0, kin: (p.kin || []).map(function (k) { return k.i; }) }; }); },
  // a point of the board, on the screen
  screen: function (x, y) { var m = document.getElementById('pieces').getScreenCTM(); return [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]; },
  // a point of a shape that can be got at: its middle, or failing that somewhere on it that nothing else lies over
  grip: function (i) {
    var p = Packman.pieces()[i], V = PackmanGeom.verts(p), tries = [[p.x, p.y]];
    V.forEach(function (v) { tries.push([p.x + (v[0] - p.x) * 0.6, p.y + (v[1] - p.y) * 0.6]); });
    for (var k = 0; k < tries.length; k++) {
      var s = T.screen(tries[k][0], tries[k][1]), e = document.elementFromPoint(s[0], s[1]);
      if (e && p.el.contains(e)) return { at: s, off: [tries[k][0] - p.x, tries[k][1] - p.y] };
    }
    return null;
  },
  state: function () {
    var lv = Packman.level(), C = lv.containers ? PackmanGeom.makeBoxes(lv.containers) : PackmanGeom.makeContainer(lv.container);
    var e = PackmanGeom.evaluate(Packman.pieces(), C);
    return { level: lv.name, packed: e.packed, solved: e.solved, sheet: (document.querySelector('.sheet.open') || {}).id || null,
      save: JSON.parse(localStorage.getItem('packman.v1') || '{}'), count: document.getElementById('count').textContent, clock: document.getElementById('clock').textContent,
      eyes: document.getElementById('board').classList.contains('eyes') };
  }
};
"""

async def tick(page, ms=100):
    """Let the page's clock run on. Everything due in that time is done in its order: timers, and a frame every sixtieth of a second."""
    await page.clock.run_for(ms)

async def player(page):
    """Give a page of the game the helpers above (window.T)."""
    await page.evaluate(PLAYER)
    return page

async def drag(page, i, x, y, steps=8, hold=0):
    """Pick shape i up with the mouse and carry its middle to (x, y) on the board, then let go."""
    g = await page.evaluate('T.grip(%d)' % i)
    assert g, 'shape %d cannot be got at: something lies over all of it' % i
    to = await page.evaluate('T.screen(%r, %r)' % (x + g['off'][0], y + g['off'][1]))
    await page.mouse.move(*g['at']); await page.mouse.down(); await tick(page, 40)
    for k in range(1, steps + 1):
        await page.mouse.move(g['at'][0] + (to[0] - g['at'][0]) * k / steps, g['at'][1] + (to[1] - g['at'][1]) * k / steps)
        await tick(page, 32)
    if hold: await tick(page, hold)
    await page.mouse.up(); await tick(page, 100)

async def tap(page, i):
    """Pick shape i up and put it straight down: it is then the one in hand."""
    g = await page.evaluate('T.grip(%d)' % i)
    assert g, 'shape %d cannot be got at' % i
    await page.mouse.move(*g['at']); await page.mouse.down(); await tick(page, 40); await page.mouse.up(); await tick(page, 100)

async def turn(page, i, angle):
    """Take shape i in hand and turn it to stand at this many degrees, with the box for the angle under the board."""
    await tap(page, i)
    await page.fill('#ang', str(angle % 360)); await page.press('#ang', 'Enter'); await tick(page, 300)
    got = await page.evaluate('Packman.pieces()[%d].angle' % i)
    assert got % 360 == angle % 360, 'shape %d was to be turned to %s and stands at %s' % (i, angle, got)

async def put(page, i, place):
    """Turn shape i to the angle of a place [x, y, angle] and carry it there."""
    if (await page.evaluate('Packman.pieces()[%d].angle' % i)) % 360 != place[2] % 360: await turn(page, i, place[2])
    await drag(page, i, place[0], place[1])
