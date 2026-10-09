#!/usr/bin/env python3
"""Draw the ground the collection sits on: coins/css/rubbings-1.svg and on.

One large drawing rather than a tile, so nothing on the page repeats: coins of
the shapes India struck, laid out the way the coins themselves are, strewn down
a sheet with a cataloguer's marks between them. It is black on clear, because
the stylesheet uses it as a mask over a block of the theme's colour — one file
serves both themes.

There are several sheets, the same coins dealt into different places, and the
page moves on to the next one each time it is opened — it is seldom long enough
to show a whole sheet, so this is how a visitor gets to see all of them.

Everything here is drawn by arithmetic, and the scatter is seeded, so running
it again gives the same sheets. Run it after changing anything below:

    python3 coins/tools/rubbings.py

It also writes coins/tools/specimens.html, which shows each piece on its own,
sharp and large, and then every sheet unblurred.
"""

import math
import random
import sys
import xml.dom.minidom
from pathlib import Path

COINS = Path(__file__).parent.parent

# How far the line is put out of focus, in drawing units, which are close to
# pixels on the page. It is done here and not in CSS because a CSS blur on a
# masked element does nothing: filters run before masks, so it would blur a
# flat block of colour and then cut it out as sharply as ever.
BLUR = 1.0

_n = [0]
def uid():
    _n[0] += 1
    return f"e{_n[0]}"

def f(v): return f"{v:.1f}".rstrip("0").rstrip(".")

def circ(r, w=None):
    return f"<circle r='{f(r)}'" + (f" stroke-width='{w}'" if w else "") + "/>"

def polar(fn, n=720):
    pts = []
    for k in range(n):
        a = 2 * math.pi * k / n
        r = fn(a)
        pts.append(f"{f(r*math.sin(a))} {f(-r*math.cos(a))}")
    return "<path d='M" + "L".join(pts) + "Z'/>"

def ring(inner, count, offset=0.0):
    i = uid()
    out = f"<g id='{i}'>{inner}</g>"
    for k in range(1, count):
        out += f"<use href='#{i}' transform='rotate({360*k/count:.3f})'/>"
    return f"<g transform='rotate({f(offset)})'>{out}</g>" if offset else out


def beads(r, count, br):
    c = 2 * math.pi * r / count
    return f"<circle r='{f(r)}' stroke-width='{f(2*br)}' stroke-linecap='round' stroke-dasharray='0 {c:.4f}'/>"

def ticks(r1, r2, count, t=1.0):
    r = (r1 + r2) / 2
    c = 2 * math.pi * r / count
    return f"<circle r='{f(r)}' stroke-width='{f(r2-r1)}' stroke-dasharray='{t} {c-t:.4f}'/>"


def petal(r1, r2, w, vein=True):
    L = r2 - r1
    d = (f"M0 {f(-r1)}C{f(w)} {f(-r1-.3*L)} {f(w)} {f(-r1-.62*L)} 0 {f(-r2)}"
         f"C{f(-w)} {f(-r1-.62*L)} {f(-w)} {f(-r1-.3*L)} 0 {f(-r1)}Z")
    if vein:
        w2, a, b = w * .5, r1 + .12 * L, r2 - .2 * L
        l = b - a
        d += (f"M0 {f(-a)}C{f(w2)} {f(-a-.3*l)} {f(w2)} {f(-a-.62*l)} 0 {f(-b)}"
              f"C{f(-w2)} {f(-a-.62*l)} {f(-w2)} {f(-a-.3*l)} 0 {f(-a)}Z")
    return f"<path d='{d}'/>"

def leaf(r, length, w, tilt):
    return (f"<path transform='translate(0 {f(-r)}) rotate({tilt})' d='M0 0C{f(w)} {f(-.3*length)} {f(w)} {f(-.7*length)} 0 {f(-length)}"
            f"C{f(-w)} {f(-.7*length)} {f(-w)} {f(-.3*length)} 0 0Z'/>")



