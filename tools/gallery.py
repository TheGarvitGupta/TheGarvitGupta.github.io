#!/usr/bin/env python3
"""
Gallery manager — run with: python3 tools/gallery.py
Opens a browser UI to add/delete photos and videos.
Generates thumb_ (low-res) and full-res versions automatically.

Requirements: pip install Pillow  +  brew install ffmpeg
"""

import http.server
import json
import os
import shutil
import subprocess
import sys
import threading
import urllib.parse
import webbrowser
from pathlib import Path

# ── Paths ────────────────────────────────────────────────────────────────────
REPO_ROOT   = Path(__file__).parent.parent
PHOTO_DIR   = REPO_ROOT / "images" / "photographs"
THUMB_DIR   = PHOTO_DIR / "thumbs"
PORT        = 8765

# ── Processing settings ──────────────────────────────────────────────────────
IMG_THUMB_W  = 800
IMG_FULL_W   = 2560
IMG_THUMB_Q  = 72
IMG_FULL_Q   = 88

VID_THUMB_W  = 640
VID_FULL_W   = 1280
VID_THUMB_CRF = 32
VID_FULL_CRF  = 24

MEDIA_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4", ".mov"}

# ── Helpers ──────────────────────────────────────────────────────────────────

def thumb_path(name: str) -> Path:
    stem = Path(name).stem
    ext  = Path(name).suffix.lower()
    thumb_ext = ".mp4" if ext in {".mp4", ".mov"} else ".jpg"
    return THUMB_DIR / (stem + thumb_ext)

def list_photos():
    """Return sorted list of original (non-thumb) filenames."""
    return [f.name for f in sorted(PHOTO_DIR.iterdir())
            if f.is_file() and f.suffix.lower() in MEDIA_EXT]

def capture_date(path: Path) -> str | None:
    """Return capture date as 'Mon D YYYY' string, or None if unavailable."""
    ext = path.suffix.lower()
    try:
        if ext in {".mp4", ".mov"}:
            result = subprocess.run(
                ["ffprobe", "-v", "quiet", "-print_format", "json",
                 "-show_entries", "format_tags=creation_time", str(path)],
                capture_output=True, text=True)
            data = json.loads(result.stdout)
            ts = data.get("format", {}).get("tags", {}).get("creation_time")
            if ts:
                from datetime import datetime
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                return dt.strftime("%-m/%-d/%y")
        else:
            from PIL import Image
            from PIL.ExifTags import TAGS
            img = Image.open(path)
            exif = img._getexif()
            if exif:
                for tag_id, val in exif.items():
                    if TAGS.get(tag_id) == "DateTimeOriginal":
                        from datetime import datetime
                        dt = datetime.strptime(val, "%Y:%m:%d %H:%M:%S")
                        return dt.strftime("%-m/%-d/%y")
    except Exception:
        pass
    return None

def process_image(src: Path, dest_full: Path, dest_thumb: Path):
    from PIL import Image, ImageOps
    img = Image.open(src)

    # Build sanitized EXIF: keep date/camera, strip GPS (tag 34853)
    exif_bytes = None
    try:
        exif = img.getexif()
        if exif:
            if 34853 in exif:
                del exif[34853]
            exif_bytes = exif.tobytes()
    except Exception:
        pass

    img = ImageOps.exif_transpose(img)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    def save_resized(target: Path, max_w: int, quality: int):
        w, h = img.size
        if w > max_w:
            ratio = max_w / w
            img_r = img.resize((max_w, int(h * ratio)), Image.LANCZOS)
        else:
            img_r = img
        target.parent.mkdir(parents=True, exist_ok=True)
        kwargs = {"quality": quality, "optimize": True}
        if exif_bytes:
            kwargs["exif"] = exif_bytes
        img_r.save(str(target), "JPEG", **kwargs)

    # Save as .jpg regardless of input format
    dest_full  = dest_full.with_suffix(".jpg")
    dest_thumb = dest_thumb.with_suffix(".jpg")
    save_resized(dest_full,  IMG_FULL_W,  IMG_FULL_Q)
    save_resized(dest_thumb, IMG_THUMB_W, IMG_THUMB_Q)
    return dest_full.name  # return final filename (may differ from input if ext changed)

