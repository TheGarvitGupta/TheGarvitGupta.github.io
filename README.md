# garvitgupta.com

Personal portfolio site. Hosted on GitHub Pages at [garvitgupta.com](https://www.garvitgupta.com).

No build step — everything is plain HTML, CSS, and JS served directly by GitHub Pages.

---

## Structure

```
index.html              Main portfolio page
css/                    Stylesheets
  global.css            Core styles
  work.css              Work/projects section
  responsive.css        Media queries
  animations.css        Keyframe animations (replaces animate.css)
  darkmode.css          Dark-mode palette overrides
  particle-support.css  Particles.js canvas styles
js/                     JavaScript
  initiateVariables.js  Global variables used across scripts
  loaders.js            Scroll-triggered animations and section reveals
  loadUncover.js        Page load reveal + image prefetch
  darkmode.js           Dark-mode toggle and persistence
  gallery.js            Photo gallery (GitHub API + GLightbox)
  glightbox.js          Vendored GLightbox build — locally patched, see below
  spotify.js            Spotify now-playing widget
  strava.js             Strava YTD running bar
  weather.js            Local weather widget + icon swapping
  units.js              Unit formatting/conversion helpers
  contact-form.js       Contact form submission
  polylion-execute.js   GSAP polygon lion animation setup
  particle-support.js   Particles.js config
images/                 All production assets
  photographs/          Gallery originals
  photographs/thumbs/   Low-res versions loaded first
  weather/              Weather icons (each has a dark- twin)
favicon/                Favicon set (multiple sizes)
aberlift/               Standalone project page — AberLift carpooling app
status-tiles/           Standalone project page — Status Tiles Windows app
panorama-demo/          Standalone 360° VR demo (Marzipano viewer)
coins/                  Standalone sub-site — the coin collection (own README)
demo/                   Unlinked dev preview pages for widgets
tools/gallery.py        Local gallery manager (add/remove photos)
start                   Local dev: preview server + gallery manager
extras/                 Unused / archived assets and source files
FUTURE.md               Ideas not built yet
```

---

## Local development

```sh
./start
```

Serves the site at `http://localhost:8080` and opens the gallery manager
(`tools/gallery.py`) at `http://localhost:8765`. The gallery manager needs
`pip install Pillow` and `brew install ffmpeg`; it generates the thumbnail and
full-res versions for anything you add, and keeps the fallback list in
`js/gallery.js` in sync.

`demo/` holds standalone preview pages for individual widgets — not linked from
the site, just open them directly while iterating:

- `demo/strava-ui.html` — the Strava bar against the real site assets
- `demo/weather-icons.html` — every weather icon in light and dark

---

## Live integrations

### Spotify widget
Shows the currently playing track (or last played) in the top-right corner.

- **Worker:** `extras/cloudflare-worker/spotify-now-playing.js`
- **Deployed to:** Cloudflare Workers → `spotify-now-playing`
- **Called by:** `js/spotify.js`
- **Secrets required:**
  - `SPOTIFY_CLIENT_ID`
  - `SPOTIFY_CLIENT_SECRET`
  - `SPOTIFY_REFRESH_TOKEN` (scopes: `user-read-playback-state`, `user-read-recently-played`)

### Strava running bar
Shows a year-to-date running progress bar in the About section, linked to the Strava profile.

- **Worker:** `extras/cloudflare-worker/strava-ytd.js`
- **Deployed to:** Cloudflare Workers → `strava-ytd`, routed at `www.garvitgupta.com/api/strava*`
- **Called by:** `js/strava.js`
- **Secrets required:**
  - `STRAVA_CLIENT_ID`
  - `STRAVA_CLIENT_SECRET`
  - `STRAVA_REFRESH_TOKEN` (scope: `activity:read_all`)
  - `STRAVA_ATHLETE_ID`

To redeploy either worker: open the Cloudflare dashboard → Workers & Pages → select the worker → Edit code → paste the file → Deploy. Secrets are set under Settings → Variables and Secrets.

### Photo gallery
`js/gallery.js` fetches the file list from the GitHub Contents API at runtime to auto-discover photos in `images/photographs/`. Falls back to a hardcoded list if the API is unavailable. Photos are shuffled and paged 12 at a time with GLightbox for full-screen viewing.

Each photo has a small counterpart in `images/photographs/thumbs/` under the
same filename. Every thumbnail loads first, then the full-res versions swap in
behind them, so the grid fills immediately rather than popping in piecemeal.

To add photos: run `./start` and use the gallery manager, which resizes the
original, writes the matching thumbnail, and refreshes the fallback list. If you
drop files into `images/photographs/` by hand, generate a thumbnail of the same
name too — a photo with no thumbnail renders as an empty tile.

The `FALLBACK` array in `js/gallery.js` is only read when the GitHub API is
unreachable, so it rots silently. `sync_fallback()` in `tools/gallery.py`
rewrites it on every add and delete; don't hand-edit it.


### The GLightbox fork

`js/glightbox.js` is a vendored copy with one local change, marked `LOCAL PATCH`
in the source. **Replacing it with a stock build will silently undo this.**

Dragging a slide down to dismiss it was gated on the slide being a photo: the
touch handler resolves a `mediaImage` only when the media carries `gslide-image`,
and both the vertical follow and the close that ends it test that variable. The
gallery's videos are inline slides, so they had no `mediaImage`, would not follow
a downward drag, and could not be dismissed with one — every photo around them
could. The patch adds a `mediaDrag` alongside it, set to the `<img>` or, failing
that, the slide's `<video>`, and points the three drag checks at it. Pinch-zoom
still reads `mediaImage`, so it stays photo-only rather than trying to scale a
video.

The matching half is in CSS: the stock sheet sets `touch-action: auto` on video,
which hands vertical gestures to the browser before GLightbox sees them, so
`.gallery-lightbox-video` overrides it to `none` the way a photo already is.

---

## External dependencies (CDN, no local copies)

| Library | Used for |
|---|---|
| [GSAP TweenMax 1.17](https://cdnjs.cloudflare.com/ajax/libs/gsap/1.17.0/TweenMax.min.js) | Polygon lion (polylion) animation |
| [jQuery 1.11.3](https://code.jquery.com/jquery-1.11.3.min.js) | DOM helpers used by loaders.js and polylion |
| [Particles.js 2.0](https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js) | Particle background on home section |
| [GLightbox 3](https://cdn.jsdelivr.net/npm/glightbox@3/) | Full-screen photo lightbox (stylesheet only — the JS is vendored and patched) |
| [Google Fonts](https://fonts.googleapis.com) | Montserrat, Open Sans |

---

## Polylion animation

The polygon lion SVG is rendered in two layers:

1. **Gray placeholder** — `images/bg_poly/garvit-poly-gray.svg` loaded as a CSS background, visible immediately.
2. **Colored animated layer** — inline SVG in `index.html`, animated by GSAP when the section scrolls into view.

`js/polylion-execute.js` sorts polygons by Y-coordinate (bottom-up) and sets up the GSAP stagger variables. `js/loaders.js` fires the actual animation on scroll via `tmax_tl.staggerFromTo(...)`.

---

## Deployment

Push to `master` — GitHub Pages serves it automatically. The `CNAME` file sets the custom domain to `www.garvitgupta.com`.

No CI, no build pipeline. Changes are live within ~1 minute of push.

---

## extras/

Archived files kept for reference, not served by the site:

- `cloudflare-worker/` — worker source (canonical copy; the live workers are deployed from here)
- `css/separators/` — unused vendor CSS from an old section-separator experiment
- `js/stopScroll.js` — unused `disableScroll`/`enableScroll` utilities, never wired up
- `images/` — old mockup images, duplicate work screenshots, replaced social icon PNGs
- `images/weather/` — weather SVGs not in the icon set (`weather.svg`, `weather-sprite.svg`, `weather_sagittarius.svg`, `weather_sunset.svg`)
- `images/latte.svg` — superseded by `latte.png`, which is what the CSS loads
- `status-tiles/` — 2016 development screenshots, unreferenced app screenshots, and PNG twins of images the stylesheet loads as `.jpg`