def at(x, y, inner, scale=1.0, turn=0.0):
    return f"<g transform='translate({f(x)} {f(y)}) rotate({f(turn)}) scale({scale:.4f})'>{inner}</g>"

def sheet(w, h, body, defs="", sw=1.0, blur=0):
    soft, flt = "", ""
    if blur > 0:
        soft = (f"<filter id='bl' filterUnits='userSpaceOnUse' x='0' y='0' width='{w}' height='{h}'>"
                f"<feGaussianBlur stdDeviation='{blur}'/></filter>")
        flt = " filter='url(#bl)'"
    return (f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {w} {h}'>{defs}{soft}"
            f"<g{flt} fill='none' stroke='#000' stroke-width='{sw}' stroke-linejoin='round'>{body}</g></svg>")


# ── Devices, drawn from photographs of the coins ───────────────────────────
# Each sits in a box about 64 units tall, centred on the origin.

def _grain(y, side, tilt, awn):
    d = "M0 0C2.3 -2.6 2.3 -6.2 0 -8.8C-2.3 -6.2 -2.3 -2.6 0 0Z"
    if awn:
        d += f"M0 -8.8L0 {f(-8.8 - awn)}"
    return f"<path transform='translate({f(1.3*side)} {f(y)}) rotate({f(tilt*side)})' d='{d}'/>"

def wheat_awned():
    """The bearded ear on the rupee: long awns, and blades crossing the stalk."""
    out = "<path d='M0 31L0 -15'/>"
    for i in range(6):
        y = 9 - i * 5
        out += _grain(y, 1, 23 - i, 13 + i) + _grain(y - 2.5, -1, 23 - i, 13 + i)
    out += _grain(-20, 0, 0, 14)
    out += ("<path d='M0 24C-6 14 -14 3 -21 -11C-12 1 -5 12 0 19Z'/>"
            "<path d='M0 27C8 19 15 12 22 5C16 15 8 22 0 30Z'/>"
            "<path d='M0 31C-9 31 -17 27 -25 20C-16 27 -8 29 0 29Z'/>")
    return out

def wheat_curl():
    """The older ear: short beard, and a leaf that curls back on itself like a ribbon."""
    out = "<path d='M0 14L0 -15'/>"
    for i in range(6):
        y = 9 - i * 5
        out += _grain(y, 1, 27 - i, 3.5) + _grain(y - 2.5, -1, 27 - i, 3.5)
    out += _grain(-20, 0, 0, 5)
    out += ("<path d='M0 14C0 24 -6 31 -13 28C-21 24 -18 13 -11 15C-6 16.5 -6 22 -10.5 22.5'/>"
            "<path d='M1.6 14C1.8 25 -5 33.5 -14 30.5'/>"
            "<path d='M0 19C8 20 15 25 18 33C11 28 5 26 0 26Z'/>")
    return out

def lotus_spray():
    """The lotus as it grows on the coin: an open flower, a bud on its own stem, a leaf below."""
    pet = "M4 14C-1.5 8 -1.5 -2 4 -9C9.5 -2 9.5 8 4 14Z"
    out = ""
    for a, k in ((0, 1), (33, .95), (-33, .95), (66, .84), (-66, .84)):
        out += f"<path d='{pet}' transform='rotate({a} 4 14) translate({f(4*(1-k))} {f(14*(1-k))}) scale({k})'/>"
    out += "<path d='M4 12L4 -3M-5 15.5Q4 20.5 13 15.5M-3 17.5Q4 22 11 17.5'/>"
    out += "<path d='M4 19C4 24 2 28 -1 32'/>"                                   # the flower's stem
    out += "<path d='M1 22C-9 15 -13 2 -8 -11C-6 -16 -6.5 -19 -7 -22'/>"         # the bud's
    out += "<path d='M-7 -22C-11.5 -25 -10.5 -31.5 -7 -35C-3.5 -31.5 -2.5 -25 -7 -22ZM-7 -22L-7 -31'/>"
    out += "<path d='M-1 31C6 24 16 23.5 23 28C15 33.5 5 35 -1 31ZM-1 31Q10 27.5 23 28'/>"
    out += "<path d='M-1 31C-8 28.5 -14 30 -17 34.5C-11 33 -6 33 -1 31Z'/>"
    return out