def process_video(src: Path, dest_full: Path, dest_thumb: Path):
    def run(args):
        subprocess.run(args, check=True, capture_output=True)

    dest_full  = dest_full.with_suffix(".mp4")
    dest_thumb = dest_thumb.with_suffix(".mp4")

    # Full res
    run(["ffmpeg", "-y", "-i", str(src),
         "-vf", f"scale={VID_FULL_W}:-2",
         "-c:v", "libx264", "-crf", str(VID_FULL_CRF), "-preset", "fast",
         "-an", "-movflags", "+faststart", str(dest_full)])

    # Thumb
    run(["ffmpeg", "-y", "-i", str(src),
         "-vf", f"scale={VID_THUMB_W}:-2",
         "-c:v", "libx264", "-crf", str(VID_THUMB_CRF), "-preset", "fast",
         "-an", "-movflags", "+faststart", str(dest_thumb)])

    return dest_full.name

# ── HTTP handler ─────────────────────────────────────────────────────────────

HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gallery Manager</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, sans-serif; background: #f5f5f5; color: #111; }
  header { padding: 20px 24px; background: #fff; border-bottom: 1px solid #e0e0e0;
           display: flex; align-items: center; gap: 16px; }
  header h1 { font-size: 18px; font-weight: 600; }
  header span { font-size: 13px; color: #888; }

  #drop-zone {
    margin: 24px; border: 2px dashed #ccc; border-radius: 10px;
    padding: 32px; text-align: center; cursor: pointer;
    transition: background .15s, border-color .15s; background: #fff;
  }
  #drop-zone.dragover { background: #e8f0fe; border-color: #2196F3; }
  #drop-zone p { color: #666; font-size: 15px; }
  #drop-zone input { display: none; }

  #progress { margin: 0 24px 16px; display: none; }
  #progress-bar { height: 4px; background: #2196F3; border-radius: 2px;
                  transition: width .2s; }
  #progress-label { font-size: 12px; color: #666; margin-top: 4px; }

  #grid {
    margin: 0 24px 40px;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
  }
  @media (max-width: 900px) {
    #grid { grid-template-columns: repeat(3, 1fr); }
  }

  .tile {
    position: relative;
    aspect-ratio: 1;
    background: #ddd;
    border-radius: 4px;
    overflow: hidden;
    cursor: pointer;
  }
  .tile img, .tile video {
    width: 100%; height: 100%; object-fit: cover; display: block;
  }
  .tile .del {
    position: absolute; top: 6px; right: 6px;
    background: rgba(0,0,0,.55); color: #fff;
    border: none; border-radius: 50%; width: 26px; height: 26px;
    font-size: 14px; cursor: pointer; display: flex;
    align-items: center; justify-content: center;
    opacity: 0; transition: opacity .15s;
  }
  .tile:hover .del { opacity: 1; }
  .tile .label {
    position: absolute; bottom: 6px; left: 6px;
    background: rgba(0,0,0,.6); color: #fff;
    font-size: 10px; padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap; pointer-events: none;
  }

  /* Lightbox */
  #lb { display: none; position: fixed; inset: 0; background: rgba(0,0,0,.9);
        z-index: 9999; align-items: center; justify-content: center; }
  #lb.open { display: flex; }
  #lb img, #lb video { max-width: 92vw; max-height: 92vh; object-fit: contain; border-radius: 4px; }
  #lb-close { position: absolute; top: 16px; right: 20px; color: #fff;
               font-size: 28px; cursor: pointer; background: none; border: none; }
</style>
</head>
<body>

