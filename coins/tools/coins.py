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


def next_id(coins):
    used = set()
    for c in coins:
        try:
            used.add(int(str(c.get("id", "0"))))
        except ValueError:
            pass
    n = 1
    while n in used:
        n += 1
    return f"{n:04d}"


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
    return {"added": added, "modified": modified, "deleted": deleted,
            "total": added + modified + deleted}


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
        # The catalogue is rewritten constantly while editing; never let the
        # browser serve a stale copy back to us.
        if self.path.startswith("/coins/collection/") or self.path.startswith("/coins/data/"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    # ── routing ──

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/ping":
            return self.send_json({"ok": True, "root": str(REPO_ROOT)})
        if path == "/api/pending":
            return self.send_json(pending_changes())
        return super().do_GET()

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        try:
            if path == "/api/coin":
                return self.create_coin()
            if path == "/api/image":
                return self.upload_image()
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
                "status": body.get("status", "unidentified"),
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
                    for k, v in body.items():
                        if k == "id":
                            continue
                        # null clears a field entirely — that's how edit mode
                        # removes a detail rather than blanking it to "".
                        if v is None or v == "":
                            coin.pop(k, None)
                        else:
                            coin[k] = v
                    coin["updated"] = today()
                    save_coins(coins)
                    return self.send_json({"ok": True, "coin": coin})
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

        bits = []
        if added:
            bits.append(f"added {added} photo{'s' if added > 1 else ''}")
        if deleted:
            bits.append(f"removed {deleted} photo{'s' if deleted > 1 else ''}")
        msg = "Coins: " + (", ".join(bits) if bits else "catalogue update")

        result = git("commit", "-m", msg)
        if result.returncode == 0:
            return self.send_json({"ok": True, "msg": msg})
        blob = result.stdout + result.stderr
        if "nothing to commit" in blob:
            return self.send_json({"ok": False, "error": "Nothing to commit"})
        self.send_json({"ok": False, "error": result.stderr.strip()})

    def push(self):
        result = git("push")
        if result.returncode == 0:
            return self.send_json({"ok": True})
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