def flank(inner, x, k, turn):
    """The same device either side of the centre, mirrored, leaving the middle for the numeral."""
    g = at(-x, 0, inner, k, -turn)
    return g + f"<g transform='scale(-1 1)'>{g}</g>"

FONT = "font-family='Georgia, Times New Roman, serif'"

def legend(top, bottom, r=70, size=9.5):
    """Lettering round the rim: one line over the top, one read along the bottom."""
    out = ""
    for words, rad, sweep in ((top, r, 1), (bottom, r + size * .72, 0)):
        if not words:
            continue
        i = uid()
        out += (f"<path id='{i}' stroke='none' d='M{f(-rad)} 0A{f(rad)} {f(rad)} 0 0 {sweep} {f(rad)} 0'/>"
                f"<text {FONT} font-size='{size}' letter-spacing='{.8 if words.isascii() else 0}' fill='#000' stroke='none'>"
                f"<textPath href='#{i}' startOffset='50%' text-anchor='middle'>{words}</textPath></text>")
    return out

def numeral(n, size=46, y=0):
    return f"<text {FONT} font-size='{size}' text-anchor='middle' x='0' y='{f(y + size*.34)}'>{n}</text>"

def ears(r=37, a0=38, a1=146, step=12, L=10.5, w=2.5):
    """Two ears of grain curving up either side of the denomination."""
    half = ""
    a = a0
    while a <= a1:
        half += f"<g transform='rotate({a})'>{leaf(r, L, w, -28)}{leaf(r, L, w, -96)}</g>"
        a += step
    p = lambda d: f"{f(r*math.sin(math.radians(d)))} {f(-r*math.cos(math.radians(d)))}"
    half += f"<path d='M{p(a0-8)}A{r} {r} 0 0 1 {p(a1+10)}'/>"
    return half + f"<g transform='scale(-1 1)'>{half}</g>"

def txt(s, y, size, ls=0, x=0, turn=0):
    t = f" transform='rotate({turn} {f(x)} {f(y)})'" if turn else ""
    return (f"<text {FONT} font-size='{size}' letter-spacing='{ls}' text-anchor='middle' x='{f(x)}' y='{f(y)}' "
            f"fill='#000' stroke='none'{t}>{s}</text>")

def four(words, r, size):
    """The value in four scripts, one to each quarter, as the British India small change carried it."""
    out = ""
    for word, a in zip(words, (-45, 45, -135, 135)):
        x, y = r * math.sin(math.radians(a)), -r * math.cos(math.radians(a))
        out += txt(word, y + size * .34, size, 0, x, a if abs(a) < 90 else (a - 180 if a > 0 else a + 180))
    return out

def mint(kind, y, s=3.2):
    if kind == "mumbai":
        return f"<path d='M0 {f(y-s)}L{f(s*.72)} {f(y)}L0 {f(y+s)}L{f(-s*.72)} {f(y)}Z' fill='#000' stroke='none'/>"
    if kind == "hyderabad":
        pts = " ".join(f"{f((s if i % 2 == 0 else s*.4)*math.sin(math.radians(36*i)))},{f(y - (s if i % 2 == 0 else s*.4)*math.cos(math.radians(36*i)))}" for i in range(10))
        return f"<polygon points='{pts}' fill='#000' stroke='none'/>"
    return f"<circle cx='0' cy='{f(y)}' r='{f(s*.45)}' fill='#000' stroke='none'/>"   # Noida