<header>
  <h1>Gallery Manager</h1>
  <span id="count"></span>
  <div style="margin-left:auto;display:flex;gap:8px;align-items:center;">
  <button id="btn-process" onclick="processExisting()" style="display:none;padding:6px 14px;font-size:13px;cursor:pointer;border:1px solid #ccc;border-radius:6px;background:#fff;">
    Generate missing thumbnails
  </button>
    <button id="btn-discard" onclick="discardChanges()" style="display:none;padding:6px 14px;font-size:13px;cursor:pointer;border:1px solid #f5c0c0;border-radius:6px;background:#fff5f5;color:#c0392b;">
      Discard
    </button>
    <button id="btn-commit" onclick="commitChanges()" style="padding:6px 14px;font-size:13px;cursor:pointer;border:1px solid #ccc;border-radius:6px;background:#fff;display:flex;align-items:center;gap:8px;">
      <span>Commit</span>
      <span id="commit-badge" style="display:none;font-size:11px;background:#f0f0f0;border-radius:4px;padding:2px 7px;color:#444;font-weight:500;letter-spacing:.2px;"></span>
    </button>
  </div>
</header>

<div id="drop-zone">
  <p>Drop photos or videos here, or <strong>click to browse</strong></p>
  <p style="font-size:12px;color:#aaa;margin-top:6px;">
    Generates thumb + full-res versions automatically
  </p>
  <input type="file" id="file-input" multiple accept="image/*,video/mp4,video/mov,video/quicktime">
</div>

<div id="progress">
  <div id="progress-bar" style="width:0%"></div>
  <div id="progress-label"></div>
</div>

<div id="grid"></div>

<div id="lb">
  <button id="lb-close">✕</button>
</div>

<script>
let photos = [];
let lbIdx = 0;

async function load() {
  const r = await fetch('/api/photos');
  photos = await r.json();
  document.getElementById('count').textContent = photos.length + ' photos';
  render();
  refreshPending();
}

function isVideo(name) { return /\.mp4$/i.test(name); }

function fmtSize(bytes) {
  if (bytes == null) return '?';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  return Math.round(bytes / 1024) + ' KB';
}

function render() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  photos.forEach((photo, i) => {
    const { name, hasThumb, originalSize, thumbSize, captureDate } = photo;
    const tile = document.createElement('div');
    tile.className = 'tile';

    if (isVideo(name)) {
      const v = document.createElement('video');
      v.autoplay = true; v.muted = true; v.loop = true; v.playsInline = true;
      v.src = '/photos/' + name;
      tile.appendChild(v);
    } else {
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = '/photos/' + name;
      tile.appendChild(img);
    }

    if (!hasThumb) {
      const badge = document.createElement('div');
      badge.title = 'No thumbnail — click "Generate missing thumbnails"';
      badge.style.cssText = 'position:absolute;top:6px;left:6px;background:#ff9800;color:#fff;font-size:9px;padding:2px 5px;border-radius:3px;font-weight:600;letter-spacing:.3px;';
      badge.textContent = 'NO THUMB';
      tile.appendChild(badge);
    }

    const label = document.createElement('div');
    label.className = 'label';
    const sizes = thumbSize != null
      ? `${fmtSize(thumbSize)} · ${fmtSize(originalSize)}`
      : fmtSize(originalSize);
    label.textContent = captureDate ? `${captureDate}  •  ${sizes}` : sizes;
    tile.appendChild(label);

    const del = document.createElement('button');
    del.className = 'del';
    del.textContent = '×';
    del.title = 'Delete';
    del.onclick = async e => {
      e.stopPropagation();
      await fetch('/api/photos/' + encodeURIComponent(name), { method: 'DELETE' });
      load();
    };
    tile.appendChild(del);

    tile.onclick = () => openLightbox(i);
    grid.appendChild(tile);
  });
}

// ── Lightbox ────────────────────────────────────────────────────────────────
const lb = document.getElementById('lb');
let lbEl = null;

