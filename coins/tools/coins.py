#!/usr/bin/env python3
"""
Coin collection editor — run with: python3 tools/coins.py

Serves the whole repo statically AND mounts a small JSON API at /api/*, then
opens http://localhost:8766/coins/ — the real site, with editing switched on.

There is deliberately no separate admin UI. coins/js/edit.js probes /api/ping;
when it answers, the exhibit grows edit affordances in place. Served from
GitHub Pages the probe fails and the identical files stay read-only.

Requirements: pip install Pillow
"""

import http.server
import json
import os
import re
import socketserver
import statistics
import subprocess
import sys
import threading
import urllib.parse
import webbrowser
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────
#
# The split here matters. coins/ holds the site's *code* — HTML, CSS, JS, the
# vocabulary. coins/collection/ holds the *database* — the catalogue and the
# photographs. Publish and Discard operate on the collection folder and nothing
# else, so no button in the UI can reach the source code that draws the page.
REPO_ROOT   = Path(__file__).parent.parent.parent
COINS_DIR   = REPO_ROOT / "coins"
COLLECTION  = COINS_DIR / "collection"
DATA_FILE   = COLLECTION / "coins.json"
FULL_DIR    = COLLECTION / "images" / "full"
THUMB_DIR   = COLLECTION / "images" / "thumbs"
PORT        = 8766         # 8765 belongs to tools/gallery.py

# The only path git is ever asked to touch on behalf of the UI.
COLLECTION_REL = "coins/collection/"

# The branch GitHub Pages actually serves. Work can happen on any branch, but
# only this one goes live, and the UI says so rather than promising otherwise.
PUBLISH_BRANCH = "master"

# ── Processing settings ──────────────────────────────────────────────────────
# WebP with alpha rather than JPEG: the coin is cut out of its backdrop, so
# scalloped and square coins aren't clipped by a circular mask, and the coins
# sit on the page with a real drop shadow. Also roughly a third smaller.
IMG_FULL_W   = 2200
IMG_THUMB_W  = 600
IMG_FULL_Q   = 82
IMG_THUMB_Q  = 78

CUTOUT_THRESHOLD = 26   # luminance distance from the backdrop that counts as coin
CUTOUT_PAD       = 0.06 # breathing room around the coin, as a fraction of its size

IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".heic", ".bmp"}

_lock = threading.Lock()


# ── Catalogue I/O ────────────────────────────────────────────────────────────

def load_coins():
    if not DATA_FILE.exists():
        return []
    try:
        data = json.loads(DATA_FILE.read_text() or "[]")
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def save_coins(coins):
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(coins, indent=2, ensure_ascii=False) + "\n")


_high_water = None   # highest id ever issued; scanned once per run, then held


def _ids_in(text):
    return {int(m) for m in re.findall(r'"id"\s*:\s*"(\d+)"', text)} | \
           {int(m) for m in re.findall(r'/(\d+)-(?:obv|rev)\.\w+', text)}


def _scan_high_water():
    """
    The highest coin id that has ever existed, including ones since deleted.

    Reads the whole recorded history rather than just the current catalogue.
    Ids must never be reused: an id is the identity a coin is known by, it names
    that coin's photographs, and — once there is a history view — it is the
    thread tying a coin's past to its present. Handing 0003 to a new coin after
    the old 0003 was deleted would splice two unrelated coins into one story.

    Restoring an earlier version makes this essential rather than merely tidy:
    after going back, the current catalogue no longer knows about the ids that
    came later, but git still does, and those ids must stay retired.
    """
    ids = set()
    try:
        ids |= _ids_in(git("log", "--all", "-p", "--", COLLECTION_REL + "coins.json").stdout)
        ids |= _ids_in(git("log", "--all", "--diff-filter=A", "--name-only",
                           "--format=", "--", COLLECTION_REL + "images").stdout)
    except Exception:
        pass  # not a git repo, or no history yet — current catalogue is enough
    return max(ids) if ids else 0


def next_id(coins):
    global _high_water
    if _high_water is None:
        _high_water = _scan_high_water()

    for c in coins:
        try:
            _high_water = max(_high_water, int(str(c.get("id", "0"))))
        except ValueError:
            pass

    _high_water += 1
    return f"{_high_water:04d}"


def today():
    import datetime
    return datetime.date.today().isoformat()


# ── Image processing ─────────────────────────────────────────────────────────
# Adapted from tools/gallery.py:85 — same EXIF-orientation handling and the
# same save_resized() shape, so the two files read as siblings. What's new here
# is cutting the coin out of its backdrop.

ORIENTATION_ROTATIONS = None  # filled on first use, needs PIL imported