def face(kind):
    """A coin face in a 100-unit radius, laid out the way the coin itself is:
    a raised rim, a border of beads or teeth, a plain field, the value in the
    middle, its name in words, the date, and the mint's mark under the date."""
    sq = lambda k: (lambda a: k / (abs(math.cos(a))**5 + abs(math.sin(a))**5) ** .2)
    ngon = lambda n, k: (lambda a: k * math.cos(math.pi/n) / math.cos(((a + math.pi/n) % (2*math.pi/n)) - math.pi/n))
    diamond = lambda: f"<g transform='rotate(45)'>{polar(sq(80), 360) + polar(sq(76.5), 360)}</g>"
    quatrefoil = lambda r: polar(lambda a: r + r * .13 * math.cos(4 * a), 240) + polar(lambda a: r * .9 + r * .13 * math.cos(4 * a), 240)

    if kind == "rupee":      # one rupee: the numeral between two bearded ears of wheat
        return (circ(100) + circ(96) + beads(91, 96, 1.3) + flank(wheat_awned(), 43, 1.0, 8) + numeral(1, 64)
                + txt("रुपया", -44, 14) + txt("RUPEE", 50, 12, 2.5) + txt("1985", 68, 10, 1) + mint("mumbai", 78))
    if kind == "two":        # two rupees, eleven-sided, with the lotus
        return (polar(ngon(11, 100), 440) + polar(ngon(11, 96.5), 440) + beads(88, 92, 1.25)
                + flank(lotus_spray(), 42, .95, 4) + numeral(2, 60)
                + txt("रुपये", -46, 14) + txt("RUPEES", 50, 11, 2.2) + txt("1992", 67, 10, 1) + mint("hyderabad", 77))
    if kind == "five":       # five paise: a square stood on its corner
        return (diamond() + flank(wheat_curl(), 37, .7, 6) + numeral(5, 50)
                + txt("पैसे", -34, 12) + txt("PAISE", 42, 10, 2) + txt("1967", 56, 9, 1) + mint("mumbai", 65, 2.6))
    if kind == "ten":        # ten naye paise: eight scallops, "a tenth part of a rupee"
        return (polar(lambda a: 95 + 5 * math.cos(8 * a), 360) + polar(lambda a: 91.5 + 5 * math.cos(8 * a), 360)
                + beads(80, 80, 1.25) + legend("रुपये का दसवाँ भाग", "", 58, 10.5) + numeral(10, 50)
                + txt("नये पैसे", 44, 12) + txt("1958", 61, 9.5, 1) + mint("mumbai", 70, 2.6))
    if kind == "hex":        # twenty paise: six sides, and the lotus the brass one carried
        return (polar(ngon(6, 100), 360) + polar(ngon(6, 96), 360) + flank(lotus_spray(), 54, .6, 0) + numeral(20, 50)
                + txt("पैसे", -36, 13) + txt("PAISE", 44, 11, 2.2) + txt("1985", 60, 9.5, 1) + mint("noida", 69))
    if kind == "anna":       # one anna: twelve scallops, the value in four scripts round a frame
        return (polar(lambda a: 97 + 3 * math.cos(12 * a), 360) + polar(lambda a: 93.5 + 3 * math.cos(12 * a), 360)
                + beads(84, 72, 1.3) + quatrefoil(38)
                + txt("ONE ANNA", -9, 10, 1.2) + txt("INDIA", 5, 10, 2) + txt("1944", 19, 10, 1)
                + four(("एक आना", "ایک آنہ", "এক আনা", "ఒక అణా"), 63, 10))
    if kind == "square":     # two annas: the square on its corner, the numeral in a frame
        return (diamond() + quatrefoil(29) + numeral(2, 36)
                + four(("दो आना", "دو آنہ", "দুই আনা", "రెండు అణాలు"), 51, 8.5)
                + txt("INDIA", -67, 8, 1.5) + txt("1939", 74, 8, 1))
    if kind == "pice":       # one pice: holed, a wreath round the hole
        return (circ(100) + circ(96) + beads(90, 88, 1.25) + legend("ONE PICE &#183; INDIA", "1945", 64, 11)
                + ring(leaf(36, 13, 3, 34) + leaf(36, 13, 3, -34), 22) + circ(36) + circ(20) + circ(17, 1.6))
    if kind == "half":       # the silver half rupee: the words inside a wreath, a toothed border
        bow = "<path d='M0 64C-10 56 -18 62 -12 70C-8 74 -3 70 0 64C10 56 18 62 12 70C8 74 3 70 0 64'/>"
        return (circ(100) + ticks(94, 99.5, 150, .8) + circ(93) + ears(64, 22, 156, 10.5, 15, 4) + bow
                + at(0, -64, ring(petal(2, 10, 2.6, False), 8) + circ(2))
                + txt("HALF", -16, 15, 3) + txt("RUPEE", 2, 15, 3) + txt("INDIA", 19, 9.5, 2.5) + txt("1943", 34, 11, 1.5))