function openLightbox(i) {
  lbIdx = i;
  lb.classList.add('open');
  showLb();
}
function showLb() {
  if (lbEl) lbEl.remove();
  const { name } = photos[lbIdx];
  if (isVideo(name)) {
    lbEl = document.createElement('video');
    lbEl.src = '/photos/' + name;
    lbEl.controls = true; lbEl.autoplay = true; lbEl.loop = true; lbEl.muted = true;
  } else {
    lbEl = document.createElement('img');
    lbEl.src = '/photos/' + name;
  }
  lb.appendChild(lbEl);
}
document.getElementById('lb-close').onclick = () => { lb.classList.remove('open'); if(lbEl) lbEl.remove(); };
document.addEventListener('keydown', e => {
  if (!lb.classList.contains('open')) return;
  if (e.key === 'Escape') document.getElementById('lb-close').click();
});

// ── Upload ───────────────────────────────────────────────────────────────────
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('dragover'); handleFiles(e.dataTransfer.files); });
fileInput.addEventListener('change', () => handleFiles(fileInput.files));

async function handleFiles(files) {
  const prog = document.getElementById('progress');
  const bar  = document.getElementById('progress-bar');
  const lbl  = document.getElementById('progress-label');
  prog.style.display = 'block';

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    lbl.textContent = `Processing ${i + 1} / ${files.length}: ${file.name}`;
    bar.style.width = ((i / files.length) * 100) + '%';

    const fd = new FormData();
    fd.append('file', file);
    await fetch('/api/upload', { method: 'POST', body: fd });
  }

  bar.style.width = '100%';
  lbl.textContent = 'Done!';
  setTimeout(() => { prog.style.display = 'none'; bar.style.width = '0%'; }, 1500);
  fileInput.value = '';
  load();
}

async function processExisting() {
  const r = await fetch('/api/missing-thumbs');
  const missing = await r.json();
  if (!missing.length) { alert('All thumbnails are up to date.'); return; }

  const prog = document.getElementById('progress');
  const bar  = document.getElementById('progress-bar');
  const lbl  = document.getElementById('progress-label');
  const btn  = document.getElementById('btn-process');
  prog.style.display = 'block';
  btn.disabled = true;

  for (let i = 0; i < missing.length; i++) {
    const name = missing[i];
    lbl.textContent = `Processing ${i + 1} / ${missing.length}: ${name}`;
    bar.style.width = ((i / missing.length) * 100) + '%';
    await fetch('/api/process-existing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: name })
    });
  }

  bar.style.width = '100%';
  lbl.textContent = `Done — processed ${missing.length} photo${missing.length > 1 ? 's' : ''}.`;
  btn.disabled = false;
  btn.style.display = 'none';
  setTimeout(() => { prog.style.display = 'none'; bar.style.width = '0%'; }, 2000);
  load();
}

load();

async function refreshPending() {
  const [r, mr] = await Promise.all([fetch('/api/pending'), fetch('/api/missing-thumbs')]);
  const d = await r.json();
  const missing = await mr.json();
  document.getElementById('btn-process').style.display = missing.length ? 'inline-block' : 'none';
  const parts = [];
  if (d.addedPhotos)   parts.push(`+${d.addedPhotos} photo${d.addedPhotos > 1 ? 's' : ''}`);
  if (d.addedVideos)   parts.push(`+${d.addedVideos} video${d.addedVideos > 1 ? 's' : ''}`);
  if (d.deletedPhotos) parts.push(`-${d.deletedPhotos} photo${d.deletedPhotos > 1 ? 's' : ''}`);
  if (d.deletedVideos) parts.push(`-${d.deletedVideos} video${d.deletedVideos > 1 ? 's' : ''}`);
  const badge = document.getElementById('commit-badge');
  const discard = document.getElementById('btn-discard');
  const commit = document.getElementById('btn-commit');
  if (parts.length) {
    badge.textContent = parts.join('  ');
    badge.style.display = 'inline-block';
    discard.style.display = 'inline-block';
    commit.style.borderColor = '#2196F3';
    commit.style.opacity = '1';
    commit.disabled = false;
  } else {
    badge.style.display = 'none';
    discard.style.display = 'none';
    commit.style.borderColor = '#ccc';
    commit.style.opacity = '0.4';
    commit.disabled = true;
  }
}

let pendingPush = false;

