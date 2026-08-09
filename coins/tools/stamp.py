#!/usr/bin/env python3
"""Stamp the stylesheet and script URLs with a version.

GitHub Pages serves index.html with a ten minute cache and everything else with
a four hour one. A push therefore lands the new page against the old code for
most of an afternoon — and a page that expects one shape of markup, running
script that expects another, does not fail quietly. It failed by throwing
inside the viewer, so tapping a coin did nothing at all.

Changing the URL is the only way to reach past a cache that has already been
told it may keep the file. This writes a short hash of the assets themselves
into their query strings, so the address only changes when the file does — and
when it changes, no browser can serve the old one.

Run it after editing anything under coins/css or coins/js:

    python3 coins/tools/stamp.py
"""

import hashlib
import re
import sys
from pathlib import Path

COINS = Path(__file__).parent.parent
PAGE = COINS / "index.html"


def version() -> str:
    """A short digest of every asset the page loads, in a fixed order."""
    h = hashlib.sha256()
    for path in sorted(list((COINS / "css").glob("*.css")) + list((COINS / "js").glob("*.js"))):
        h.update(path.name.encode())
        h.update(path.read_bytes())
    return h.hexdigest()[:8]


def main() -> int:
    html = PAGE.read_text()
    v = version()

    # Local paths only. The font stylesheet is somebody else's URL to version.
    pattern = re.compile(r'((?:href|src)=")((?:css|js)/[\w.-]+)(?:\?v=[0-9a-f]+)?(")')
    stamped, n = pattern.subn(lambda m: f"{m.group(1)}{m.group(2)}?v={v}{m.group(3)}", html)

    if stamped == html:
        print(f"already at {v} ({n} assets)")
        return 0

    PAGE.write_text(stamped)
    print(f"stamped {n} assets at {v}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
