# What the tests share: the site served from this machine for as long as a test runs, and a page of the game
# opened in Chrome with everything that changes from one run to the next held still.
import asyncio, contextlib, functools, http.server, json, os, socketserver, threading

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))   # the root of the site
GAME = os.path.join(ROOT, 'packman')

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

@contextlib.contextmanager
def served():
    """The site at http://localhost:<port>/ (the game only opens every level, and keeps scores to itself, on localhost)."""
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=ROOT)) as s:
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
  if (%s) try { localStorage.setItem(%s, JSON.stringify(%s)); } catch (e) {}
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
