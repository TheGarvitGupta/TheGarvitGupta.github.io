# Films the Packman reel (reel.js, the game playing itself): steps the page's clock a sixtieth of a second at a time, takes a picture at each step,
# and writes down every note the game plays, to make the soundtrack from afterwards.
#
#   python3 -m http.server 8000 --bind 127.0.0.1        (in the root of the site, left running)
#   python3 film.py OUT [SCALE=4] [LIMIT=14 seconds]    pictures OUT/f00000.png ... and OUT/notes.json; 4 gives 1572 x 3408
#   python3 sound.py OUT/notes.json OUT/sound.wav
#   ffmpeg -framerate 60 -i OUT/f%05d.png -i OUT/sound.wav -c:v libx264 -preset slow -crf 14 -pix_fmt yuv420p \
#          -profile:v high -movflags +faststart -c:a aac -b:a 256k -shortest reel.mp4
#
# Needs playwright (with Chrome installed) here, and numpy for sound.py. OUT is best kept outside the site.
import asyncio, json, sys, os
from playwright.async_api import async_playwright
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True); SCALE = int(sys.argv[2]) if len(sys.argv) > 2 else 4; FPS = 60; LIMIT = float(sys.argv[3]) if len(sys.argv) > 3 else 14
URL = 'http://localhost:8000/packman/?reel&auto&powers=sticky,sleeper'
SEED = """
localStorage.setItem('packman.reel', JSON.stringify({v:3,done:{},last:'Home',name:'Packer',pid:'reel-0000-0000-0000-0000',seen:true,eyeTip:1}));
window.__notes = [];
window.__arm = function () { if (window.Packman && !window.Packman.heard) window.Packman.heard = function (f, d, o) { window.__notes.push([performance.now(), f, d, o.type || 'sine', o.to || 0, o.vol || 0.12, o.at || 0]); }; };
// CSS animations keep the real time; they are held and set by hand to the page's own clock at every step
window.__seen = new Map();
window.__sync = function () {
  window.__arm();
  var now = performance.now();
  document.getAnimations().forEach(function (a) {
    if (!window.__seen.has(a)) { window.__seen.set(a, now - (a.currentTime || 0)); try { a.pause(); } catch (e) {} }
    try { a.currentTime = now - window.__seen.get(a); } catch (e) {}
  });
  return [now, !!document.querySelector('.reel-end')];
};
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(channel='chrome', headless=True)
        ctx = await b.new_context(viewport={'width': 393, 'height': 852}, device_scale_factor=SCALE)
        await ctx.add_init_script(SEED)
        page = await ctx.new_page()
        page.on('pageerror', lambda e: print('PAGE ERROR', e))
        await page.clock.install(time=0)
        await page.clock.pause_at(1000)   # the page's clock stands still but for the steps taken below
        await page.goto(URL)
        for _ in range(100):   # the game there, and its lettering loaded (asked from here: the page's own timers are stopped)
            if await page.evaluate('!!window.Packman && document.fonts.status === "loaded"'): break
            await asyncio.sleep(0.1)
        await asyncio.sleep(1.0)
        n = 0; ended = None; t0 = None
        while True:
            now, card = await page.evaluate('window.__sync()')
            if t0 is None: t0 = now
            await page.screenshot(path=os.path.join(OUT, 'f%05d.png' % n), type='png')
            n += 1
            if card and ended is None: ended = now
            if (ended is not None and now - ended >= 3000) or now - t0 > LIMIT * 1000: break
            step = round(n * 1000 / FPS) - round((n - 1) * 1000 / FPS)   # whole milliseconds, 16 or 17, that keep to sixty a second
            await page.clock.run_for(step)
            if n % 60 == 0: print('frame', n, 'at', round(now - t0), flush=True)
        notes = await page.evaluate('window.__notes')
        json.dump({'t0': t0, 'frames': n, 'fps': FPS, 'notes': notes}, open(os.path.join(OUT, 'notes.json'), 'w'))
        print('frames', n, 'notes', len(notes))
        await b.close()
asyncio.run(main())
