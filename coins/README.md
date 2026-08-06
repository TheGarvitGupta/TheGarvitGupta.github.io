# The Coin Collection

A showcase for a collection of coins from British India and the Republic of
India, photographed on both faces. Lives at `garvitgupta.com/coins/`.

Plain HTML, CSS and JavaScript with no build step and no dependencies, matching
the rest of the site.

---

## Code and database are separate — this matters

```
coins/
  index.html            The exhibit — the only page
  css/coins.css         Exhibit styles
  css/edit.css          Edit-mode styles (never loaded by the public site)
  js/coins.js           Catalogue, grid, filtering, routing
  js/viewer.js          Flip + deep-zoom viewer
  js/edit.js            Edit mode — inert unless the local server is running
  data/vocab.json       Mints, rulers, denominations, metals, field definitions
  tools/coins.py        The local server + image pipeline
  start                 Launcher

  collection/           ← THE DATABASE. Nothing else.
    coins.json          The catalogue
    images/full/        ~2200px, for zooming into
    images/thumbs/      600px squares, for the grid
```

Everything above `collection/` is **code**. Everything inside it is **data**.

The Publish and Discard buttons in the editing UI are scoped to
`coins/collection/` and can touch nothing else in the repository. This is not a
convention — it's enforced in `tools/coins.py`, and it exists because an earlier
version scoped those commands to `coins/` and deleted the site's own source the
first time Discard ran.

---

## One page, two modes

There is deliberately no separate admin interface. `js/edit.js` probes
`/api/ping` when the page loads:

- **Answered** — the local server is running, so editing controls appear.
- **Not answered** — GitHub Pages, so the identical files stay read-only.

What you edit is exactly what visitors see, because it's the same page.

---

## Adding coins

```sh
./coins/start
```

That serves the site at <http://localhost:8766/coins/> with editing switched on
and opens it. Then:

- **Drop photographs anywhere** on the page to add coins in bulk. Files named
  `…-obv` and `…-rev` are paired automatically — see `PHOTOGRAPHY.md`.
- **Click any value** in a coin's detail panel to change it.
- **+ Add detail** lists the fields that coin doesn't record yet. Fields left
  blank are simply not displayed, so a half-known coin still looks composed.
- **Mint mark** opens a picker showing the symbols as they appear on the coin
  (◆ ★ • ◈ L H KN), and names the mint for you.
- **Publish** commits and pushes. Nothing is live until then.

Requires Pillow — `./coins/start` installs it if it's missing.

---

## Previewing the public version

To see exactly what visitors see, serve the files without the API — edit mode
only wakes up when `/api/ping` answers, so a plain static server is the public
site:

```sh
python3 -m http.server 8080 --directory . --bind 127.0.0.1
```

Then open <http://localhost:8080/coins/>. No edit bar, no editing controls, and
`css/edit.css` is never requested. Both servers can run at once — 8080 for the
public view, 8766 for editing — which makes it easy to check a change looks
right before publishing it.

---

## Data model

`collection/coins.json` is a flat array. **`id` is the only required field.**
Everything else is optional, and absent fields are never rendered — no "Unknown",
no empty rows, and a missing year never sorts as year zero.

```jsonc
{
  "id": "0042",
  "status": "published",         // published | unidentified | draft
  "era": "british-india",
  "ruler": "george-vi",          // British India only
  "denomination": { "value": 1, "unit": "rupee" },
  "yearOnCoin": 1942,
  "mint": "bombay",
  "mintMark": "diamond",
  "metal": "silver",
  "fineness": 0.5,
  "weight_g": 11.66,
  "diameter_mm": 30.79,
  "edge": "reeded",
  "shape": "round",
  "dieAxis": "medallic",
  "mintage": 1000000,
  "km": "KM# 556",               // Krause catalogue reference
  "grade": "very-fine",
  "notes": "Free text — shown as the lede on the detail panel.",
  "images": { "obv": "0042-obv.webp", "rev": "0042-rev.webp" },
  "updated": "2026-08-05"
}
```

`data/vocab.json` supplies every dropdown and label, and defines the spec-table
order. It's data, not code — when a coin turns up that doesn't fit, add a row.

### Mint marks

| Glyph | Republic India | British India |
|:-----:|----------------|---------------|
| —     | Kolkata        | Calcutta      |
| ◆     | Mumbai         | Bombay        |
| ★     | Hyderabad      | Madras (to 1869) |
| •     | Noida          | Pretoria      |
| ◈ ◇   | Hyderabad      | —             |
| B / M | — / Mumbai     | Bombay        |
| L     | —              | Lahore (from 1943) |
| H     | Birmingham     | Birmingham (Heaton) |
| KN    | —              | King's Norton |

---

## Images

WebP with an alpha channel, not JPEG. The pipeline cuts each coin out of its
backdrop, which means scalloped, square and holed coins aren't clipped the way a
circular CSS mask would clip them, and every coin sits on the page with a real
drop shadow.

Detection is deliberately conservative: if the backdrop isn't uniform, or the
result covers almost none or almost all of the frame, the cut-out is skipped and
the photo is centre-cropped square with its background intact.

Roughly 300KB per full-size image, so ~150MB for a 250-coin collection —
comfortably inside GitHub Pages' limits. Both dimensions and both quality
settings are constants at the top of `tools/coins.py`.

---

## Deployment

Development happens on the `coins` branch. GitHub Pages serves `master`, so
merge `coins` into `master` to take it live.

---

## Keyboard

| Key | |
|---|---|
| `←` `→` | previous / next coin |
| `F` | turn the coin over |
| `+` `−` | zoom |
| `0` | fit |
| `Esc` | close |

Double-click toggles between fit and 250%. Scroll or pinch to zoom, drag to pan.
With `prefers-reduced-motion` set, the flip becomes a cross-fade.
