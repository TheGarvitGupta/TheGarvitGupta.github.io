#!/usr/bin/env python3
"""Makes the prize mug, turning: packman/mug/index.html and packman/mug/art.svg.

The mug on the page is a real object in the browser's own 3D, made of nothing but HTML and CSS: sixty flat
staves stood in a ring and leaned in, as a cooper makes a barrel, with the glaze and the wave wrapped round
them from one picture; the same sixty again facing inwards for the inside; a rim, a floor, and a handle built
of short blocks along a curve. It turns by one CSS animation, and each stave darkens and catches the light as
it goes round by another. There is no script on the page: this one writes it.

    python3 packman/tools/mug.py
"""
import math, os, random

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, 'mug')

# ---- the mug, in pixels (the page scales the whole of it) ----
RB, RT, H = 100.0, 81.0, 156.0        # its radius at the foot and at the rim, and its height
N = 60                                 # staves round it
LEAN = math.degrees(math.atan((RB - RT) / H))
SLANT = math.hypot(H, RB - RT)         # a stave's length, leaning
WIDE = 2 * RB * math.tan(math.pi / N)  # and its width at the foot
ROUND = N * WIDE                       # once round the foot
TURN = 9                               # seconds to go once round

# ---- the picture wrapped round it: stoneware, glaze, and the wave ----
def art():
    W, Hh = 1260, 344                  # two to a pixel
    rnd = random.Random(7)
    o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" preserveAspectRatio="none">' % (W, Hh),
         '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4F72C8"/><stop offset=".55" stop-color="#7092DC"/><stop offset="1" stop-color="#9CB6EA"/></linearGradient></defs>',
         '<rect width="%d" height="%d" fill="#F1EDE3"/>' % (W, Hh)]
    for _ in range(520):               # the speckle of the clay
        o.append('<circle cx="%.0f" cy="%.0f" r="%.1f" fill="%s" opacity="%.2f"/>' % (rnd.random() * W, 84 + rnd.random() * 236, 0.7 + rnd.random() * 1.3, rnd.choice(['#6B5540', '#3E4A66', '#8A7458']), 0.25 + rnd.random() * 0.4))
    NAVY, DEEP, SKY, PALE, SAND, FOAM = '#1B2D5C', '#24407F', '#5B92D6', '#9CC3EC', '#E6D28C', '#FBF9F2'
    x0 = 150                           # the picture is on the side away from the handle
    def P(d, fill='none', stroke=NAVY, w=4, extra=''):
        o.append('<path d="%s" fill="%s" stroke="%s" stroke-width="%s" stroke-linejoin="round" stroke-linecap="round" %s/>' % (d, fill, stroke, w, extra))
    o.append('<g transform="translate(%d 0)">' % x0)
    # the far wave, like a mountain, with foam down its near side
    P('M430 318C470 300 520 262 560 214C572 200 584 196 596 208C628 240 664 286 716 318Z', FOAM)
    P('M560 214C572 200 584 196 596 208C628 240 664 286 716 318L640 318C632 296 606 262 590 246C580 262 568 266 552 262C566 248 566 232 560 214Z', NAVY, NAVY, 3)
    P('M592 232C604 246 612 262 610 276M612 250C626 266 640 282 652 300M574 240C568 250 560 256 550 258', 'none', FOAM, 3)
    for k in range(5): P('M%d 318C%d 300 %d 290 %d 284' % (664 + k * 13, 668 + k * 13, 676 + k * 12, 688 + k * 10), 'none', SKY, 5)
    # the low water between the two, with the boats in it
    P('M300 318C340 290 400 268 452 286C492 300 520 296 560 280C540 300 520 312 500 318Z', NAVY, NAVY, 3)
    P('M372 296C404 282 440 284 470 298M392 306C420 298 446 300 468 308', 'none', SAND, 6)
    P('M452 268C480 254 512 252 540 262', 'none', NAVY, 3)
    P('M470 262L484 250L502 250L514 260', FOAM, NAVY, 3)
    # the great wave: its back, climbing from the left
    P('M-30 318C10 286 40 236 86 186C120 150 168 122 220 124C258 126 288 146 300 176C284 160 262 156 240 164C208 176 196 214 204 250C210 278 232 302 262 318Z', FOAM)
    # the dark water under the crest, and the stripes of lighter water in it
    P('M96 232C112 196 148 168 190 164C214 162 236 170 248 186C226 184 208 196 200 220C192 250 204 290 236 318L60 318C70 290 82 258 96 232Z', NAVY, NAVY, 3)
    for k in range(6):
        P('M%d %d C%d %d %d %d %d %d' % (92 + k * 22, 312 - k * 2, 104 + k * 18, 270 - k * 6, 128 + k * 14, 226 - k * 8, 168 + k * 10, 190 - k * 3 + (k > 3) * 10), 'none', SKY if k % 2 else PALE, 6)
    # the crest: foam in claws, reaching over to the right
    claws = 'M150 150C170 122 214 108 252 116C280 122 302 140 308 166'
    for k in range(7):
        a = 262 + k * 0; cx = 196 + k * 17; cy = 132 + (k - 2.2) ** 2 * 3.2
        claws += 'M%.0f %.0fc10 -4 20 2 22 12c-8 -6 -14 -4 -18 4c8 0 14 6 14 14c-6 -8 -12 -10 -20 -6c2 -10 0 -18 2 -24Z' % (cx, cy)
    P(claws, FOAM, NAVY, 3.5)
    P('M150 150C170 122 214 108 252 116C280 122 302 140 308 166C296 150 276 142 256 146C236 150 222 162 214 178C206 162 186 152 150 150Z', FOAM, NAVY, 3.5)
    P('M176 146C196 132 224 126 248 130M226 150C240 142 262 140 280 148', 'none', NAVY, 2.5)
    for k in range(14):                # spray, flung off it
        o.append('<circle cx="%.0f" cy="%.0f" r="%.1f" fill="%s" stroke="%s" stroke-width="2"/>' % (300 + rnd.random() * 90, 150 + rnd.random() * 90, 3 + rnd.random() * 3.5, FOAM, NAVY))
    # foam at the wave's foot, on the left, and small claws along the water
    P('M-30 318C-10 300 6 292 26 296C16 300 12 308 14 318Z', NAVY, NAVY, 3)
    for k in range(4): P('M%d 318C%d 304 %d 296 %d 292' % (0 + k * 15, 2 + k * 15, 8 + k * 15, 18 + k * 14), 'none', SKY, 5)
    P('M246 300c8 -8 18 -8 24 0c-6 -2 -10 0 -12 6c-2 -6 -6 -8 -12 -6ZM286 286c8 -8 18 -8 24 0c-6 -2 -10 0 -12 6c-2 -6 -6 -8 -12 -6Z', FOAM, NAVY, 2.5)
    o.append('</g>')
    # the foot, glazed dark; and the glaze run down from the rim, with a dark line where it stops
    o.append('<rect y="318" width="%d" height="26" fill="%s"/>' % (W, DEEP))
    def edge(x): return 84 + 2.2 * math.sin(x / W * 2 * math.pi * 3) + 1.4 * math.sin(x / W * 2 * math.pi * 8 + 1)
    pts = ' '.join('L%d %.1f' % (x, edge(x)) for x in range(W, -1, -14))
    o.append('<path d="M0 0H%d %s Z" fill="url(#g)"/>' % (W, pts))
    o.append('<path d="M0 %.1f %s" fill="none" stroke="#2B4AA0" stroke-width="5" opacity=".9"/>' % (edge(0), ' '.join('L%d %.1f' % (x, edge(x)) for x in range(14, W + 1, 14))))
    o.append('<path d="M0 %.1f %s" fill="none" stroke="#C3D3F4" stroke-width="3" opacity=".7"/>' % (edge(0) - 7, ' '.join('L%d %.1f' % (x, edge(x) - 7) for x in range(14, W + 1, 14))))
    for _ in range(160):
        o.append('<circle cx="%.0f" cy="%.0f" r="%.1f" fill="#fff" opacity="%.2f"/>' % (rnd.random() * W, rnd.random() * 70, 0.8 + rnd.random() * 1.4, 0.1 + rnd.random() * 0.18))
    o.append('</svg>')
    return '\n'.join(o)

