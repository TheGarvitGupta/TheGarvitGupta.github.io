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
  particle-support.css  Particles.js canvas styles
js/                     JavaScript
  loaders.js            Scroll-triggered animations and section reveals
  gallery.js            Photo gallery (GitHub API + GLightbox)
  spotify.js            Spotify now-playing widget
  strava.js             Strava YTD running bar
  contact-form.js       Contact form submission
  loadUncover.js        Page load reveal + image prefetch
  initiateVariables.js  Global variables used across scripts
  polylion-execute.js   GSAP polygon lion animation setup
  particle-support.js   Particles.js config
  stopScroll.js         Scroll lock utility
images/                 All production assets
favicon/                Favicon set (multiple sizes)
aberlift/               Standalone project page — AberLift carpooling app
status-tiles/           Standalone project page — Status Tiles Windows app
panorama-demo/          Standalone 360° VR demo (Marzipano viewer)
extras/                 Unused / archived assets and source files
```

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

To add photos: drop `.jpeg`/`.png`/`.webp` files into `images/photographs/` and push. The gallery picks them up automatically.

---

## External dependencies (CDN, no local copies)

| Library | Used for |
|---|---|
| [GSAP TweenMax 1.17](https://cdnjs.cloudflare.com/ajax/libs/gsap/1.17.0/TweenMax.min.js) | Polygon lion (polylion) animation |
| [jQuery 1.11.3](https://code.jquery.com/jquery-1.11.3.min.js) | DOM helpers used by loaders.js and polylion |
| [Particles.js 2.0](https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js) | Particle background on home section |
| [GLightbox 3](https://cdn.jsdelivr.net/npm/glightbox@3/) | Full-screen photo lightbox |
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
