# Packman

A packing game: fit every shape into the box with nothing overlapping. Lives at
`garvitgupta.com/packman/`. Fifty levels in four chapters, with a leaderboard.

Plain HTML, CSS and JavaScript with no build step and no dependencies, matching
the rest of the site. The scripts are written in the ES5 style throughout.

---

## What is where

```
packman/
  index.html            The game's page: markup only
  packman.css           Everything on that page but how a shape is painted
  faces.css             How a shape and its face are painted; shared with personalities.html
  geom.js               Geometry: overlap, walls, settling, the judge (PackmanGeom). Also built into the worker
  levels.js             The fifty levels and one solution to each (PackmanLevels). Also built into the worker
  faces.js              The personalities and the powers, and how each is drawn (PackmanFaces, PackmanPowers, PackmanPiece)
  sounds.js             Every sound, as notes (PackmanSounds)
  game.js               The game itself
  personalities.html    "Meet the shapes": every personality and power, linked from the welcome
  og-image.png          Link preview
  apple-touch-icon.png  Home-screen icon

  reel/                 The game playing itself, to be filmed (only on this machine)
    index.html          Shows it at the size of a phone: /packman/reel/
    reel.js             Works the game: loaded by game.js when the address says ?reel
    film.py             Takes a picture every sixtieth of a second and lists the notes played
    sound.py            Makes the soundtrack from that list

  tools/
    build-worker.py     Builds the leaderboard's worker (see below)
    pack.py             Searches for the tightest box a set of shapes will pack into, to make a level from
    check.html          Puts every level's own solution through the judge

  tests/                See Testing, below
```

Outside this folder:

```
extras/cloudflare-worker/packman-scores.src.js   The leaderboard's worker, as written
extras/cloudflare-worker/packman-scores.js       The same with geom.js and levels.js built in: this is what is deployed
js/packman-tile.js                               The Packman card on the main page, which packs a level by itself
```

---

## Changing things

**Cache numbers.** Every script and stylesheet is asked for with `?v=`. When a
file changes, raise its number wherever it is asked for (`index.html`, and
`personalities.html` if it uses the file), or returning players keep the old
copy. The numbers only have to change; by habit a changed file takes the next
number after the highest in use.

**The leaderboard.** The worker judges every score with the game's own
geometry and levels, so a change to `geom.js` or `levels.js` has to reach it:

```sh
python3 packman/tools/build-worker.py     # writes extras/cloudflare-worker/packman-scores.js
```

Then paste that file into the worker `packman-scores` in the Cloudflare
dashboard and deploy. Until that is done, scores for a changed level are turned
away. The steps for setting the worker up from nothing are at the top of the
built file.

**A new level.** Add it to `levels.js` with a solution; `tools/pack.py` finds
tight ones. Progress is saved by the level's name, so levels can be reordered
but a rename loses players' progress on that level. Open `tools/check.html` to
see that the solution packs, then rebuild and deploy the worker.

---

## On this machine

Served from `localhost` (`./start` at the root of the site, or
`python3 -m http.server` there), the game behaves differently in a few ways,
all for trying things out:

- every level is open;
- scores are read but never sent;
- two buttons stand at the bottom left: **Solver**, which packs the level, and **Hard reset**;
- `?powers=mine,ghost` deals those powers in place of a random pick;
- `?scores=<address>` uses a stand-in leaderboard;
- `?reel` has the game play itself (see `reel/`), with progress of its own.

Sound being off on localhost is not a fault: mute is saved per address.

---

## Testing

Everything here runs on this machine with Python and Playwright driving a real
browser (`pip install playwright numpy pillow`, with Chrome installed). There
is no build step and no Node. Nothing runs by itself on a push yet.

### What there is

| What it checks | Where | How it is run |
| --- | --- | --- |
| Every level's own solution packs, by the game's judge | `tools/check.html` | Opened in a browser: fifty lines, each `OK` |
| A change that should not alter how anything looks has not | `tests/shots.py` | By hand: `take` a set of pictures before and after, then `diff` them. 28 cases: levels of every chapter, phone and desktop, light and dark, eyesight, powers, the sheets, a win, "Meet the shapes" |
| No score reaches the board unless it packs | the worker | In production: it runs the judge on every score sent |

`tests/harness.py` is what the tests stand on: it serves the site, opens a page
with the deal, the clock and the saved game fixed, and cuts off everything but
this machine. Two sets of pictures from the same files are the same to the
pixel.

### What is wanted

In the order it is being built. Each is to be a part of one command,
`python3 packman/tests/run.py`, that says what passed and what failed.

1. **The files hang together.** Every file a page asks for exists; the cache
   numbers agree between pages; a file changed since the last push has had its
   number raised; the built worker is what `build-worker.py` would write now;
   the scripts keep to ES5.
2. **The levels are sound.** Names are all different; each chapter has the
   number of levels it says; a solution has a place for every shape and packs
   with room to spare; what a level names (a pinned power, entangled sets, the
   line in Duality) points at shapes that exist and are of one kind; a solution
   to a level of entangled shapes can be reached with them turning together,
   each on its own side.
3. **The geometry is right.** `geom.js` by itself, on cases with known
   answers: what overlaps and by how much, what is inside a box and what is
   over a wall, two boxes on one board, settling and the magnet, and that a
   packing nudged a hair still counts.
4. **The game plays.** In a real browser: every level opens without an error,
   on a phone and a desktop; a shape can be picked up, moved and turned; a
   level packed by hand is won, saved, and opens the next; the marks at the top
   right light for the shape that went in; start over, hints and eyesight do
   what they say; progress survives a reload.
5. **Each power does what it says.** The mine goes off if held; Sticky glues;
   the sleeper cannot be turned in the box; the magnet pulls; the ghost shares
   a space; the puffer shoves; the chameleon changes. And the twists:
   entangled shapes turn together, geared ones against each other, and none
   crosses the line.
6. **The leaderboard.** With a stand-in board: a win sends the right score
   once; the standing is shown; a board that is down does not spoil a win;
   nothing is sent from this machine. And the worker itself, run in a browser
   against a stand-in database: it takes every level's solution, and turns
   away one that overlaps, one for a level that does not exist, and one sent
   twice.
7. **The other pages.** "Meet the shapes" draws every personality and power;
   the reel plays through to its card; the card on the main page packs.
8. **Safari.** The same run in WebKit, which Playwright has: most of the
   game's odd bugs have been Safari's.
9. **Every sound plays** without an error, against a stand-in for the browser's audio.

Wanted, and not planned in detail:

- **On every push**: the run above as a GitHub Action, so a break is caught before it is live.
- **Pictures kept in the repo** to compare against, in place of taking a set by hand. Lettering is drawn a little differently from one machine to the next, so it wants a tolerance.
- **The live site after a deploy**: the page loads, the worker answers and reports the right number of levels.
- **Real phones**: a short list to go through by hand on an iPhone and an Android phone before a big change goes out, since no browser on a desktop stands in for a thumb.
- **Reach**: every button has a name for a screen reader, the game can be played from the keyboard, and it holds still for those who ask for less motion.
- **Speed**: how much a first visit downloads, and that dragging on the busiest level keeps up.