# ---- the handle: a curve standing out from the side, built of short blocks ----
def handle():
    M, pts = 18, []
    for k in range(M + 1):
        s = k / M * math.pi
        y = 24 + (112 - 24) * (1 - math.cos(s)) / 2
        r = RT + (RB - RT) * y / H - 8 + 66 * math.sin(s) ** 0.7
        pts.append((r, y))
    out = []
    for k in range(M):
        (x1, y1), (x2, y2) = pts[k], pts[k + 1]
        out.append('<i class="seg%s" style="--x:%.1fpx;--y:%.1fpx;--a:%.1fdeg;--l:%.1fpx"><b></b><b></b><b></b><b></b></i>' % (
            ' glazed' if k < 5 else ' dipped' if k == 5 else '', (x1 + x2) / 2, (y1 + y2) / 2, math.degrees(math.atan2(y2 - y1, x2 - x1)), math.hypot(x2 - x1, y2 - y1) + 7))
    return ''.join(out)

PAGE = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The Packman prize</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<style>
/* The prize mug, turning. Made by tools/mug.py: change it there. Everything here is HTML and CSS, in the browser's own 3D. */
html,body{height:100%%; margin:0}
body{display:grid; place-items:center; align-content:center; gap:26px; background:#FFF4DE radial-gradient(rgba(43,33,64,.09) 1.6px, transparent 1.7px) 0 0 / 26px 26px;
  font:600 17px/1.4 "Fredoka", ui-rounded, system-ui, sans-serif; color:#2B2140; text-align:center}
p{margin:0} p small{display:block; font-weight:500; font-size:14px; color:#7A6F90}

/* ---- the mug. Set --size on .mug to make it bigger or smaller: it is the width of the box it is drawn in. ---- */
.mug{--size:340px; --k:calc(var(--size) / 340px); position:relative; width:var(--size); height:var(--size); perspective:calc(var(--size) * 3.4)}
.mug *,.mug *::before,.mug *::after{position:absolute; box-sizing:border-box; transform-style:preserve-3d}
/* its shadow, on whatever it stands on */
.mug::before{content:""; position:absolute; left:46%%; top:50%%; width:calc(330px * var(--k)); height:calc(86px * var(--k)); margin:calc(58px * var(--k)) 0 0 calc(-165px * var(--k));
  border-radius:50%%; background:radial-gradient(closest-side, rgba(43,33,64,.34), rgba(43,33,64,0))}
/* looked at from a little above; drawn at its own size and scaled to fit; and turning */
.mug .tilt{left:46%%; top:50%%; width:0; height:0; transform:scale(calc(var(--k) * 1.16)) translateY(-72px) rotateX(-19deg)}
.mug .turn{left:0; top:0; width:0; height:0; animation:mug-turn %(turn)ss linear infinite}
@keyframes mug-turn{to{transform:rotateY(360deg)}}
/* a stave: stood at the foot's edge, leaned in to the rim, narrower at the top, with its share of the picture on it */
.mug .stave,.mug .inner{left:%(half).3fpx; top:%(drop).3fpx; width:%(wide).3fpx; height:%(slant).3fpx; transform-origin:50%% 100%%;
  transform:rotateY(calc(var(--i) * %(step)sdeg)) translateZ(%(apo).3fpx) rotateX(%(lean).3fdeg);
  clip-path:polygon(%(pinch).2f%% 0, %(pinch2).2f%% 0, 100%% 100%%, 0 100%%); backface-visibility:hidden}
.mug .stave{background:url(art.svg) calc(var(--i) * -%(pitch).4fpx) 0 / %(round).3fpx 100%%}
/* the light stays where it is while the mug turns: each stave darkens as it goes round to the side, and shines as it passes the light */
.mug .stave::before,.mug .stave::after{content:""; inset:0; animation:mug-dark %(turn)ss linear infinite; animation-delay:calc(var(--i) * -%(lag).4fs)}
.mug .stave::before{background:#16153C}
.mug .stave::after{background:#fff; animation-name:mug-shine}
@keyframes mug-dark{0%%{opacity:.03} 6%%{opacity:.07} 12.5%%{opacity:.17} 19%%{opacity:.34} 25%%,75%%{opacity:.58} 81%%{opacity:.3} 87.5%%{opacity:.1} 94%%{opacity:.02} 100%%{opacity:.03}}
@keyframes mug-shine{0%%,80%%{opacity:0} 86%%{opacity:.1} 90.5%%{opacity:.3} 95%%{opacity:.08} 99%%,100%%{opacity:0}}
/* the inside: the same staves seen from within, glazed, darker down towards the floor */
.mug .inner{transform:rotateY(calc(var(--i) * %(step)sdeg)) translateZ(%(apo2).3fpx) rotateX(%(lean).3fdeg) rotateY(180deg); background:linear-gradient(#6C8DDB, #4467BF 45%%, #2B4796)}
.mug .inner::before{content:""; inset:0; background:#101A4A; animation:mug-in %(turn)ss linear infinite; animation-delay:calc(var(--i) * -%(lag).4fs)}
@keyframes mug-in{0%%,100%%{opacity:.3} 25%%{opacity:.14} 50%%{opacity:0} 62%%{opacity:.05} 75%%{opacity:.2}}
/* the floor inside, the rim round the top, and the foot it stands on */
.mug .floor,.mug .rim,.mug .foot{border-radius:50%%; transform:rotateX(90deg)}
.mug .floor{left:-95px; top:%(floor).1fpx; width:190px; height:190px; background:radial-gradient(#2A4796, #1E3478)}
.mug .rim{left:-%(rimr).1fpx; top:-%(rimr).1fpx; width:%(rimd).1fpx; height:%(rimd).1fpx; border:7px solid #A9C0F1; box-shadow:0 0 0 1.5px #5571C2, inset 0 0 0 1.5px #5571C2}
.mug .foot{left:-99px; top:%(foot).1fpx; width:198px; height:198px; background:#1B3070}
/* the handle: it stands out from the side away from the picture, and goes round with the mug */
.mug .handle{left:0; top:0; width:0; height:0; transform:rotateY(%(hat)sdeg)}
.mug .seg{left:0; top:0; width:0; height:0; transform:translate3d(var(--x), var(--y), 0) rotateZ(var(--a)); --c:#F1EDE3; --d:#DDD7C8; --e:#C9C2B1}
.mug .seg.glazed{--c:#7F9DE3; --d:#6585D2; --e:#5373C4}
.mug .seg.dipped b{background-image:linear-gradient(90deg, #6585D2, #DDD7C8)}
.mug .seg b{left:calc(var(--l) / -2); width:var(--l); border-radius:5px}
.mug .seg b:nth-child(1),.mug .seg b:nth-child(2){top:-11px; height:22px; background:var(--d)}      /* its two flat sides */
.mug .seg b:nth-child(1){transform:translateZ(15px)} .mug .seg b:nth-child(2){transform:translateZ(-15px)}
.mug .seg b:nth-child(3),.mug .seg b:nth-child(4){top:-15px; height:30px}                           /* its back and its belly */
.mug .seg b:nth-child(3){transform:rotateX(90deg) translateZ(11px); background:var(--c)} .mug .seg b:nth-child(4){transform:rotateX(90deg) translateZ(-11px); background:var(--e)}
@media (prefers-reduced-motion:reduce){ .mug .turn{animation:none; transform:rotateY(-32deg)} .mug .stave::before,.mug .stave::after,.mug .inner::before{animation-play-state:paused} }
@media (max-width:420px){ .mug{--size:280px} }
</style>
</head>
<body>
<div class="mug" role="img" aria-label="A ceramic mug with a great wave on it, turning"><div class="tilt"><div class="turn">
<div class="foot"></div><div class="floor"></div>
%(inners)s
%(staves)s
<div class="handle">%(handle)s</div>
<div class="rim"></div>
</div></div></div>
<p>The prize<small>For getting into the top three</small></p>
</body>
</html>
'''

def page():
    apo = RB / math.tan(math.pi / N) * math.tan(math.pi / N)   # the staves stand at the foot's radius
    pinch = (1 - RT / RB) / 2 * 100
    v = dict(turn=TURN, half=-WIDE / 2 - 0.8, wide=WIDE + 1.6,   # (a little wider than its share, so no light shows between two of them)
             slant=SLANT, drop=H - SLANT, step=360 / N, apo=RB * math.cos(math.pi / N), apo2=RB * math.cos(math.pi / N) - 4,
             lean=LEAN, pinch=pinch, pinch2=100 - pinch, pitch=WIDE, round=ROUND, lag=TURN / N, floor=H - 14 - 95, foot=H - 99 - 1, rimr=RT + 1, rimd=2 * RT + 2, hat=-90,
             staves=''.join('<i class="stave" style="--i:%d"></i>' % i for i in range(N)), inners=''.join('<i class="inner" style="--i:%d"></i>' % i for i in range(N)), handle=handle())
    return PAGE % v

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    open(os.path.join(OUT, 'art.svg'), 'w').write(art())
    open(os.path.join(OUT, 'index.html'), 'w').write(page())
    print('wrote mug/index.html', len(page()), 'bytes and mug/art.svg', len(art()), 'bytes')
