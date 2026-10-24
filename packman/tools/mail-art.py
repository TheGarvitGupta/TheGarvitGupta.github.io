#!/usr/bin/env python3
"""Makes the pictures in Packman's emails, from the game itself: packman/mail/.

Mail apps show no SVG and run no animation of the page's own, so the emails carry pictures, and the moving ones are
GIFs. Each is the real game, served on this machine and opened in Chrome: the pieces drawn by the game's own code,
with its own faces and moods. A frame is taken with every animation on the page set to one moment, so the loops are smooth.

    python3 packman/tools/mail-art.py

    logo.png          the name, at the top of every email
    passed.gif        a smug square hops over a sad one: for "you've been passed"
    rival-<n>.gif     each Rival level as it is dealt, its next piece glowing: for "a new level is open"
"""
import asyncio, io, os, sys
from PIL import Image
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(GAME, 'tests'))
import harness

OUT = os.path.join(GAME, 'mail')
WIDE = 560   # every picture this wide (the email shows them at half that, for sharp screens)

# Everything but the board, gone: a picture is the pieces, the box and the dotted ground under them.
BARE = '''#title, header, .top, .dock, .dev, #hint, .hint, #tip, .tip, #count, .sheet, #soon, .foot, footer, .credit, #stats, .stats, .chip, .bar, .ib, #dock, #bubble { visibility: hidden !important; }'''

async def page_of(browser, base, level, width=393, height=852):
    page = await harness.opened(browser, base, level=level, calm=False, width=width, height=height, scale=2)
    await harness.player(page)
    await page.add_style_tag(content=BARE)
    return page

async def at(page, ms):
    """Every animation on the page, stopped at this moment of it."""
    await page.evaluate('''(function (ms) { document.getAnimations().forEach(function (a) { a.pause(); a.currentTime = ms; }); })(%d)''' % ms)

async def frame(page, box):
    png = await page.screenshot(clip=box)
    im = Image.open(io.BytesIO(png)).convert('RGB')
    return im.resize((WIDE, round(im.height * WIDE / im.width)), Image.LANCZOS)

def gif(frames, path, ms, hold=None):
    """One palette for every frame, made from all of them, so nothing flickers from one to the next."""
    strip = Image.new('RGB', (frames[0].width, frames[0].height * len(frames)))
    for k, f in enumerate(frames): strip.paste(f, (0, k * f.height))
    pal = strip.quantize(colors=255, method=Image.Quantize.MEDIANCUT)
    out = [f.quantize(palette=pal, dither=Image.Dither.NONE) for f in frames]
    times = [ms] * len(out)
    if hold: times[-1] = hold
    out[0].save(path, save_all=True, append_images=out[1:], duration=times, loop=0, optimize=True, disposal=1)
    print('wrote', os.path.relpath(path, GAME), len(out), 'frames,', os.path.getsize(path) // 1024, 'KB')

def around(r, pad):
    return {'x': r['left'] - pad, 'y': r['top'] - pad, 'width': r['right'] - r['left'] + 2 * pad, 'height': r['bottom'] - r['top'] + 2 * pad}

UNION = '''(function (sel) { var r = { left: 1e9, top: 1e9, right: -1e9, bottom: -1e9 };
  document.querySelectorAll(sel).forEach(function (e) { if (getComputedStyle(e).visibility === 'hidden' || getComputedStyle(e).display === 'none') return;
    var b = e.getBoundingClientRect(); if (!b.width) return;
    r.left = Math.min(r.left, b.left); r.top = Math.min(r.top, b.top); r.right = Math.max(r.right, b.right); r.bottom = Math.max(r.bottom, b.bottom); });
  return r; })'''

async def logo(browser, base):
    page = await page_of(browser, base, 'Four Square', width=1100, height=900)   # (wide: the whole name, not only its block)
    await page.evaluate('document.querySelector(".logo").style.visibility = "visible"; document.querySelector("header") && (document.querySelector("header").style.visibility = "visible")')
    await page.add_style_tag(content='html, body { background: #fff !important; }')   # (the white of the card it sits on)
    await at(page, 6400)   # the name's letters hopped in, and the block bobbing at rest
    png = await page.locator('.logo').screenshot()
    im = Image.open(io.BytesIO(png))
    im.save(os.path.join(OUT, 'logo.png'), optimize=True)
    print('wrote mail/logo.png', im.size)

async def passed(browser, base):
    """Two squares from the first level: the one behind hops over the other, smug, and lands ahead; the other is sad."""
    page = await page_of(browser, base, 'Four Square', width=1100, height=900)   # (wide enough for the whole hop)
    await page.add_style_tag(content='#bin, .box, .marks { visibility: hidden !important; }')
    await page.evaluate('''(function () { var P = Packman.pieces();
      P.forEach(function (p, i) { if (i > 1) p.el.style.display = 'none'; });
      P[0].el.classList.add('smug'); P[1].el.classList.add('sad');
      P[1].x = 0; P[1].y = 0.2; P[1].angle = 0; Packman.render(1); })()''')
    MOVE = '(function (x, y, a) { var p = Packman.pieces()[0]; p.x = x; p.y = y; p.angle = (a + 360) %% 360; Packman.render(0); })(%r, %r, %r)'
    r = None
    for x, y in ((-1.65, 0.2), (1.65, 0.2), (0, -1.25)):   # (the picture holds the whole hop: where it starts, lands, and tops out)
        await page.evaluate(MOVE % (x, y, 0)); q = await page.evaluate(UNION + '(".piece")')
        r = q if r is None else {'left': min(r['left'], q['left']), 'top': min(r['top'], q['top']), 'right': max(r['right'], q['right']), 'bottom': max(r['bottom'], q['bottom'])}
    box = around(r, 22)
    frames, N = [], 30
    for k in range(N + 1):
        u = k / N
        e = u * u * (3 - 2 * u)   # eased
        x = -1.65 + 3.3 * e
        y = 0.2 - 1.45 * (4 * e * (1 - e)) ** 0.9   # up and over
        tilt = -25 * (2 * e - 1) * (1 - abs(2 * e - 1))
        await page.evaluate(MOVE % (x, y, tilt))
        await at(page, k * 45)
        frames.append(await frame(page, box))
    for k in range(10):   # landed: it bounces, smug, while the other sulks
        await at(page, (N + k) * 45)
        frames.append(await frame(page, box))
    gif(frames, os.path.join(OUT, 'passed.gif'), 45, hold=900)

async def rival(browser, base, n):
    """The level as it is dealt: the box, both trays, and the player's next piece glowing and nudging, once round."""
    page = await page_of(browser, base, 'Rival %d' % n)   # (as on a phone: Packman's tray, the box, then yours)
    await page.evaluate('document.querySelector(".tray.you .pill text").textContent = "You"')   # (whoever it is sent to)
    r = await page.evaluate(UNION + '("#bin, .piece, .tray")')
    box = around(r, 14)
    d = await page.evaluate('Math.max.apply(null, document.getAnimations().map(function (a) { var t = a.effect && a.effect.getTiming(); return t && isFinite(t.duration) ? t.duration : 0; }).concat([1200]))')
    d = min(int(d), 2400)
    N = 24
    frames = []
    for k in range(N):
        await at(page, int(d * k / N))
        frames.append(await frame(page, box))
    gif(frames, os.path.join(OUT, 'rival-%d.gif' % n), max(40, d // N))

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        browser = await harness.chrome(p)
        with harness.served() as base:
            await logo(browser, base)
            await passed(browser, base)
            for n in range(1, 8): await rival(browser, base, n)
        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
