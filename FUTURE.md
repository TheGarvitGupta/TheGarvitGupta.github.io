# Future ideas

Stuff to add when there's time. Mostly Spotify-related polish for the
now-playing widget on the home page.

## Beat-pulsing album art

Visualizer that scales the album art slightly with each beat of the playing
song. Looks great when active, gracefully no-ops when paused.

**Data source:** `GET https://api.spotify.com/v1/audio-analysis/{track_id}`

Returns a `beats` array — each entry has `start` (seconds) and `duration`.
Combined with `progress_ms` from `/me/player`, the client knows exactly when
the next beat lands.

**Worker change:** when returning a playing track, also fetch its
`/audio-analysis` and forward an array of upcoming beat timestamps (or the
full beats array — it's typically ~10KB).

**Frontend sketch:**

```js
function startBeatPulse(beats, startProgressMs, fetchedAt) {
    const albumArt = document.querySelector(".spotify-album-art");
    function tick() {
        if (!state.playing) return;
        const elapsed = Date.now() - fetchedAt;
        const trackPosMs = startProgressMs + elapsed;
        // Find the nearest beat behind us
        const beat = beats.findLast(b => b.start * 1000 <= trackPosMs);
        if (beat) {
            const sinceBeat = trackPosMs - beat.start * 1000;
            // Decay scale from 1.06 -> 1.00 over ~150ms
            const t = Math.min(sinceBeat / 150, 1);
            const scale = 1.06 - 0.06 * t;
            albumArt.style.transform = `scale(${scale})`;
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}
```

CSS: add `transform-origin: center` and a `transition: transform 0.05s` on
`.spotify-album-art`. Only pulse when `state.playing` (cancel rAF on pause).

**Caveats:**
- Cache the per-track analysis aggressively (`Cache-Control: public,
  max-age=86400` for the analysis blob — it never changes for a track).
- Skip the worker fetch if the track ID hasn't changed since last poll.

## Top tracks / artists this month

A small "On repeat lately" block somewhere on the page (under the spotify
widget, or in the about section). Shows top 5 tracks or artists for the
last 4 weeks.

**Data source:**
- `GET /me/top/tracks?time_range=short_term&limit=5`
- `GET /me/top/artists?time_range=short_term&limit=5`

`short_term` ≈ last 4 weeks · `medium_term` ≈ last 6 months · `long_term`
≈ several years. (Yes, those are Spotify's exact defs.)

**Required scope:** `user-top-read` (need to re-mint refresh token with
this added to the existing scope list).

**Worker change:** add a separate path/handler so the same worker can
serve `/api/spotify/top-tracks` etc. Cache aggressively (`max-age=3600`,
1h — these don't update minute-by-minute).

**Frontend:** another HTML block, populate on load. No live ticking
needed.

## Audio features badge

Tiny inline badge next to the track name: *"124 BPM · high energy ·
happy"*. Subtle, but adds info-density without taking space.

**Data source:** `GET /audio-features/{track_id}` — public endpoint,
no scope. Returns `tempo`, `energy` (0-1), `valence` (0-1, happiness),
`danceability`, etc.

Mapping suggestions:
- `valence > 0.7` → "happy" · `0.4-0.7` → "neutral" · `< 0.4` → "moody"
- `energy > 0.7` → "high energy" · `< 0.4` → "chill"
- Round `tempo` to nearest int, append " BPM"

**Worker change:** when returning playing track, also fetch features in
parallel with `/me/player`. Cache features per-track-ID for 24h.

## Genre breakdown

"Top genres this month" as a horizontal bar or three labels with
percentages. Derived from top artists' `genres` arrays.

**Data source:** `GET /me/top/artists?time_range=short_term&limit=50`,
flatten the `genres` from each artist, count occurrences, show top 3.

Same scope (`user-top-read`) as top tracks/artists, so bundle with that
work.

## Album art collage

Small grid of the last ~9 album covers from `/me/player/recently-played`,
maybe in a section that's currently empty or under the photographs grid.
Pure CSS grid + `<img>` tags. Easy.

Cache for ~5min — the data doesn't change that often.
