/* ============================================================================
   The Coin Collection — flair.

   Two touches that make the coins feel like objects rather than pictures:

   - In the grid, a coin tilts toward the pointer and a highlight slides across
     it, the way metal catches the light as you turn it in your hand.
   - Tapping the "o" in the wordmark turns it into a coin from the
     collection, tosses it, and turns it back into the letter.

   Purely decorative. Nothing here is needed to use the page. Under
   prefers-reduced-motion the tilt is off and the toss lands without flying.
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

  function tossable() {
    var C = window.Coins;
    return C.state.all.filter(function (c) {
      return c.status !== "draft" && C.hasImage(c, "obv") && C.hasImage(c, "rev");
    });
  }

  function face(cls) {
    var f = document.createElement("span");
    f.className = "mc-face " + cls;
    var img = document.createElement("img");
    img.alt = "";
    img.draggable = false;
    f.appendChild(img);
    return f;
  }

  /** Resolves once both faces of a coin have loaded, so a toss never shows half a coin. */
  function preload(coin) {
    var C = window.Coins;
    return Promise.all(["obv", "rev"].map(function (which) {
      return new Promise(function (done) {
        var probe = new Image();
        probe.onload = probe.onerror = done;
        probe.src = C.imgSrc(coin, which, "thumbs");
      });
    })).then(function () { return coin; });
  }

  function buildWordmarkCoin() {
    var slot = document.getElementById("masthead-o");
    if (!slot) return;
    var pool = tossable();
    if (!pool.length) return;
    var C = window.Coins;

    var toss = document.createElement("span");
    toss.className = "mc-toss";
    var tumble = document.createElement("span");
    tumble.className = "mc-tumble";
    var spin = document.createElement("span");
    spin.className = "mc-spin";
    var obvFace = face("mc-obv"), revFace = face("mc-rev");
    spin.appendChild(obvFace);
    spin.appendChild(revFace);
    tumble.appendChild(spin);
    toss.appendChild(tumble);

    var call = document.createElement("span");
    call.className = "mc-call";

    var coinEl = document.createElement("span");
    coinEl.className = "masthead-coin";
    coinEl.setAttribute("aria-hidden", "true");
    coinEl.appendChild(toss);
    coinEl.appendChild(call);
    var anchor = document.createElement("span");
    anchor.className = "mc-anchor";
    anchor.setAttribute("aria-hidden", "true");
    anchor.appendChild(coinEl);
    slot.insertBefore(anchor, slot.firstChild);

    // A different coin each time, never the same one twice running.
    var order = pool.slice().sort(function () { return Math.random() - 0.5; });
    var next = 0;
    var ready = null;   // promise of the coin the next tap will toss
    function queue() { ready = preload(order[next++ % order.length]); }

    function dress(coin) {
      obvFace.firstChild.src = C.imgSrc(coin, "obv", "thumbs");
      revFace.firstChild.src = C.imgSrc(coin, "rev", "thumbs");
      slot.title = C.title(coin) + (C.year(coin) ? ", " + C.year(coin) : "");
    }

    var busy = false;
    function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

    slot.addEventListener("click", function () {
      if (busy) return;
      busy = true;
      ready.then(function (coin) {
        dress(coin);
        queue();

        // Measured now rather than once, so the web font has had time to load.
        var size = parseFloat(getComputedStyle(slot).fontSize) || 1;
        anchor.style.setProperty("--o-w", slot.getBoundingClientRect().width / size + "em");

        // Always starts heads up; the toss decides how it lands.
        tumble.classList.add("no-transition");
        tumble.style.transform = "";
        void tumble.offsetWidth;
        tumble.classList.remove("no-transition");

        slot.classList.add("is-coin");
        if (reduced) {
          // No flight: the letter becomes the coin, which shows its call.
          var still = Math.random() < 0.5;
          if (still) tumble.style.transform = "rotateY(180deg)";
          call.textContent = still ? "Tails" : "Heads";
          call.classList.add("is-shown");
          return wait(1600);
        }

        return wait(380).then(function () {
          var tails = Math.random() < 0.5;
          var turns = 4 + Math.floor(Math.random() * 2);
          // A turn about the horizontal axis leaves the reverse upside down,
          // since it is mounted for turning about the vertical one. Rolling
          // half a turn in the plane as well lands it the right way up — and
          // mid-air, the extra roll just reads as the coin tumbling.
          var x = turns * 360 + (tails ? 180 : 0);
          var z = tails ? 180 : 0;
          toss.classList.remove("is-flying");
          void toss.offsetWidth;
          toss.classList.add("is-flying");
          tumble.style.transform = "rotateX(" + x + "deg) rotateZ(" + z + "deg)";
          return wait(1150).then(function () {
            call.textContent = tails ? "Tails" : "Heads";
            call.classList.add("is-shown");
            return wait(1300);
          });
        });
      }).then(function () {
        call.classList.remove("is-shown");
        slot.classList.remove("is-coin");
        return wait(450);
      }).then(function () { busy = false; });
    });

    queue();
    slot.classList.add("has-coin");
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