# Where a coin goes, how big, and how far it is turned. The top centre is left
# clear for the wordmark. The second place runs off the top of the sheet, so it
# is drawn again off the bottom to meet itself when the sheet repeats.
PLACES = [
    (110, 250, 300, 12), (1490, 90, 210, 8), (1380, 640, 330, -6), (250, 850, 180, 18), (620, 620, 130, -14),
    (820, 1120, 150, 0), (30, 1480, 310, 5), (1450, 1370, 240, 22), (980, 1850, 360, -20), (290, 2130, 220, 15),
    (1585, 1965, 180, -12), (640, 1520, 110, 30), (1130, 1230, 95, 40), (700, 2240, 140, -10), (420, 1250, 120, 10),
]
TOP = 5        # how many of those a visitor sees without scrolling
KINDS = ["rupee", "hex", "anna", "square", "two", "pice", "two", "ten", "half", "five",
         "rupee", "hex", "pice", "ten", "anna"]
SHEETS = 4


def dealt(variant):
    """Which coin goes in which place on each sheet.

    The page is rarely as long as the sheet, so most visits see only the top
    of it. Sheets come in pairs: whatever one puts at the top, the next keeps
    off the top, so two visits between them have shown every coin there is.
    """
    every = sorted(set(KINDS))
    order = list(KINDS)
    for v in range(1, variant + 1):
        rng = random.Random(1947 + v)
        if v % 2:        # the other half of the pair: the coins the last sheet kept below
            top = [k for k in every if k not in order[:TOP]]
        else:
            top = list(every)
        rng.shuffle(top)
        top = top[:TOP]
        top += rng.sample([k for k in every if k not in top], TOP - len(top))
        rest = [k for k in every if k not in top]
        rest += rng.sample(every, len(PLACES) - TOP - len(rest))
        rng.shuffle(rest)
        order = top + rest
    return order