def _open_upright(src: Path):
    """Open an image with EXIF rotation baked in and GPS stripped."""
    from PIL import Image
    global ORIENTATION_ROTATIONS
    if ORIENTATION_ROTATIONS is None:
        ORIENTATION_ROTATIONS = {
            2: Image.FLIP_LEFT_RIGHT, 3: Image.ROTATE_180,
            4: Image.FLIP_TOP_BOTTOM, 5: Image.TRANSPOSE,
            6: Image.ROTATE_270,      7: Image.TRANSVERSE,
            8: Image.ROTATE_90,
        }

    img = Image.open(src)
    img.load()  # force full decode so EXIF is available

    try:
        raw = img._getexif() or {}
        orientation = raw.get(274, 1)  # 274 = Orientation
        if orientation in ORIENTATION_ROTATIONS:
            img = img.transpose(ORIENTATION_ROTATIONS[orientation])
    except Exception:
        pass

    # Preserve an existing alpha channel — a photo that arrives already cut out
    # must not be flattened here, or the transparency would be thrown away and
    # then guessed at again from whatever background the flattening left behind.
    if img.mode == "P":
        img = img.convert("RGBA")
    elif img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")
    return img


def _coin_mask(img):
    """
    Binary mask of the coin against a plain backdrop: 255 = coin, 0 = backdrop.

    Estimates the backdrop from the border pixels, thresholds on distance from
    it, then flood-fills inward from the corners so that dark details *inside*
    the coin are kept rather than punched through.

    Returns None when the result looks implausible — a backdrop the same tone
    as the coin, say — so the caller can fall back to keeping the rectangle.
    """
    from PIL import Image, ImageChops, ImageDraw, ImageFilter

    gray = img.convert("L")
    w, h = gray.size

    step_x = max(1, w // 80)
    step_y = max(1, h // 80)
    border = ([gray.getpixel((x, 0)) for x in range(0, w, step_x)] +
              [gray.getpixel((x, h - 1)) for x in range(0, w, step_x)] +
              [gray.getpixel((0, y)) for y in range(0, h, step_y)] +
              [gray.getpixel((w - 1, y)) for y in range(0, h, step_y)])
    backdrop = int(statistics.median(border))

    # If the border isn't uniform this isn't a plain backdrop; don't guess.
    if statistics.pstdev(border) > 26:
        return None

    flat = Image.new("L", gray.size, backdrop)
    diff = ImageChops.difference(gray, flat)
    mask = diff.point(lambda p: 255 if p > CUTOUT_THRESHOLD else 0)
    mask = mask.filter(ImageFilter.MedianFilter(5))  # drop speckle and dust

    # Everything reachable from a corner is genuinely outside the coin.
    probe = mask.copy()
    for seed in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        if probe.getpixel(seed) == 0:
            ImageDraw.floodfill(probe, seed, 128)
    holes = probe.point(lambda p: 255 if p == 0 else 0)
    mask = ImageChops.lighter(mask, holes)

    coverage = sum(mask.histogram()[128:]) / float(w * h)
    if coverage < 0.02 or coverage > 0.96:
        return None  # found nothing, or found the whole frame

    return mask


def process_coin_image(src: Path, coin_id: str, face: str, cutout: bool = True):
    """
    Turn one uploaded photo into the two files the site needs.

    Writes coins/collection/images/full/<id>-<face>.webp (~2200px) and
    coins/collection/images/thumbs/<id>-<face>.webp (600px). Returns the filename.
    """
    from PIL import Image, ImageFilter

    img = _open_upright(src)

    # An image that already carries transparency has been cut out by someone who
    # could see it — trust that over anything guessed from a backdrop. Only fall
    # back to detection when the source is fully opaque.
    supplied_alpha = None
    if img.mode == "RGBA":
        alpha = img.getchannel("A")
        if alpha.getextrema()[0] < 250:      # genuinely transparent pixels present
            supplied_alpha = alpha
        img = img.convert("RGB")

    if supplied_alpha is not None:
        mask = supplied_alpha
    else:
        mask = _coin_mask(img) if cutout else None

    bbox = mask.getbbox() if mask is not None else None

    if bbox:
        # Square crop centred on the coin, with a little air around it.
        bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
        side = int(max(bw, bh) * (1 + CUTOUT_PAD * 2))
        cx, cy = (bbox[0] + bbox[2]) // 2, (bbox[1] + bbox[3]) // 2
        box = (cx - side // 2, cy - side // 2, cx + side // 2, cy + side // 2)
        img = img.crop(box)
        mask = mask.crop(box)
    else:
        # No usable mask: centre-crop to a square and keep the backdrop.
        w, h = img.size
        side = min(w, h)
        left, top = (w - side) // 2, (h - side) // 2
        img = img.crop((left, top, left + side, top + side))

    if mask is not None:
        # Feather only a mask we derived ourselves — a threshold leaves a hard,
        # aliased edge. A supplied alpha is already clean, and blurring it would
        # just eat into the coin.
        if supplied_alpha is None:
            mask = mask.filter(ImageFilter.GaussianBlur(1.2))
        img = img.convert("RGBA")
        img.putalpha(mask)

    filename = f"{coin_id}-{face}.webp"

    def save_resized(target: Path, size: int, quality: int):
        target.parent.mkdir(parents=True, exist_ok=True)
        out = img
        if img.width > size:
            out = img.resize((size, size), Image.LANCZOS)
        out.save(str(target), "WEBP", quality=quality, method=6)

    save_resized(FULL_DIR / filename, IMG_FULL_W, IMG_FULL_Q)
    save_resized(THUMB_DIR / filename, IMG_THUMB_W, IMG_THUMB_Q)
    return filename


# ── Git ──────────────────────────────────────────────────────────────────────
# Same shape as tools/gallery.py:693 — status for the pending count, then
# add/commit/push, with a discard escape hatch.
#
# Every git call below is scoped to COLLECTION_REL. That scoping is the whole
# safety model: the buttons in the page can add, revert or delete coins and
# photographs, and cannot reach index.html, the stylesheets, the scripts or
# anything else in the repository.

TRACKED = [COLLECTION_REL]


def git(*args, **kw):
    return subprocess.run(["git", *args], cwd=str(REPO_ROOT),
                          capture_output=True, text=True, **kw)


def pending_changes():
    # -uall so an untracked collection lists every file rather than collapsing
    # to a single "?? coins/collection/" line — otherwise the count reads 1 no
    # matter how many coins have been added, which is when it matters most.
    out = git("status", "--porcelain", "-uall", *TRACKED).stdout
    added = modified = deleted = 0
    for line in out.splitlines():
        if len(line) < 4:
            continue
        status, path = line[:2].strip(), line[3:].strip()
        if "/thumbs/" in path:
            continue  # counted via the full-size file
        if status in ("A", "??"):
            added += 1
        elif status == "M":
            modified += 1
        elif status == "D":
            deleted += 1
    branch = git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
    return {"added": added, "modified": modified, "deleted": deleted,
            "total": added + modified + deleted,
            "branch": branch,
            "isLive": branch == PUBLISH_BRANCH,
            "publishBranch": PUBLISH_BRANCH}


# ── History ──────────────────────────────────────────────────────────────────
# Every commit that touched the collection is one step in the collection's life.
# Nothing extra is recorded to make this work: git already holds a snapshot of
# the catalogue and every photograph at every point, so the whole feature is a
# matter of reading what is there and translating it into something legible.
#
# Paths are listed oldest-last because the collection moved partway through the
# project; a step from before the move still has to resolve.

CATALOGUE_PATHS = ["coins/collection/coins.json", "coins/data/coins.json"]
THUMB_DIRS      = ["coins/collection/images/thumbs", "coins/images/thumbs"]

# Fields that say nothing about the coin itself and would only add noise.
IGNORED_FIELDS = {"updated"}

_cat_cache, _tree_cache = {}, {}

# Set when a restore is staged, so the commit that saves it says so rather than
# being described as a pile of additions and deletions.
_pending_restore = None


# The uncommitted working tree, addressed like any other version so that the
# same diff machinery describes work in progress. Everything that has not been
# saved yet is simply the newest step.
WORKING = "WORKING"


def catalogue_at(sha):
    """The whole catalogue as it stood at one commit, or right now."""
    if sha == WORKING:
        return load_coins()
    if sha in _cat_cache:
        return _cat_cache[sha]
    out = []
    for p in CATALOGUE_PATHS:
        r = git("show", f"{sha}:{p}")
        if r.returncode == 0:
            try:
                out = json.loads(r.stdout or "[]")
            except json.JSONDecodeError:
                out = []
            break
    _cat_cache[sha] = out
    return out


def thumbs_at(sha):
    """
    { '0003-obv': blob_id } for every thumbnail present at one commit.

    For the working tree there are no blobs yet, so the files are referenced by
    path with a "live:" marker and the page loads them the ordinary way. Hashing
    them into the object store just to display them would leave litter behind.
    """
    if sha == WORKING:
        # Real blob hashes, computed but not written, so they compare correctly
        # against the ids in a commit. Marking these some other way would make
        # every photograph look replaced on every unsaved step.
        files = sorted(f for f in THUMB_DIR.iterdir()
                       if f.suffix.lower() in (".webp", ".jpg", ".png")) \
                if THUMB_DIR.exists() else []
        if not files:
            return {}
        r = git("hash-object", *[str(f) for f in files])
        hashes = r.stdout.split()
        return {f.stem: h for f, h in zip(files, hashes)}
    if sha in _tree_cache:
        return _tree_cache[sha]
    found = {}
    r = git("ls-tree", "-r", sha, "--", *THUMB_DIRS)
    for line in r.stdout.splitlines():
        try:
            meta, path = line.split("\t", 1)
            blob = meta.split()[2]
        except (ValueError, IndexError):
            continue
        found[Path(path).stem] = blob
    _tree_cache[sha] = found
    return found


def working_coin_changes():
    """
    Which coins differ from the last save, in the terms the interface uses.

    Not the same question as "is the file modified". Setting a field back to the
    value it was saved with still bumps `updated`, so git reports a changed file
    while nothing about any coin differs — which showed up as a bar saying
    "unsaved changes" beside a timeline saying "no change to the collection".
    Both were right about different things; the interface should only ever speak
    about coins.
    """
    head = git("rev-parse", "HEAD").stdout.strip()
    if not head:
        return []
    d = diff_versions(head, WORKING)
    return [x["id"] for x in (d["added"] + d["changed"] + d["removed"])]


def working_thumb_name(stem):
    """The thumbnail file on disk for a coin face, whatever its extension."""
    if THUMB_DIR.exists():
        for f in THUMB_DIR.iterdir():
            if f.stem == stem:
                return f.name
    return stem + ".webp"


def _same(a, b):
    return json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)


def diff_versions(old_sha, new_sha):
    """
    What changed between two points, described in terms of coins rather than
    files: which coins arrived, which left, and for the rest, which fields moved
    and which photographs were replaced.
    """
    old_list, new_list = catalogue_at(old_sha), catalogue_at(new_sha)
    old = {str(c.get("id")): c for c in old_list}
    new = {str(c.get("id")): c for c in new_list}
    old_thumbs, new_thumbs = thumbs_at(old_sha), thumbs_at(new_sha)

    def shot(cid, coin, thumbs):
        return {face: thumbs.get(f"{cid}-{face}") for face in ("obv", "rev")}

    added, removed, changed = [], [], []

    for cid in new:
        if cid not in old:
            added.append({"id": cid, "coin": new[cid], "thumbs": shot(cid, new[cid], new_thumbs)})

    for cid in old:
        if cid not in new:
            removed.append({"id": cid, "coin": old[cid], "thumbs": shot(cid, old[cid], old_thumbs)})

    for cid in set(old) & set(new):
        fields = []
        for key in sorted(set(old[cid]) | set(new[cid])):
            if key in IGNORED_FIELDS or key == "images":
                continue
            a, b = old[cid].get(key), new[cid].get(key)
            if not _same(a, b):
                fields.append({"key": key, "from": a, "to": b})

        photos = []
        for face in ("obv", "rev"):
            a = old_thumbs.get(f"{cid}-{face}")
            b = new_thumbs.get(f"{cid}-{face}")
            if a != b:
                # An uncommitted blob is not in the object store, so point the
                # page at the file itself for the newer side.
                if b and new_sha == WORKING:
                    b = "live:" + working_thumb_name(f"{cid}-{face}")
                photos.append({"face": face, "from": a, "to": b})

        if fields or photos:
            changed.append({"id": cid, "coin": new[cid], "fields": fields, "photos": photos,
                            "thumbs": shot(cid, new[cid], new_thumbs)})

    key = lambda x: int(x["id"]) if x["id"].isdigit() else 0
    return {"added": sorted(added, key=key),
            "removed": sorted(removed, key=key),
            "changed": sorted(changed, key=key)}


def history_steps():
    """
    Every commit that touched the collection, newest first — preceded by the
    work in progress, if there is any. Unsaved edits are part of the story of
    the collection; leaving them out makes the timeline stop short of the
    present and quietly disagree with what is on screen.
    """
    fmt = "%H%x1f%aI%x1f%an%x1f%s"
    r = git("log", f"--format={fmt}", "--", *CATALOGUE_PATHS,
            "coins/collection/images", "coins/images")
    steps = []
    for line in r.stdout.splitlines():
        parts = line.split("\x1f")
        if len(parts) < 4:
            continue
        steps.append({"sha": parts[0], "date": parts[1], "author": parts[2], "subject": parts[3]})

    # Three states, and the difference between the last two matters: saved work
    # is safe but private, and only what has reached the published branch is
    # actually on the web. Reachability from origin/PUBLISH_BRANCH is the real
    # test — a local merge that has not been pushed is not live.
    reachable = set()
    if git("rev-parse", "--verify", "-q", f"origin/{PUBLISH_BRANCH}").stdout.strip():
        reachable = set(git("rev-list", f"origin/{PUBLISH_BRANCH}").stdout.split())
    for st in steps:
        st["state"] = "live" if st["sha"] in reachable else "saved"

    if working_coin_changes():
        import datetime
        steps.insert(0, {
            "sha": WORKING,
            "date": datetime.datetime.now().astimezone().isoformat(),
            "author": "", "subject": "Unsaved changes",
            "unsaved": True, "state": "unsaved",
        })
    return steps


def step_parent(sha):
    if sha == WORKING:
        return git("rev-parse", "HEAD").stdout.strip() or None
    r = git("rev-parse", f"{sha}^")
    return r.stdout.strip() if r.returncode == 0 else None


def current_branch():
    return git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip()


def golive_preview():
    """
    What taking the site live would actually publish.

    Work happens on a branch; GitHub Pages serves PUBLISH_BRANCH. This reports
    the gap between the two in the terms the rest of the interface uses — steps
    and coins — so the confirmation can say what is about to become public
    rather than asking someone to trust a branch name.
    """
    branch = current_branch()
    live = git("rev-parse", "--verify", "-q", PUBLISH_BRANCH).stdout.strip()
    here = git("rev-parse", "HEAD").stdout.strip()

    unsaved_ids = working_coin_changes()
    dirty = bool(unsaved_ids)
    # Only files outside the collection: what the collection is doing is already
    # reported by `dirty`, and a stray timestamp there would otherwise block
    # publishing with a message about files somewhere else entirely.
    unclean = any(not line[3:].strip().startswith(COLLECTION_REL)
                  for line in git("status", "--porcelain").stdout.splitlines()
                  if line.strip())

    if branch == PUBLISH_BRANCH:
        remote = git("rev-parse", "--verify", "-q", f"origin/{PUBLISH_BRANCH}").stdout.strip()
        rng = f"origin/{PUBLISH_BRANCH}..{PUBLISH_BRANCH}" if remote else PUBLISH_BRANCH
        base = remote
    else:
        rng = f"{PUBLISH_BRANCH}..{branch}"
        base = live

    log = git("log", "--format=%H%x1f%aI%x1f%s", rng, "--", *TRACKED).stdout
    steps = [dict(zip(("sha", "date", "subject"), l.split("\x1f")))
             for l in log.splitlines() if l.count("\x1f") == 2]

    summary = {"added": 0, "removed": 0, "changed": 0}
    if base and base != here:
        d = diff_versions(base, here)
        summary = {"added": len(d["added"]), "removed": len(d["removed"]),
                   "changed": len(d["changed"])}

    ahead = int(git("rev-list", "--count", rng).stdout.strip() or "0")
    collection_ahead = len(steps)
    site_ahead = max(0, ahead - collection_ahead)

    # Two different things travel together and were being reported as one
    # number. Changes to the collection are what the panel is about; changes to
    # the site's own code ride along in the same merge. Counting them together
    # produced "10 changes" for three coin edits that had since been undone.
    #
    # And a run of steps can net out to nothing: edit a coin, restore it, and
    # the collection is where it started even though two steps happened. What
    # matters here is the difference from what is live, not how it was reached.
    coins_unchanged = (summary["added"] == 0 and summary["removed"] == 0
                       and summary["changed"] == 0)

    # Coins, not files. Editing three coins' details touches one file, and
    # replacing one photograph touches two — neither number means anything to
    # someone cataloguing a collection.
    unsaved_coins = len(unsaved_ids)

    return {"branch": branch, "publishBranch": PUBLISH_BRANCH,
            "isLive": branch == PUBLISH_BRANCH,
            "pending": unsaved_coins,
            "pendingCoins": unsaved_coins,
            "pendingIds": unsaved_ids,
            "commits": ahead,
            "collectionSteps": collection_ahead,
            "siteChanges": site_ahead,
            "coinsUnchanged": coins_unchanged,
            "steps": steps, "summary": summary,
            "hasUnsaved": dirty, "workingTreeDirty": unclean,
            "upToDate": ahead == 0}


# ── HTTP ─────────────────────────────────────────────────────────────────────

class Handler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(REPO_ROOT), **kwargs)

    def log_message(self, fmt, *args):
        pass  # silence the access log

    # ── helpers ──

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        if not length:
            return {}
        return json.loads(self.rfile.read(length))

    def end_headers(self):
        # Nothing this server hands out should ever be cached. The catalogue is
        # rewritten constantly, and caching the scripts means an edit to the
        # site is invisible until someone thinks to hard-reload — which is
        # exactly the kind of puzzle nobody should have to solve. The /api/
        # handlers set their own headers, including the blob endpoint, whose
        # content is addressed by hash and so is safe to cache forever.
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    # ── routing ──

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/ping":
            return self.send_json({"ok": True, "root": str(REPO_ROOT)})
        if path == "/api/pending":
            return self.send_json(pending_changes())

        if path == "/api/golive/preview":
            return self.send_json(golive_preview())

        if path == "/api/history":
            steps = history_steps()
            # Summarise each step against the one before it, so the rail can
            # say "six coins added" without the panel being opened.
            for i, s in enumerate(steps):
                older = steps[i + 1]["sha"] if i + 1 < len(steps) else step_parent(s["sha"])
                if older:
                    d = diff_versions(older, s["sha"])
                    s["summary"] = {"added": len(d["added"]), "removed": len(d["removed"]),
                                    "changed": len(d["changed"])}
                    s["thumbs"] = [x["thumbs"] for x in
                                   (d["added"] + d["changed"] + d["removed"])[:8]]
                else:
                    cat = catalogue_at(s["sha"])
                    s["summary"] = {"added": len(cat), "removed": 0, "changed": 0}
                    s["thumbs"] = []
                s["parent"] = older
            return self.send_json({"steps": steps, "pending": pending_changes()})

        if path == "/api/history/diff":
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            to = (q.get("to") or [""])[0]
            frm = (q.get("from") or [""])[0] or step_parent(to)
            if to == WORKING and not frm:
                frm = git("rev-parse", "HEAD").stdout.strip()
            if not to:
                return self.send_json({"error": "missing to"}, 400)
            if not frm:      # the very first step has nothing before it
                cat = catalogue_at(to)
                thumbs = thumbs_at(to)
                return self.send_json({"from": None, "to": to, "added": [
                    {"id": str(c.get("id")), "coin": c,
                     "thumbs": {f: thumbs.get(f"{c.get('id')}-{f}") for f in ("obv", "rev")}}
                    for c in cat], "removed": [], "changed": []})
            d = diff_versions(frm, to)
            d.update({"from": frm, "to": to})
            return self.send_json(d)

        m = re.match(r"^/api/history/blob/([0-9a-f]{7,40})$", path)
        if m:
            # Blob ids are content addresses, so this can be cached forever.
            r = subprocess.run(["git", "cat-file", "blob", m.group(1)],
                               cwd=str(REPO_ROOT), capture_output=True)
            if r.returncode != 0:
                self.send_response(404); self.end_headers(); return
            self.send_response(200)
            self.send_header("Content-Type", "image/webp")
            self.send_header("Content-Length", str(len(r.stdout)))
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
            self.end_headers()
            self.wfile.write(r.stdout)
            return

        return super().do_GET()

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        try:
            if path == "/api/coin":
                return self.create_coin()
            if path == "/api/image":
                return self.upload_image()
            if path == "/api/golive":
                return self.golive()
            if path == "/api/restore":
                return self.restore()
            if path == "/api/commit":
                return self.commit()
            if path == "/api/push":
                return self.push()
            if path == "/api/discard":
                return self.discard()
        except Exception as e:
            import traceback
            traceback.print_exc()
            return self.send_json({"ok": False, "error": str(e)}, 500)
        self.send_json({"error": "not found"}, 404)

    def do_PATCH(self):
        path = urllib.parse.urlparse(self.path).path
        m = re.match(r"^/api/coin/([\w-]+)$", path)
        if not m:
            return self.send_json({"error": "not found"}, 404)
        try:
            return self.patch_coin(m.group(1))
        except Exception as e:
            import traceback
            traceback.print_exc()
            return self.send_json({"ok": False, "error": str(e)}, 500)

    def do_DELETE(self):
        path = urllib.parse.urlparse(self.path).path
        m = re.match(r"^/api/coin/([\w-]+)$", path)
        if not m:
            return self.send_json({"error": "not found"}, 404)
        try:
            return self.delete_coin(m.group(1))
        except Exception as e:
            return self.send_json({"ok": False, "error": str(e)}, 500)

    # ── endpoints ──

    def create_coin(self):
        body = self.read_json()
        with _lock:
            coins = load_coins()
            coin = {
                "id": next_id(coins),
                "status": body.get("status", "published"),
                "images": {},
                "updated": today(),
            }
            for k, v in body.items():
                if k not in ("id", "updated") and v not in (None, ""):
                    coin[k] = v
            coins.append(coin)
            save_coins(coins)
        self.send_json({"ok": True, "coin": coin})

    def patch_coin(self, coin_id):
        body = self.read_json()
        with _lock:
            coins = load_coins()
            for coin in coins:
                if str(coin.get("id")) == coin_id:
                    # Only record a change if something actually changed.
                    # Stamping the date on a save that altered nothing invents
                    # an edit: the history then shows an unsaved step with no
                    # content in it, and a save that publishes a timestamp.
                    touched = False
                    for k, v in body.items():
                        if k == "id":
                            continue
                        # null clears a field entirely — that's how edit mode
                        # removes a detail rather than blanking it to "".
                        if v is None or v == "":
                            if k in coin:
                                coin.pop(k, None)
                                touched = True
                        elif coin.get(k) != v:
                            coin[k] = v
                            touched = True
                    if touched:
                        coin["updated"] = today()
                        save_coins(coins)
                    return self.send_json({"ok": True, "coin": coin, "changed": touched})
        self.send_json({"ok": False, "error": "no such coin"}, 404)

    def delete_coin(self, coin_id):
        with _lock:
            coins = load_coins()
            keep, gone = [], None
            for coin in coins:
                if str(coin.get("id")) == coin_id:
                    gone = coin
                else:
                    keep.append(coin)
            if gone is None:
                return self.send_json({"ok": False, "error": "no such coin"}, 404)
            for face, filename in (gone.get("images") or {}).items():
                for d in (FULL_DIR, THUMB_DIR):
                    p = d / filename
                    if p.exists():
                        p.unlink()
            save_coins(keep)
        self.send_json({"ok": True})

    def upload_image(self):
        """
        Raw image bytes in the body; the coin id, face and filename ride in
        headers. Avoids multipart parsing entirely (cgi.FieldStorage is gone
        as of Python 3.13) and keeps the client side to a single fetch().
        """
        coin_id = self.headers.get("X-Coin-Id", "")
        face = self.headers.get("X-Face", "obv")
        name = self.headers.get("X-Filename", "upload.jpg")
        cutout = self.headers.get("X-Cutout", "1") != "0"

        if face not in ("obv", "rev"):
            return self.send_json({"ok": False, "error": "bad face"}, 400)

        length = int(self.headers.get("Content-Length", 0))
        if not length:
            return self.send_json({"ok": False, "error": "empty upload"}, 400)
        raw = self.rfile.read(length)

        ext = Path(name).suffix.lower()
        if ext not in IMG_EXT:
            return self.send_json({"ok": False, "error": f"unsupported file type {ext}"}, 400)

        tmp = COLLECTION / "images" / f".incoming-{coin_id}-{face}{ext}"
        tmp.parent.mkdir(parents=True, exist_ok=True)
        tmp.write_bytes(raw)

        try:
            filename = process_coin_image(tmp, coin_id, face, cutout=cutout)
        finally:
            tmp.unlink(missing_ok=True)

        with _lock:
            coins = load_coins()
            for coin in coins:
                if str(coin.get("id")) == coin_id:
                    coin.setdefault("images", {})[face] = filename
                    coin["updated"] = today()
                    break
            save_coins(coins)

        self.send_json({"ok": True, "filename": filename})

    # ── Restoring ──
    #
    # Going back is additive. Nothing is rewound and no commit is ever removed:
    # the collection folder is put back the way it was, and that becomes an
    # ordinary unsaved change like any other. The steps that came after stay in
    # the history, still selectable, still restorable — so a restore can itself
    # be undone by restoring the step you came from. There is no move here that
    # loses work.
    #
    # Restoring is deliberately all-or-nothing. Per-coin undo existed briefly
    # and was removed: two ways to reverse the same thing made the panel harder
    # to read than the problem it solved, and a step is already the unit people
    # think in. Confined to coins/collection/, as everything driven from the
    # page is.

    def restore(self):
        """Put the whole collection back as it stood at one step."""
        sha = (self.read_json() or {}).get("to", "")
        if not re.fullmatch(r"[0-9a-f]{7,40}", sha or ""):
            return self.send_json({"ok": False, "error": "bad version"}, 400)

        # Unsaved work would be destroyed by the checkout below, silently.
        if pending_changes()["total"] > 0:
            return self.send_json({
                "ok": False, "needsDecision": True,
                "error": "There are unsaved changes. Save or discard them first, "
                         "then restore — otherwise they would be lost."
            })

        before = git("rev-parse", "HEAD").stdout.strip()
        # Remove first: checking out a snapshot restores what existed then, but
        # leaves behind anything added since, which would silently survive.
        git("rm", "-r", "-q", "--ignore-unmatch", "--", COLLECTION_REL)
        r = git("checkout", sha, "--", COLLECTION_REL)
        if r.returncode != 0:
            git("checkout", before, "--", COLLECTION_REL)   # put it back
            return self.send_json({"ok": False, "error": r.stderr.strip()}, 500)

        global _pending_restore
        when = git("show", "-s", "--format=%aI", sha).stdout.strip()
        _pending_restore = {"sha": sha, "date": when}

        d = diff_versions(before, sha)
        return self.send_json({
            "ok": True, "to": sha,
            "summary": {"added": len(d["added"]), "removed": len(d["removed"]),
                        "changed": len(d["changed"])}
        })

    def golive(self):
        """
        Take the site live: merge the working branch into the branch GitHub
        Pages serves, and push.

        Deliberately fast-forward only. The working branch is always ahead of
        the live one in a straight line here, so a fast-forward is what should
        happen; if it is not possible, something unexpected has gone on and the
        right answer is to stop and say so rather than invent a merge commit
        for someone else to understand.

        The branch is switched back whatever happens, so a failure never
        strands anyone somewhere they did not mean to be.
        """
        pre = golive_preview()
        if pre["hasUnsaved"]:
            return self.send_json({"ok": False, "error":
                "There are unsaved changes. Save them first — only saved work can go live."})
        if pre["workingTreeDirty"]:
            return self.send_json({"ok": False, "error":
                "Some files outside the collection have been edited. Commit or discard "
                "them before publishing, so switching branches is safe."})
        if pre["upToDate"]:
            return self.send_json({"ok": False, "error": "The live site is already up to date."})

        branch = pre["branch"]

        if pre["isLive"]:
            r = git("push", "-u", "origin", PUBLISH_BRANCH)
            if r.returncode != 0:
                return self.send_json({"ok": False, "error": r.stderr.strip()})
            return self.send_json({"ok": True, "merged": False, "commits": pre["commits"]})

        sw = git("switch", PUBLISH_BRANCH)
        if sw.returncode != 0:
            return self.send_json({"ok": False, "error": sw.stderr.strip()})
        try:
            m = git("merge", "--ff-only", branch)
            if m.returncode != 0:
                return self.send_json({"ok": False, "error":
                    f"{PUBLISH_BRANCH} has moved on separately, so this could not be "
                    f"fast-forwarded. Merge it by hand.\n\n" + m.stderr.strip()})
            p = git("push", "-u", "origin", PUBLISH_BRANCH)
            if p.returncode != 0:
                return self.send_json({"ok": False, "error": p.stderr.strip()})
        finally:
            git("switch", branch)

        self.send_json({"ok": True, "merged": True, "branch": branch,
                        "commits": pre["commits"], "summary": pre["summary"]})

    def commit(self):
        add = git("add", *TRACKED)
        if add.returncode != 0:
            return self.send_json({"ok": False, "error": add.stderr.strip()})

        diff = git("diff", "--cached", "--name-status", *TRACKED).stdout
        added = deleted = 0
        for line in diff.splitlines():
            parts = line.split("\t")
            if len(parts) < 2:
                continue
            status, path = parts[0], parts[-1]
            if "/thumbs/" in path or path.endswith("coins.json"):
                continue
            if status == "A":
                added += 1
            elif status == "D":
                deleted += 1

        global _pending_restore
        if _pending_restore:
            stamp = _pending_restore["date"][:16].replace("T", " ")
            msg = f"Coins: restored the collection to {stamp}"
        else:
            bits = []
            if added:
                bits.append(f"added {added} photo{'s' if added > 1 else ''}")
            if deleted:
                bits.append(f"removed {deleted} photo{'s' if deleted > 1 else ''}")
            msg = "Coins: " + (", ".join(bits) if bits else "catalogue update")

        result = git("commit", "-m", msg)
        if result.returncode == 0:
            _pending_restore = None
            return self.send_json({"ok": True, "msg": msg})
        blob = result.stdout + result.stderr
        if "nothing to commit" in blob:
            return self.send_json({"ok": False, "error": "Nothing to commit"})
        self.send_json({"ok": False, "error": result.stderr.strip()})

    def push(self):
        branch = git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip()
        # -u so a branch that has never been pushed still works from the button.
        result = git("push", "-u", "origin", branch)
        if result.returncode == 0:
            return self.send_json({"ok": True, "branch": branch,
                                   "isLive": branch == PUBLISH_BRANCH,
                                   "publishBranch": PUBLISH_BRANCH})
        self.send_json({"ok": False, "error": result.stderr.strip()})

    def discard(self):
        """
        Throw away unpublished catalogue and photo changes.

        Scoped to coins/collection/ and nothing else. An earlier version cleaned
        coins/ wholesale, which deleted the site's own source the first time it
        ran: nothing under coins/ had been committed yet, so git saw index.html
        and the scripts as untracked junk and removed them. Separating the
        database from the code is what makes that impossible now — but the scope
        below is still deliberate. Never widen it.
        """
        if not git("ls-files", COLLECTION_REL).stdout.strip():
            return self.send_json({
                "ok": False,
                "error": "Nothing has been published yet, so there is no saved state to go back to. "
                         "Delete individual coins instead."
            })

        global _pending_restore
        _pending_restore = None
        git("clean", "-fd", COLLECTION_REL)
        git("checkout", "--", COLLECTION_REL)
        self.send_json({"ok": True})


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    try:
        import PIL  # noqa: F401
    except ImportError:
        sys.exit("Pillow is required:  pip3 install Pillow")

    for d in (FULL_DIR, THUMB_DIR, DATA_FILE.parent):
        d.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        save_coins([])

    # Reclaim the port if a previous run is still holding it.
    pids = subprocess.run(["lsof", "-ti", f"tcp:{PORT}"],
                          capture_output=True, text=True).stdout.split()
    if pids:
        subprocess.run(["kill", *pids])

    url = f"http://localhost:{PORT}/coins/"
    server = Server(("127.0.0.1", PORT), Handler)
    print(f"Coin editor  →  {url}")
    print("Ctrl-C to stop.")
    if "--no-open" not in sys.argv:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        server.shutdown()


if __name__ == "__main__":
    main()