async function commitChanges() {
  const btn = document.getElementById('btn-commit');
  const label = btn.querySelector('span');

  if (pendingPush) {
    btn.disabled = true;
    label.textContent = 'Pushing…';
    try {
      const r = await fetch('/api/push', { method: 'POST' });
      const data = await r.json();
      if (data.ok) {
        label.textContent = '✓ Pushed';
        pendingPush = false;
        btn.style.borderColor = '#ccc';
      } else {
        label.textContent = '✗ ' + (data.error || 'Error');
      }
      setTimeout(() => { label.textContent = pendingPush ? 'Push' : 'Commit'; btn.disabled = false; refreshPending(); }, 2000);
    } catch (e) {
      label.textContent = '✗ Error';
      setTimeout(() => { label.textContent = 'Push'; btn.disabled = false; }, 2000);
    }
    return;
  }

  btn.disabled = true;
  label.textContent = 'Committing…';
  try {
    const r = await fetch('/api/commit', { method: 'POST' });
    const data = await r.json();
    if (data.ok) {
      pendingPush = true;
      label.textContent = 'Push';
      btn.style.borderColor = '#2196F3';
      btn.style.opacity = '1';
      btn.disabled = false;
      document.getElementById('btn-discard').style.display = 'none';
      document.getElementById('commit-badge').style.display = 'none';
    } else {
      label.textContent = '✗ ' + (data.error || 'Error');
      setTimeout(() => { label.textContent = 'Commit'; btn.disabled = false; refreshPending(); }, 2000);
    }
  } catch (e) {
    label.textContent = '✗ Error';
    setTimeout(() => { label.textContent = 'Commit'; btn.disabled = false; }, 2000);
  }
}

