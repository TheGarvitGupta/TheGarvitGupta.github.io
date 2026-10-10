# Pictures of the game, to see that a change which should not alter how anything looks has not.
#
#   python3 shots.py take DIR       a picture of every case below, into DIR (keep it outside the site)
#   python3 shots.py diff OLD NEW   the cases whose pictures differ, and by how many pixels
#
# Take a set before a change and another after it. Every deal is the same from run to run (see site.py), so two
# sets from the same files are the same to the pixel.
import asyncio, os, sys
from playwright.async_api import async_playwright
from harness import served, opened, chrome

# name: (level, what is added to the address, and what the picture is taken with)
CASES = {
    'home':            ('Home', '', {}),
    'home-dark':       ('Home', '', {'dark': True}),
    'home-wide':       ('Home', '', {'width': 1200, 'height': 800}),
    'home-eyes':       ('Home', '', {'eyes': True}),
    'dozen':           ('Dozen', '', {}),
    'seventeen':       ('Seventeen', '', {}),
    'boat-mine':       ('Boat', '?powers=mine,magnet', {}),
    'barge-sticky':    ('Barge', '?powers=sticky,sleeper', {}),
    'windmill-ghost':  ('Windmill', '?powers=ghost,puffer', {}),
    'mixed-cool':      ('Mixed Bag', '?powers=cool,chameleon', {}),
    'mixed-eyes':      ('Mixed Bag', '?powers=ghost,mine', {'eyes': True}),
    'powers-dark':     ('Hex Mix', '?powers=magnet,sticky', {'dark': True}),
    'brickwork':       ('Brickwork', '', {}),
    'rosette':         ('Rosette', '', {}),
    'gears':           ('Haojun\u2019s Gears', '', {}),
    'split':           ('Split Decision', '', {}),
    'sleepwalker':     ('Sleepwalker', '', {}),
    'eleven-bricks':   ('Eleven Bricks', '', {}),
    'duality':         ('Duality', '', {}),
    'duality-dark':    ('Duality', '', {'dark': True}),
    'trinity':         ('Trinity', '', {}),
    'trinity-wide':    ('Trinity', '', {'width': 1200, 'height': 800}),
    'levels':          ('Home', '', {'click': '#chip'}),
    'help':            ('Home', '', {'click': '#b-help'}),
    'solved':          ('Dozen', '', {'solve': True}),
    'shapes':          (None, 'personalities.html', {'full': True}),
    'shapes-dark':     (None, 'personalities.html', {'full': True, 'dark': True}),
    'shapes-wide':     (None, 'personalities.html', {'full': True, 'width': 1200, 'height': 800}),
}

async def take(out):
    os.makedirs(out, exist_ok=True)
    async with async_playwright() as p:
        b = await chrome(p)
        with served() as base:
            for name, (level, more, o) in CASES.items():
                o = dict(o); eyes = o.pop('eyes', 0); click = o.pop('click', 0); solve = o.pop('solve', 0); full = o.pop('full', False)
                page = await opened(b, base, '/packman/' + more, level or 'Home', **o)
                if eyes: await page.click('#b-eye')
                if click: await page.click(click)
                if solve: await page.evaluate('''(function () { var l = Packman.level(); Packman.pieces().forEach(function (p, i) { var s = l.solution[i]; p.x = s[0]; p.y = s[1]; p.angle = s[2]; Packman.render(i); }); Packman.commit(); })()''')
                await page.clock.run_for(2500)
                await page.screenshot(path=os.path.join(out, name + '.png'), full_page=full)
                print(name, '!! ' + '; '.join(page.errors) if page.errors else '', flush=True)
                await page.context.close()
        await b.close()

def diff(a, b):
    import numpy as np
    from PIL import Image
    bad = 0
    for name in CASES:
        A, B = (os.path.join(d, name + '.png') for d in (a, b))
        if not (os.path.exists(A) and os.path.exists(B)): print('MISSING', name); bad += 1; continue
        x, y = np.asarray(Image.open(A).convert('RGB'), int), np.asarray(Image.open(B).convert('RGB'), int)
        if x.shape != y.shape: print('SIZE    %-16s %s -> %s' % (name, x.shape[:2], y.shape[:2])); bad += 1; continue
        d = np.abs(x - y).max(2); n = int((d > 0).sum())
        if n: print('DIFFERS %-16s %6d pixels, the most by %d of 255' % (name, n, d.max())); bad += 1
        else: print('same    ' + name)
    print('%d of %d differ' % (bad, len(CASES))); return bad

if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == 'take': asyncio.run(take(sys.argv[2]))
    elif len(sys.argv) == 4 and sys.argv[1] == 'diff': sys.exit(1 if diff(sys.argv[2], sys.argv[3]) else 0)
    else: sys.exit(__doc__ or 'python3 shots.py take DIR | diff OLD NEW')
