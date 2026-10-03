/* ============================================================================
   The Coin Collection — flair.

   Two touches that make the coins feel like objects rather than pictures:

   - In the grid, a coin tilts toward the pointer and a highlight slides across
     it, the way metal catches the light as you turn it in your hand.
   - The "o" in the wordmark is a coin from the collection. It turns over now
     and then on its own, and a click tosses it.

   Purely decorative. Nothing here is needed to use the page, and all of it
   stands down under prefers-reduced-motion.
   ========================================================================= */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ── Tilt and glint ─────────────────────────────────────────────────────── */

  var MAX_TILT = 14;   // degrees at the very edge of the tile

  function bindTilt(grid) {
    var active = null;
    var frame = 0;
    var last = null;

    function paint() {
      frame = 0;
      if (!active || !last) return;
      var r = active.getBoundingClientRect();
      var x = (last.clientX - r.left) / r.width;    // 0 … 1
      var y = (last.clientY - r.top) / r.width;     // against the disc, which is square
      x = Math.max(0, Math.min(1, x));
      y = Math.max(0, Math.min(1, y));
      active.style.setProperty("--ry", ((x - 0.5) * 2 * MAX_TILT).toFixed(2) + "deg");
      active.style.setProperty("--rx", ((0.5 - y) * 2 * MAX_TILT).toFixed(2) + "deg");
      active.style.setProperty("--gx", (x * 100).toFixed(1) + "%");
      active.style.setProperty("--gy", (y * 100).toFixed(1) + "%");
    }

    function release(btn) {
      if (!btn) return;
      btn.classList.remove("is-tilting");
      ["--rx", "--ry", "--gx", "--gy"].forEach(function (p) { btn.style.removeProperty(p); });
    }

    grid.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      var btn = e.target.closest && e.target.closest(".coin-btn");
      if (btn !== active) {
        release(active);
        active = btn;
        if (active) active.classList.add("is-tilting");
      }
      last = e;
      if (active && !frame) frame = requestAnimationFrame(paint);
    });

    grid.addEventListener("pointerleave", function () {
      release(active);
      active = null;
    });
  }

  /* ── The coin in the wordmark ───────────────────────────────────────────── */

  function pickCoin() {
    var C = window.Coins;
    var both = C.state.all.filter(function (c) {
      return c.status !== "draft" && C.hasImage(c, "obv") && C.hasImage(c, "rev");
    });
    if (!both.length) return null;
    return both[Math.floor(Math.random() * both.length)];
  }

  function face(cls, src) {
    var f = document.createElement("span");
    f.className = "mc-face " + cls;
    var img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.draggable = false;
    f.appendChild(img);
    return f;
  }

  function buildWordmarkCoin() {
    var slot = document.getElementById("masthead-o");
    if (!slot) return;
    var coin = pickCoin();
    if (!coin) return;

    var C = window.Coins;
    var obv = C.imgSrc(coin, "obv", "thumbs");
    var rev = C.imgSrc(coin, "rev", "thumbs");

    // Wait for both faces, so the letter is never swapped for half a coin.
    var pending = 2;
    [obv, rev].forEach(function (src) {
      var probe = new Image();
      probe.onload = probe.onerror = function () { if (--pending === 0) mount(); };
      probe.src = src;
    });

    function mount() {
      var toss = document.createElement("span");
      toss.className = "mc-toss";
      var tumble = document.createElement("span");
      tumble.className = "mc-tumble";
      var spin = document.createElement("span");
      spin.className = "mc-spin";
      spin.appendChild(face("mc-obv", obv));
      spin.appendChild(face("mc-rev", rev));
      tumble.appendChild(spin);
      toss.appendChild(tumble);

      var call = document.createElement("span");
      call.className = "mc-call";
      call.setAttribute("aria-hidden", "true");

      var coinEl = document.createElement("span");
      coinEl.className = "masthead-coin";
      coinEl.setAttribute("aria-hidden", "true");
      coinEl.title = C.title(coin) + (C.year(coin) ? ", " + C.year(coin) : "") + " — click to toss";
      coinEl.appendChild(toss);
      coinEl.appendChild(call);

      slot.appendChild(coinEl);
      slot.classList.add("has-coin");
      requestAnimationFrame(function () { coinEl.classList.add("is-in"); });

      if (!reduced) bindToss(coinEl, toss, tumble, call);
    }
  }

  function bindToss(coinEl, toss, tumble, call) {
    var x = 0, z = 0, tails = false, busy = false, hideCall = 0;

    coinEl.addEventListener("click", function () {
      if (busy) return;
      busy = true;
      clearTimeout(hideCall);
      call.classList.remove("is-shown");

      var land = Math.random() < 0.5;
      var turns = 4 + Math.floor(Math.random() * 2);
      x += turns * 360;
      // A turn about the horizontal axis leaves the reverse upside down, since
      // it is mounted for turning about the vertical one. Rolling half a turn
      // in the plane as well lands it the right way up — and mid-air, the
      // extra roll just reads as the coin tumbling.
      if (land !== tails) { x += 180; z += 180; tails = land; }

      coinEl.classList.add("is-tossing");
      toss.classList.remove("is-flying");
      void toss.offsetWidth;
      toss.classList.add("is-flying");
      tumble.style.transform = "rotateX(" + x + "deg) rotateZ(" + z + "deg)";

      setTimeout(function () {
        busy = false;
        coinEl.classList.remove("is-tossing");
        call.textContent = tails ? "Tails" : "Heads";
        call.classList.add("is-shown");
        hideCall = setTimeout(function () { call.classList.remove("is-shown"); }, 1600);
      }, 1150);
    });
  }

  /* ── Setup ──────────────────────────────────────────────────────────────── */

  // A coin is dealt once. Filtering re-inserts tiles, which would replay the
  // spin on every one of them, so the animation is retired once it has run.
  document.addEventListener("animationend", function (e) {
    if (e.animationName !== "coin-deal") return;
    var tile = e.target.closest && e.target.closest(".coin");
    if (tile) tile.classList.add("is-dealt");
  });

  document.addEventListener("coins:ready", function () {
    var grid = document.getElementById("grid");
    if (grid && finePointer && !reduced) bindTilt(grid);
    buildWordmarkCoin();
  });
})();