async function discardChanges() {
  const btn = document.getElementById('btn-discard');
  btn.disabled = true;
  btn.textContent = 'Discarding…';
  try {
    await fetch('/api/discard', { method: 'POST' });
    btn.textContent = 'Discard';
    btn.disabled = false;
    load();
    refreshPending();
  } catch (e) {
    btn.textContent = 'Discard';
    btn.disabled = false;
  }
}
</script>
</body>
</html>
"""


class Handler(http.server.BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        pass  # silence default access log

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path

        if path == "/":
            body = HTML.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        elif path == "/api/pending":
            diff = subprocess.run(
                ["git", "status", "--porcelain", "images/photographs/"],
                cwd=str(REPO_ROOT), capture_output=True, text=True).stdout
            added_photos = added_videos = deleted_photos = deleted_videos = 0
            for line in diff.splitlines():
                if len(line) < 4: continue
                status = line[:2].strip()
                fpath  = line[3:].strip()
                if "/thumbs/" in fpath: continue
                is_vid = fpath.lower().endswith(".mp4")
                if status in ("A", "??"):
                    if is_vid: added_videos += 1
                    else: added_photos += 1
                elif status == "D":
                    if is_vid: deleted_videos += 1
                    else: deleted_photos += 1
            self.send_json({"addedPhotos": added_photos, "addedVideos": added_videos,
                            "deletedPhotos": deleted_photos, "deletedVideos": deleted_videos})

        elif path == "/api/photos":
            def fsize(p):
                try: return p.stat().st_size
                except: return None
            photos = [{
                "name": name,
                "hasThumb": thumb_path(name).exists(),
                "originalSize": fsize(PHOTO_DIR / name),
                "thumbSize": fsize(thumb_path(name)) if thumb_path(name).exists() else None,
                "captureDate": capture_date(PHOTO_DIR / name),
            } for name in list_photos()]
            self.send_json(photos)

        elif path == "/api/missing-thumbs":
            missing = [name for name in list_photos() if not thumb_path(name).exists()]
            self.send_json(missing)

        elif path.startswith("/thumbs/"):
            filename = urllib.parse.unquote(path[len("/thumbs/"):])
            filepath = THUMB_DIR / filename
            if not filepath.exists():
                self.send_response(404); self.end_headers(); return
            ext = filepath.suffix.lower()
            mime = "video/mp4" if ext == ".mp4" else "image/jpeg"
            data = filepath.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        elif path.startswith("/photos/"):
            filename = urllib.parse.unquote(path[len("/photos/"):])
            filepath = PHOTO_DIR / filename
            if not filepath.exists():
                self.send_response(404); self.end_headers(); return
            ext = filepath.suffix.lower()
            mime = "video/mp4" if ext == ".mp4" else "image/jpeg" if ext in (".jpg",".jpeg") else "image/png"
            data = filepath.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        else:
            self.send_response(404); self.end_headers()

    def do_DELETE(self):
        path = urllib.parse.urlparse(self.path).path
        if path.startswith("/api/photos/"):
            filename = urllib.parse.unquote(path[len("/api/photos/"):])
            f = PHOTO_DIR / filename
            if f.exists(): f.unlink()
            t = thumb_path(filename)
            if t.exists(): t.unlink()
            self.send_json({"ok": True})
        else:
            self.send_response(404); self.end_headers()

    def do_POST(self):
        if self.path == "/api/push":
            try:
                result = subprocess.run(
                    ["git", "push"],
                    cwd=str(REPO_ROOT), capture_output=True, text=True)
                if result.returncode == 0:
                    self.send_json({"ok": True})
                else:
                    self.send_json({"ok": False, "error": result.stderr.strip()})
            except Exception as e:
                self.send_json({"ok": False, "error": str(e)})
            return

        if self.path == "/api/discard":
            try:
                # Remove untracked new files
                subprocess.run(
                    ["git", "clean", "-fd", "images/photographs/"],
                    cwd=str(REPO_ROOT), check=True, capture_output=True)
                # Restore deleted/modified tracked files
                subprocess.run(
                    ["git", "checkout", "--", "images/photographs/"],
                    cwd=str(REPO_ROOT), capture_output=True)
                self.send_json({"ok": True})
            except Exception as e:
                self.send_json({"ok": False, "error": str(e)})
            return

        if self.path == "/api/commit":
            try:
                date = "Thu May 8 08:45:00 2026 -0700"
                env = {**os.environ,
                       "GIT_AUTHOR_DATE": date,
                       "GIT_COMMITTER_DATE": date}
                subprocess.run(
                    ["git", "add", "images/photographs/"],
                    cwd=str(REPO_ROOT), check=True, capture_output=True)
                # Build commit message from staged diff
                diff = subprocess.run(
                    ["git", "diff", "--cached", "--name-status"],
                    cwd=str(REPO_ROOT), capture_output=True, text=True).stdout
                added_photos = added_videos = deleted_photos = deleted_videos = 0
                for line in diff.splitlines():
                    parts = line.split("\t")
                    if len(parts) < 2: continue
                    status, path = parts[0], parts[-1]
                    if "/thumbs/" in path: continue
                    is_vid = path.lower().endswith(".mp4")
                    if status == "A":
                        if is_vid: added_videos += 1
                        else: added_photos += 1
                    elif status == "D":
                        if is_vid: deleted_videos += 1
                        else: deleted_photos += 1
                parts = []
                if added_photos:  parts.append(f"Added {added_photos} photo{'s' if added_photos > 1 else ''}")
                if added_videos:  parts.append(f"Added {added_videos} video{'s' if added_videos > 1 else ''}")
                if deleted_photos: parts.append(f"Deleted {deleted_photos} photo{'s' if deleted_photos > 1 else ''}")
                if deleted_videos: parts.append(f"Deleted {deleted_videos} video{'s' if deleted_videos > 1 else ''}")
                msg = ", ".join(parts) if parts else "Update gallery photos"
                result = subprocess.run(
                    ["git", "commit", "-m", msg],
                    cwd=str(REPO_ROOT), env=env, capture_output=True, text=True)
                if result.returncode == 0:
                    self.send_json({"ok": True, "msg": msg})
                elif "nothing to commit" in result.stdout + result.stderr:
                    self.send_json({"ok": False, "error": "Nothing to commit"})
                else:
                    self.send_json({"ok": False, "error": result.stderr.strip()})
            except Exception as e:
                self.send_json({"ok": False, "error": str(e)})
            return

        if self.path == "/api/process-existing":
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            filename = body["filename"]
            src = PHOTO_DIR / filename
            if not src.exists():
                self.send_json({"error": "not found"}, 404); return
            ext = src.suffix.lower()
            try:
                stem = src.stem
                if ext in {".mp4", ".mov"}:
                    dest_full  = PHOTO_DIR / (stem + ".mp4")
                    dest_thumb = THUMB_DIR  / (stem + ".mp4")
                    process_video(src, dest_full, dest_thumb)
                else:
                    dest_full  = PHOTO_DIR / (stem + ".jpg")
                    dest_thumb = THUMB_DIR  / (stem + ".jpg")
                    process_image(src, dest_full, dest_thumb)
                if src != dest_full and src.exists():
                    src.unlink()
                self.send_json({"ok": True})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
            return

        if self.path != "/api/upload":
            self.send_response(404); self.end_headers(); return

        content_type = self.headers.get("Content-Type", "")
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)

        boundary = None
        for part in content_type.split(";"):
            p = part.strip()
            if p.startswith("boundary="):
                boundary = p[len("boundary="):].strip('"')
        if not boundary:
            self.send_json({"error": "no boundary"}, 400); return

        # Parse multipart manually (cgi module removed in Python 3.13)
        sep = f"--{boundary}".encode()
        parts = body.split(sep)
        file_data = None
        original_name = None
        for part in parts:
            if b'filename="' not in part:
                continue
            header_end = part.find(b"\r\n\r\n")
            if header_end == -1:
                continue
            headers = part[:header_end].decode(errors="replace")
            for line in headers.splitlines():
                if 'filename="' in line:
                    original_name = line.split('filename="')[1].rstrip('"').strip()
            file_data = part[header_end + 4:].rstrip(b"\r\n")
            break

        if not original_name or file_data is None:
            self.send_json({"error": "no file"}, 400); return

        original_name = Path(original_name).name
        ext = Path(original_name).suffix.lower()

        if ext not in MEDIA_EXT:
            self.send_json({"error": "unsupported type"}, 400); return

        # Save temp file
        tmp = PHOTO_DIR / f"_tmp_{original_name}"
        tmp.write_bytes(file_data)

        # Determine output name (always .jpg for images, .mp4 for video)
        stem = Path(original_name).stem
        try:
            if ext in {".mp4", ".mov"}:
                out_name   = stem + ".mp4"
                dest_full  = PHOTO_DIR / out_name
                dest_thumb = THUMB_DIR  / out_name
                final_name = process_video(tmp, dest_full, dest_thumb)
            else:
                out_name   = stem + ".jpg"
                dest_full  = PHOTO_DIR / out_name
                dest_thumb = THUMB_DIR  / out_name
                final_name = process_image(tmp, dest_full, dest_thumb)

            self.send_json({"ok": True, "name": final_name})
        except Exception as e:
            self.send_json({"error": str(e)}, 500)
        finally:
            if tmp.exists():
                tmp.unlink()


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    # Check dependencies
    try:
        import PIL
    except ImportError:
        print("Missing Pillow. Run:  pip install Pillow")
        sys.exit(1)

    if not shutil.which("ffmpeg"):
        print("Missing ffmpeg. Run:  brew install ffmpeg")
        sys.exit(1)

    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    THUMB_DIR.mkdir(parents=True, exist_ok=True)

    # Kill any previous instance on this port
    pids = subprocess.run(["lsof", "-ti", f"tcp:{PORT}"], capture_output=True, text=True).stdout.split()
    if pids:
        subprocess.run(["kill"] + pids)
        import time; time.sleep(0.5)

    server = http.server.HTTPServer(("127.0.0.1", PORT), Handler)
    url = f"http://localhost:{PORT}"
    print(f"Gallery manager running at {url}")
    print("Press Ctrl+C to stop.\n")

    threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
