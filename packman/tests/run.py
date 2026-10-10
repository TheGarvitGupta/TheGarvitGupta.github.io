#!/usr/bin/env python3
"""Packman's tests, all of them:

    python3 packman/tests/run.py                 everything, in Chrome
    python3 packman/tests/run.py levels geom     only the files test_levels.py and test_geom.py
    python3 packman/tests/run.py game:win        only the tests of test_game.py with "win" in their names
    python3 packman/tests/run.py --webkit        in WebKit, the engine Safari is built on, in place of Chrome

Each file test_*.py here is a set of tests: every function in it whose name starts with test_ is one, and passes
unless it raises. A test is handed t (see T below) to get pages from. Needs Python with playwright, and Chrome.
"""
import asyncio, glob, importlib, inspect, os, sys, time, traceback
from playwright.async_api import async_playwright
import harness

HERE = os.path.dirname(os.path.abspath(__file__))
ORDER = ['files', 'levels', 'geom', 'sounds', 'game', 'powers', 'twists', 'board', 'pages']   # the quick ones first

class T:
    """What a test is handed."""
    def __init__(self, browser, base, engine):
        self.browser, self.base, self.engine, self._open = browser, base, engine, []
    async def page(self, path='/packman/', **how):
        """A page of the site, held still: see harness.opened for what can be asked."""
        p = await harness.opened(self.browser, self.base, path, **how); self._open.append(p); return p
    async def bare(self, *scripts):
        """An empty page with only these of the game's scripts in it (geom.js and levels.js if none are named)."""
        p = await harness.bare(self.browser, scripts or ('geom.js', 'levels.js')); self._open.append(p); return p
    async def done(self):
        for p in self._open:
            try: await p.context.close()
            except Exception: pass
        self._open = []

def wanted(args):
    files = sorted(os.path.basename(f)[5:-3] for f in glob.glob(os.path.join(HERE, 'test_*.py')))
    files.sort(key=lambda f: ORDER.index(f) if f in ORDER else len(ORDER))
    if not args: return [(f, '') for f in files]
    out = []
    for a in args:
        f, _, part = a.partition(':')
        if f not in files: sys.exit('no such set of tests: %s (there are: %s)' % (f, ', '.join(files)))
        out.append((f, part))
    return out

async def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    engine = 'webkit' if '--webkit' in sys.argv else 'chrome'
    sys.path.insert(0, HERE)
    passed, failed, skipped, t0 = 0, [], [], time.time()
    async with async_playwright() as p:
        browser = await (p.webkit.launch() if engine == 'webkit' else harness.chrome(p))
        with harness.served() as base:
            for f, part in wanted(args):
                mod = importlib.import_module('test_' + f)
                tests = [(n, fn) for n, fn in vars(mod).items() if n.startswith('test_') and callable(fn) and part in n]
                print('\n%s' % f)
                for name, fn in tests:
                    t = T(browser, base, engine); t1 = time.time()
                    try:
                        r = fn(t)
                        if inspect.isawaitable(r): await asyncio.wait_for(r, 240)
                        passed += 1; print('  ok    %-52s %5.1fs' % (name[5:], time.time() - t1), flush=True)
                    except harness.Skip as e:
                        skipped.append((f, name[5:], str(e))); print('  skip  %-52s %s' % (name[5:], e), flush=True)
                    except Exception as e:
                        if isinstance(e, AssertionError) and str(e): said = str(e)
                        else:   # something broke: what, and the line of the test it broke at
                            here = [fr for fr in traceback.extract_tb(e.__traceback__) if os.path.basename(fr.filename).startswith('test_')]
                            said = '%s: %s' % (type(e).__name__, str(e).strip() or 'no more is said') + ''.join('\n  at %s line %d: %s' % (os.path.basename(fr.filename), fr.lineno, fr.line) for fr in here[-2:])
                        failed.append((f, name[5:], said)); print('  FAIL  %s' % name[5:], flush=True)
                        print('\n'.join('          ' + l for l in said.split('\n')), flush=True)
                    finally:
                        await t.done()
        await browser.close()
    print('\n%d passed, %d failed%s, in %.0f seconds (%s)' % (passed, len(failed), ', %d skipped' % len(skipped) if skipped else '', time.time() - t0, engine))
    for f, n, _ in failed: print('  failed: %s:%s' % (f, n))
    sys.exit(1 if failed else 0)

if __name__ == '__main__':
    asyncio.run(main())