def rubbings(blur=BLUR, variant=0):
    W, H = 1600, 2400
    lay = [(x, y, R, kind, turn) for (x, y, R, turn), kind in zip(PLACES, dealt(variant))]
    lay.insert(2, (lay[1][0], lay[1][1] + H, lay[1][2], lay[1][3], lay[1][4]))
    kinds = sorted({l[3] for l in lay})
    defs = "<defs>" + "".join(f"<g id='k-{k}'>{face(k)}</g>" for k in kinds) + "</defs>"

    # Compass sweeps from the engraver's table, running under everything.
    b = "<g stroke-dasharray='2 8' opacity='.55'>"
    for cx, cy, r in ((-420, 980, 1180), (2010, 1880, 1290), (760, -980, 1720), (1280, 3320, 1500)):
        b += f"<circle cx='{cx}' cy='{cy}' r='{r}'/><circle cx='{cx}' cy='{cy}' r='{r + 14}' stroke-dasharray='none' opacity='.5'/>"
    b += "</g>"

    for x, y, R, kind, turn in lay:
        k = R / 100
        # Fainter toward the middle of the page, where the collection itself sits.
        depth = .5 + .5 * min(1, abs(x - W / 2) / (W * .42))
        L = R * 1.14
        b += (f"<g transform='translate({x} {y}) rotate({turn})' opacity='{depth:.2f}'>"
              f"<use href='#k-{kind}' transform='scale({k:.3f})' stroke-width='{.9/k:.3f}'/>"
              # The centre lines it was set out on, run a little past the rim.
              f"<path d='M{f(-L)} 0H{f(L)}M0 {f(-L)}V{f(L)}' stroke-dasharray='14 5 2 5' opacity='.5'/>"
              f"<path d='M{f(-L)} -5v10M{f(L)} -5v10M-5 {f(-L)}h10M-5 {f(L)}h10'/></g>")

    # ── What a cataloguer leaves in the margins ──
    rng = random.Random(1862 + variant)   # 1862: the year of the first Crown rupee
    taken = []                         # boxes already written in: (x0, y0, x1, y1)

    def clear(x0, y0, x1, y1, pad=14):
        if x0 < 16 or x1 > W - 16 or y0 < 16 or y1 > H - 16:
            return False
        if x1 > 440 and x0 < 1160 and y0 < 540:      # the wordmark and the search bar
            return False
        for cx, cy, R, *_ in lay:
            nx, ny = min(max(cx, x0), x1), min(max(cy, y0), y1)
            if math.hypot(cx - nx, cy - ny) < R * 1.03 + pad:
                return False
        return all(x1 < a or x0 > c or y1 < b_ or y0 > d for a, b_, c, d in taken)

    # A coin seen edge-on: the reeding, the plain edge, the security edge.
    def edge(x, y, w, turn, label, dash):
        box = (x - w/2 - 8, y - 22, x + w/2 + 8, y + 22)
        if not clear(*box):
            return ""
        taken.append(box)
        return (f"<g transform='translate({x} {y}) rotate({turn})'>"
                f"<rect x='{-w/2}' y='-8' width='{w}' height='16' rx='3'/>"
                + (f"<path d='M{-w/2 + 4} 0H{w/2 - 4}' stroke-width='16' stroke-dasharray='{dash}'/>" if dash else
                   f"<path d='M{-w/2 + 6} 0H{w/2 - 6}'/>")
                + "</g>")
    b += edge(800, 850, 190, -7, "reeded edge", "1 3.2")
    b += edge(1085, 2335, 170, 5, "security edge", "1 2 1 9")
    b += edge(560, 1010, 130, 9, "plain edge", "")
    b += edge(1255, 1065, 120, -12, "reeded edge", "1 3.2")

    # Studies of the devices themselves, the way an engraver works one up
    # large before cutting it small.
    def study(inner, k, hw, hh, label, band):
        spots = [(x, y) for y in range(band[0], band[1], 24) for x in range(60, W - 60, 24)]
        rng.shuffle(spots)
        for scale in (k, k * .8, k * .62):
            w2, h2 = hw * scale, hh * scale
            for x, y in spots:
                box = (x - w2 - 6, y - h2 - 6, x + w2 + 6, y + h2 + 6)
                if clear(*box, pad=10):
                    taken.append(box)
                    return (f"<g transform='translate({x} {y})'><g transform='rotate({rng.uniform(-9, 9):.1f}) scale({scale:.3f})' "
                            f"stroke-width='{.9/scale:.3f}'>{inner}</g></g>")
        return ""
    b += study(lotus_spray(), 2.6, 26, 37, "lotus, with bud and leaf", (900, 1700))
    b += study(wheat_awned(), 2.6, 27, 37, "ear of wheat, bearded", (1500, 2360))
    b += study(wheat_curl(), 2.4, 22, 36, "ear of wheat", (540, 2360))
    b += study(lotus_spray(), 2.0, 26, 37, "lotus", (1700, 2360))
    b += study(wheat_curl(), 2.0, 22, 36, "ear of wheat", (560, 1300))

    # And the mints' own marks, let fall in whatever room is left.
    def mark(x, y, kind, s):
        if kind == 0:   # Mumbai's diamond
            return f"<path d='M{f(x)} {f(y-s)}L{f(x+s*.7)} {f(y)}L{f(x)} {f(y+s)}L{f(x-s*.7)} {f(y)}Z' fill='#000' stroke='none'/>"
        if kind == 1:   # Hyderabad's star
            pts = " ".join(f"{f(x + (s if i % 2 == 0 else s*.4)*math.sin(math.radians(36*i)))},{f(y - (s if i % 2 == 0 else s*.4)*math.cos(math.radians(36*i)))}" for i in range(10))
            return f"<polygon points='{pts}' fill='#000' stroke='none'/>"
        if kind == 2:   # Noida's dot
            return f"<circle cx='{f(x)}' cy='{f(y)}' r='{f(s*.42)}' fill='#000' stroke='none'/>"
        if kind == 3:   # Hyderabad's split diamond
            return f"<path d='M{f(x)} {f(y-s)}L{f(x+s*.7)} {f(y)}L{f(x)} {f(y+s)}L{f(x-s*.7)} {f(y)}ZM{f(x-s*.7)} {f(y)}H{f(x+s*.7)}'/>"
        return f"<path d='M{f(x-s)} {f(y)}H{f(x+s)}M{f(x)} {f(y-s)}V{f(y+s)}'/>"   # a register cross
    step = 118
    for gy in range(0, H, step):
        for gx in range(0, W, step):
            x, y = gx + rng.uniform(10, step - 10), gy + rng.uniform(10, step - 10)
            sz = rng.uniform(4.5, 8)
            if rng.random() < .62 and clear(x - sz - 4, y - sz - 4, x + sz + 4, y + sz + 4, pad=20):
                b += f"<g opacity='{rng.uniform(.45, .9):.2f}'>{mark(x, y, rng.choice((0, 0, 1, 1, 2, 2, 3, 4)), sz)}</g>"

    return sheet(W, H, b, defs, sw=.9, blur=blur)


