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
    states.html         The game's big moments (the seventeenth, an overthrow, the prize, the end of the game), each played live on a phone and a desktop side by side

  tests/                The tests: run.py runs them all (see Testing, below)
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
see that the solution packs, or run the tests, which ask much more of it; then
rebuild and deploy the worker.

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
- (anywhere, not only here) a player named **Swordfish**, in any capitals, plays off the record: the board is read and never sent a score;
- `?show=seventeen` (or `finished`, `coup3`, `coup2`, `coup1`, `prize`, `welcome`, `board`) plays one of the game's big moments, with a saved game of its own: `tools/states.html` shows them all;
- `?reel` has the game play itself (see `reel/`), with progress of its own;
- `Packman` in the console has more on it: `play(name)` opens a level, `level()` is the one open, `pieces()` its shapes.

Sound being off on localhost is not a fault: mute is saved per address.

---

## Testing

```sh
python3 packman/tests/run.py              # everything, in Chrome: about two and a half minutes
python3 packman/tests/run.py levels geom  # only those sets
python3 packman/tests/run.py game:hint    # only the tests of a set with "hint" in their names
python3 packman/tests/run.py --webkit     # in WebKit, the engine Safari is built on: about eight minutes
```

Run it before a push. It needs Python with Playwright driving a real browser
(`pip install playwright numpy pillow`, with Chrome installed; `playwright
install webkit` for the last). There is no build step and no Node. Nothing
runs by itself on a push yet.

A test is a function named `test_...` in a file `tests/test_*.py`, and passes
unless it raises; its name is the sentence it checks. `tests/harness.py` is
what they stand on: it serves the site, opens a page with the deal, the clock
and the saved game fixed, cuts off everything but this machine, and works the
game with a mouse as a player does.

### What there is

| Set | What it checks |
| --- | --- |
| `files` | Every file a page asks for is there. Scripts and styles have cache numbers, the same on every page, and a file changed since the last push has a new one. The built worker is what `build-worker.py` would write now. The scripts keep to ES5, with nothing left from debugging. |
| `levels` | Fifty levels in four chapters, each chapter together. Names all different; every level has its line and its hint; every box is convex. Every solution has a place for each shape, packs by the game's judge, and does not use up the hair of tolerance. Powers and shapes a level names exist: pinned powers, the chameleon, entangled sets of one kind, enough free shapes for the powers dealt. Entangled shapes can be packed on their own side of the line. |
| `geom` | `geom.js` on cases with known answers: the shapes' sizes, turning, how deep two shapes overlap and which way out, inside and outside a box, the judge's count, two boxes on one board, settling, putting a shape down, sweeping. Every level packed by a simple machine that drops each shape on its place, and every finished board pushed a hair out and shaken home: both but for Eleven and Eleven Bricks, which are listed as the two that want a player's care. |
| `sounds` | Every sound and every voice is made of notes that can be played, the browser's own audio takes them, and every personality and power has a voice of its own. |
| `game` | In the real page: all fifty levels open on a phone, a small phone and a desktop, with the right shapes and powers dealt, on the screen, outside the box, entangled ones on their own side. A shape goes where it is carried and turns by the buttons. A level packed by hand with the mouse is won and saved, and is still there when the page is opened again. The marks light for the shape that went in. An overlap does not count. Start over, eyesight, hints (the spot shown is one from the solution, and is counted), every sheet, choosing a level from the list, and the welcome for a new player. The big moments: the seventeenth has its party and no prize; the end of the game brings the cast in round the name, on the screen and clear of it, on a phone and a desktop, and comes once; and the prize is spoken of as being for the first three. |
| `powers` | Begun: Minefield deals a mine to every shape whatever the deal, and packs. |
| `twists` | Begun: Duality deals its two free squares on the line between the boxes, at four sizes of screen, with the entangled ones on their own sides and nothing overlapping. |
| `board` | Begun, with a stand-in leaderboard: the first three rows wear medals and the rest their numbers, a short or empty board is right, and the player's own row is still picked out among the medals. And with the game served as a player has it, under a name that is not this machine's: a win is sent once with what the board needs, wins saved before go up when the game opens, nothing is sent from localhost, and nothing at all is sent under the name Swordfish. A win that carries the player up into the first three, or up within them, says whom it overthrew; the first time in from outside wins the prize, once, and it is shown again on coming back until Done is pressed; no overthrow when the place does not change, is outside the three, or could not be known. |
| `pages` | "Meet the shapes" draws every personality and power, and they react. The reel plays through to its card, writes nothing to a player's saved game, and is not loaded for a player. The card on the site's front page draws. |

By hand:

| What it checks | Where | How |
| --- | --- | --- |
| A change that should not alter how anything looks has not | `tests/shots.py` | `take` a set of pictures before and after, then `diff` them. 28 cases: levels of every chapter, phone and desktop, light and dark, eyesight, powers, the sheets, a win, "Meet the shapes". Two sets from the same files are the same to the pixel. |
| Every level's own solution packs | `tools/check.html` | Opened in a browser: fifty lines, each `OK`. (The `levels` set does the same.) |

And in production the worker runs the judge on every score sent, so none reaches the board unless it packs.

### What is wanted

In the order it is to be built:

1. **The rest of the powers.** The mine goes off if held; Sticky glues;
   the sleeper cannot be turned in the box; the magnet pulls; the ghost shares
   a space; the puffer shoves; the chameleon changes and only counts in its own shape.
2. **The twists.** Entangled shapes turn together and geared ones against
   each other; none crosses the line; a level of two boxes is won only with both packed.
3. **The leaderboard.** With a stand-in board: a win sends the right score
   once; the standing is shown; a board that is down does not spoil a win;
   nothing is sent from this machine. And the worker itself, run in a browser
   against a stand-in database: it takes every level's solution, and turns
   away one that overlaps, one for a level that does not exist, and one sent
   twice.
4. **As a player on the real site sees it.** The tests run on localhost, where
   every level is open and no score is sent. The same page served under
   another name: levels open one by one as they are won. (The leaderboard's tests already serve it so.)
5. **Safari, all of it.** Two of the `pages` tests are skipped in WebKit: the
   harness loses the reel's frame there, and the front page does not finish loading with the clock held.

Wanted, and not planned in detail:

- **On every push**: the run above as a GitHub Action, so a break is caught before it is live.
- **Pictures kept in the repo** to compare against, in place of taking a set by hand. Lettering is drawn a little differently from one machine to the next, so it wants a tolerance.
- **The live site after a deploy**: the page loads, the worker answers and reports the right number of levels.
- **Real phones**: a short list to go through by hand on an iPhone and an Android phone before a big change goes out, since no browser on a desktop stands in for a thumb.
- **Reach**: every button has a name for a screen reader, the game can be played from the keyboard, and it holds still for those who ask for less motion.
- **Speed**: how much a first visit downloads, and that dragging on the busiest level keeps up.
