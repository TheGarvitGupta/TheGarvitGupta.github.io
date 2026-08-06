# Photographing the coins

The website can only preserve what the camera captures. None of this needs
expensive equipment — consistency matters far more than gear.

---

## The setup

**Backdrop.** A plain, matte, evenly-lit surface. Black card or dark felt for
silver and cupro-nickel; light grey or white for copper and bronze. The
important thing is that the background is a *single flat tone* with no pattern,
no texture and no shadow gradient across it — that is what lets the software cut
the coin out cleanly and drop it onto the page with a real shadow.

Avoid: wood grain, tablecloths, patterned paper, anything shiny.

**Light.** Two soft light sources at roughly 45° from either side, or one light
plus a piece of white card bouncing it back. Side lighting is what makes the
relief readable — a coin lit flat-on from the front looks like a disc of paint.
Daylight from a window on an overcast day, with a card on the opposite side, is
genuinely excellent and free.

Avoid: direct flash, direct sun, overhead room lights alone.

**Camera.** Anything with a decent macro mode; a modern phone is fine. Fix the
camera in position — a tripod, or a stack of books — so every coin is shot from
the same distance and angle. Consistency across 250 coins is what makes the grid
look like a collection rather than a pile.

**Framing.** Fill the frame with the coin, leaving a small margin of backdrop
all the way round. Shoot straight down, square-on. Don't crop afterwards — the
software does that, and does it identically every time.

---

## Naming the files

Name each pair so the two sides can be matched up automatically:

```
0001-obv.jpg    0001-rev.jpg
0002-obv.jpg    0002-rev.jpg
```

`obv` is the obverse — the "front", usually the side with the ruler's head or
the state emblem. `rev` is the reverse — the side with the denomination.

These also work: `-obverse` / `-reverse`, `-front` / `-back`, `-head` / `-tail`.

If files aren't named this way, they're paired two at a time in alphabetical
order instead — which works fine if you always shoot front-then-back.

---

## Resolution and the originals

Shoot at your camera's full resolution. When a photo is added, the site
generates two smaller copies — a 2200px version for zooming into and a 600px
thumbnail — and those copies are what get committed. The originals are not
stored in the repository.

**Keep the originals somewhere safe** (iCloud, an external drive, wherever).
They're the archive. If the site is ever rebuilt at higher fidelity, or a coin
needs re-cropping, the master files are what make that possible.

---

## What the software does automatically

- Rotates the image the right way up, using the camera's orientation tag
- Strips GPS coordinates, so publishing a photo doesn't publish your address
- Finds the coin against the backdrop and cuts it out
- Crops square, centred on the coin, with a little breathing room
- Resizes and saves both versions as WebP

If a photo has a busy or uneven backdrop, the cut-out step is skipped
automatically and the picture is centre-cropped square with the backdrop left
in. It will still work — it just won't look as good in the grid as the rest.

---

## A practical order of work

1. Set up the backdrop and lights once, and leave them set up.
2. Photograph coins in batches — front, back, front, back.
3. Copy the batch onto the computer and name the files.
4. Run `./coins/start`, drop the whole batch onto the page at once.
5. Fill in what you know for each coin. Skip what you don't — a coin can be
   marked "not yet identified" and completed later.
6. Press **Publish**.