# ── A plain page with every piece on its own, sharp, to look at properly ──
def specimens(path):
    def card(title, note, inner, box=110, sw=.5):
        return (f"<figure><svg viewBox='{-box} {-box} {2*box} {2*box}' fill='none' stroke='currentColor' "
                f"stroke-width='{sw}' stroke-linejoin='round'>{inner}</svg>"
                f"<figcaption><b>{title}</b><span>{note}</span></figcaption></figure>")
    coins = [
        ("rupee", "One rupee", "Round. The numeral between two bearded ears of wheat; the name in Hindi above and English below; date; Mumbai's diamond."),
        ("two", "Two rupees", "Eleven-sided. A lotus with bud and leaf either side; Hyderabad's star."),
        ("five", "Five paise", "Square, stood on its corner. Wheat with the curled leaf."),
        ("ten", "Ten naye paise, 1958", "Eight scallops. &#8220;A tenth part of a rupee&#8221; over the numeral, as struck."),
        ("hex", "Twenty paise", "Hexagonal. The lotus is borrowed from the earlier brass twenty paise; Noida's dot."),
        ("anna", "One anna, 1944", "Twelve scallops. The value in Hindi, Urdu, Bengali and Telugu round a frame."),
        ("square", "Two annas, 1939", "Square on its corner. The numeral in a frame, the value in four scripts."),
        ("pice", "One pice, 1945", "Holed, with a wreath round the hole."),
        ("half", "Half rupee, 1943", "Round, toothed border. The words inside a tied wreath."),
    ]
    devices = [
        ("Bearded wheat", "As on the rupee of the 1980s.", wheat_awned()),
        ("Wheat with curled leaf", "As on the older rupee.", wheat_curl()),
        ("Lotus spray", "Flower, bud and leaf.", lotus_spray()),
    ]
    wholes = "".join(
        f"<h2>Sheet {v + 1} of {SHEETS}</h2><div class='whole'>"
        + rubbings(blur=0, variant=v).replace("stroke='#000'", "stroke='currentColor'").replace("k-", f"s{v}-") + "</div>"
        for v in range(SHEETS))
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rubbings: every piece</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=Montserrat:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {{ --bg: #f5f3ef; --raise: #ffffff; --ink: #1b1a17; --dim: #605b53; --line: rgba(0,0,0,.12); --gold: #6f570b; }}
  :root[data-theme="dark"] {{ --bg: #0b0b0d; --raise: #131316; --ink: #f2f0ec; --dim: #918e88; --line: rgba(255,255,255,.12); --gold: #e0c264; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; padding: 2.5rem clamp(1rem, 4vw, 3rem) 5rem; background: var(--bg); color: var(--ink);
         font: 15px/1.6 Montserrat, -apple-system, sans-serif; }}
  header {{ display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; flex-wrap: wrap; max-width: 1500px; margin: 0 auto; }}
  h1 {{ margin: 0; font: 400 clamp(2.2rem, 5vw, 3.4rem)/1 "Cormorant Garamond", Georgia, serif; }}
  h2 {{ max-width: 1500px; margin: 3.5rem auto 1.25rem; font-size: .6875rem; font-weight: 500; letter-spacing: .28em; text-transform: uppercase; color: var(--dim); }}
  p.lede {{ max-width: 1500px; margin: .75rem auto 0; color: var(--dim); font-size: .8125rem; }}
  button {{ font: inherit; font-size: .8125rem; padding: .4rem .9rem; border-radius: 999px; border: 1px solid var(--line); background: var(--raise); color: var(--ink); cursor: pointer; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 1.25rem; max-width: 1500px; margin: 0 auto; }}
  figure {{ margin: 0; padding: 1rem 1rem 1.1rem; background: var(--raise); border: 1px solid var(--line); border-radius: 14px; }}
  figure svg {{ display: block; width: 100%; height: auto; color: var(--gold); }}
  svg [fill="#000"] {{ fill: currentColor; }}
  figcaption {{ margin-top: .75rem; }}
  figcaption b {{ display: block; font-weight: 600; font-size: .875rem; }}
  figcaption span {{ color: var(--dim); font-size: .8125rem; }}
  .whole {{ max-width: 1500px; margin: 0 auto; padding: 1rem; background: var(--raise); border: 1px solid var(--line); border-radius: 14px; }}
  .whole svg {{ display: block; width: 100%; height: auto; color: var(--gold); }}
</style>
</head>
<body>
<header>
  <h1>Rubbings, piece by piece</h1>
  <button type="button" onclick="document.documentElement.dataset.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'">Light / dark</button>
</header>
<p class="lede">Everything in the background, drawn sharp and at full strength. On the collection page it is blurred and far fainter.</p>

<h2>The coins</h2>
<div class="grid">{"".join(card(t, n, face(k)) for k, t, n in coins)}</div>

<h2>The devices</h2>
<div class="grid">{"".join(card(t, n, d, 40, .3) for t, n, d in devices)}</div>

{wholes}
</body>
</html>
"""
    Path(path).write_text(html)
    print("specimens", len(html))


def main() -> int:
    for v in range(SHEETS):
        svg = rubbings(variant=v)
        xml.dom.minidom.parseString(svg)      # a slip in a path is easier to find here than in a browser
        path = COINS / "css" / f"rubbings-{v + 1}.svg"
        path.write_text(svg)
        print(f"wrote {path.relative_to(COINS.parent)} ({len(svg) // 1024}KB): top is {', '.join(dealt(v)[:TOP])}")
    specimens(COINS / "tools" / "specimens.html")
    return 0


if __name__ == "__main__":
    sys.exit(main())
