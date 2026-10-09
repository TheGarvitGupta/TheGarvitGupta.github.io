/* ============================================================================
   The Coin Collection — viewer.

   Both faces side by side on a wide screen; on a narrow one, the coin turns
   over between them.

   A sheet over the collection. Inside it only three things respond to a
   click: previous, next and the cross. The faces themselves are for looking
   at — they do not open, turn or react to the pointer.
   ========================================================================= */

window.Viewer = (function () {
  "use strict";

  var el = {};
  var current = null;   // the coin being shown
  var face = "obv";     // which side is toward the viewer, on narrow screens
  var lastFocus = null;
  var pageTitle = "";   // the collection's own title, put back when a coin closes
  var reduced = false;
  // On a wide screen both faces show at once — a coin is two sides of one
  // object and comparing them is the point. Turning it over is for narrow
  // screens, where there is only room for one.
  var spread = false;

  /* ── Transform ──────────────────────────────────────────────────────────── */

  function paint(animate) {
    el.flipper.classList.toggle("no-transition", !animate);
    // Nothing to rotate under reduced motion, or when both faces are on show.
    var r = (!reduced && !spread && face === "rev") ? 180 : 0;
    el.flipper.style.transform = "rotateY(" + r + "deg)";
    el.flipper.classList.toggle("is-flipped", face === "rev");
  }

  /* ── Flip ───────────────────────────────────────────────────────────────── */

  function show(nextFace) {
    if (!current) return;
    if (!window.Coins.hasImage(current, nextFace)) return;
    face = nextFace;
    paint(true);
  }

  function flip() {
    if (spread) return;               // both faces are already visible
    var other = face === "obv" ? "rev" : "obv";
    if (current && window.Coins.hasImage(current, other)) show(other);
  }

  /* ── Image loading ──────────────────────────────────────────────────────── */

  /**
   * Show the thumbnail immediately (blurred, as a placeholder) and swap in the
   * full-resolution file once it has decoded, so there is never a blank frame.
   */
  function loadFace(imgEl, coin, which) {
    var thumb = window.Coins.imgSrc(coin, which, "thumbs");
    var full = window.Coins.imgSrc(coin, which, "full");

    imgEl.parentElement.hidden = !thumb;
    if (!thumb) { imgEl.removeAttribute("src"); return; }

    imgEl.src = thumb;
    imgEl.alt = window.Coins.title(coin) + ", " + (which === "obv" ? "obverse" : "reverse");
    imgEl.classList.add("is-placeholder");

    var hi = new Image();
    hi.decoding = "async";
    hi.src = full;
    var swap = function () {
      // Guard against a slow load landing after the user moved on.
      if (!current || current.id !== coin.id) return;
      imgEl.src = full;
      imgEl.classList.remove("is-placeholder");
    };
    if (hi.decode) hi.decode().then(swap).catch(swap);
    else hi.onload = swap;
  }

  /* ── Detail panel ───────────────────────────────────────────────────────── */

  function renderDetail(coin) {
    var C = window.Coins;

    var era = coin.ruler ? C.labelOf("rulers", coin.ruler)
            : coin.era   ? C.labelOf("eras", coin.era) : "";
    el.era.textContent = era;
    el.era.hidden = !era;

    el.title.textContent = C.title(coin);

    // Real paragraphs, one to each block of the note. A single element with
    // the line breaks kept by CSS looks the same, but is one run of text to
    // anything that reads the page by its structure.
    el.notes.textContent = "";
    (coin.notes || "").split(/\n\s*\n/).forEach(function (para) {
      if (!para.trim()) return;
      var p = document.createElement("p");
      p.textContent = para.trim();
      el.notes.appendChild(p);
    });
    el.notes.hidden = !coin.notes;

    // One table for all of it, a body to each group with the group's name
    // across its first row. It is laid out by the stylesheet exactly as the
    // headed lists it replaces were, but anything that reads the page by its
    // structure gets a single table whose columns line up from top to bottom,
    // where three separate ones each took their own widths.
    var groups = C.specs(coin);
    el.specs.textContent = "";
    var table = document.createElement("table");
    table.className = "spec-table";
    groups.forEach(function (g) {
      var body = document.createElement("tbody");
      body.className = "spec-group";
      body.dataset.group = g.id;

      var head = document.createElement("tr");
      head.className = "spec-head";
      var h = document.createElement("th");
      h.className = "spec-group-label";
      h.colSpan = 2;
      h.scope = "rowgroup";
      h.textContent = g.label;
      head.appendChild(h);
      body.appendChild(head);

      g.rows.forEach(function (row) {
        var wrap = document.createElement("tr");
        wrap.className = "spec" + (row.empty ? " is-empty" : "");
        wrap.dataset.key = row.key;
        var th = document.createElement("th");
        th.scope = "row";
        th.textContent = row.label;
        var td = document.createElement("td");
        td.innerHTML = row.html;
        if (row.note) {
          var gloss = document.createElement("span");
          gloss.className = "spec-note";
          gloss.textContent = row.note;
          td.appendChild(gloss);
        }
        wrap.appendChild(th);
        wrap.appendChild(td);
        body.appendChild(wrap);
      });
      table.appendChild(body);
    });
    if (groups.length) el.specs.appendChild(table);

    // Edit mode listens for this to hang its controls off the rendered panel.
    document.dispatchEvent(new CustomEvent("viewer:rendered", { detail: { coin: coin } }));
  }

  /* ── Open / close ───────────────────────────────────────────────────────── */

  /**
   * @param {string} id
   * @param {boolean} [fromHistory] set when this is the browser going back or
   *   forward, in which case the entry already exists and must not be added.
   */
  function open(id, fromHistory) {
    // Nothing here works before init() has found the elements.
    if (!el.root) return;
    var coin = window.Coins.byId(id);
    if (!coin) return;

    if (el.root.hidden) lastFocus = document.activeElement;
    current = coin;
    face = window.Coins.primaryFace(coin) || "obv";

    loadFace(el.imgObv, coin, "obv");
    loadFace(el.imgRev, coin, "rev");

    renderDetail(coin);
    updateNav();

    // The coin turns in to face you when the sheet opens, and only then. Going
    // to the next or previous one simply changes the coin: turning every time
    // made leafing through the collection a row of the same flourish.
    el.flipper.classList.remove("is-arriving");
    if (el.root.hidden) {
      void el.flipper.offsetWidth;   // reading layout restarts the animation
      el.flipper.classList.add("is-arriving");
    }

    el.root.hidden = false;
    document.title = window.Coins.title(coin) + " \u2014 " + pageTitle;
    document.body.style.overflow = "hidden";
    paint(false);
    el.root.focus();
    window.Coins.route(!fromHistory);
  }

  function close(fromHistory) {
    if (el.root.hidden) return;   // arriving at the grid from the grid

    el.root.hidden = true;
    // Nothing of the last coin is left in the page once it is shut, so the
    // collection itself is never mistaken for an article about one coin.
    el.era.textContent = el.title.textContent = el.notes.textContent = el.specs.textContent = "";
    el.imgObv.removeAttribute("src");
    el.imgRev.removeAttribute("src");
    document.title = pageTitle;
    document.body.style.overflow = "";
    current = null;
    window.Coins.route(!fromHistory);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function step(delta) {
    if (!current) return;
    var view = window.Coins.state.view;
    var i = window.Coins.indexOfInView(current.id);
    if (i < 0) return;
    var next = view[i + delta];
    if (next) open(next.id);
  }

  function updateNav() {
    if (!current) return;
    var i = window.Coins.indexOfInView(current.id);
    var view = window.Coins.state.view;
    el.prev.disabled = i <= 0;
    el.next.disabled = i < 0 || i >= view.length - 1;
  }

  /* ── Input ──────────────────────────────────────────────────────────────── */

  /**
   * Swiping sideways anywhere in the viewer moves to the next or previous
   * coin. A phone has no arrows — they were given up for the width — so
   * without this the only way to the next coin was back out to the grid.
   *
   * The whole page follows the finger, so the gesture is visibly doing
   * something; vertical drags are left to the browser (touch-action: pan-y) so
   * the page still scrolls down to the details.
   */
  function bindSwipe() {
    var start = null;
    var dx = 0;
    var swiped = false;
    var moving = el.body;

    function settle(animate) {
      moving.style.transition = animate ? "transform 0.25s, opacity 0.25s" : "none";
      moving.style.transform = "";
      moving.style.opacity = "";
    }

    el.root.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "touch") return;
      // Edit mode's fields keep their own gestures — selecting text, mostly.
      if (e.target.closest("input, textarea, select, [contenteditable='true']")) return;
      start = { x: e.clientX, y: e.clientY };
      dx = 0;
      swiped = false;
      moving.style.transition = "none";
    });

    el.root.addEventListener("pointermove", function (e) {
      if (!start) return;
      dx = e.clientX - start.x;
      if (Math.abs(dx) < 8) return;
      swiped = true;
      // Resist at either end of the collection, where there is nothing to reach.
      var i = window.Coins.indexOfInView(current ? current.id : null);
      var atEnd = (dx > 0 && i <= 0) ||
                  (dx < 0 && i >= window.Coins.state.view.length - 1);
      var shown = atEnd ? dx * 0.25 : dx;
      moving.style.transform = "translateX(" + shown + "px)";
      moving.style.opacity = String(1 - Math.min(Math.abs(shown) / 500, 0.4));
    });

    function end() {
      if (!start) return;
      start = null;
      var before = current;
      if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
      // A new coin arrives by its own animation; only a return needs easing.
      settle(current === before);
    }
    el.root.addEventListener("pointerup", end);
    el.root.addEventListener("pointercancel", function () { start = null; settle(true); });

    // The lift at the end of a swipe also counts as a tap on whatever is under
    // it. Swallow that one.
    el.root.addEventListener("click", function (e) {
      if (!swiped) return;
      swiped = false;
      e.stopPropagation();
      e.preventDefault();
    }, true);
  }

  function onKey(e) {
    if (el.root.hidden) return;
    // Let typing in edit mode's inputs through untouched.
    var t = e.target.tagName;
    if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT") {
      if (e.key === "Escape") e.stopPropagation();
      return;
    }
    switch (e.key) {
      case "Escape": e.preventDefault(); close(); break;
      case "ArrowLeft": e.preventDefault(); step(-1); break;
      case "ArrowRight": e.preventDefault(); step(1); break;
      case "f": case "F": e.preventDefault(); flip(); break;
      case "Tab": trapFocus(e); break;
    }
  }

  function trapFocus(e) {
    var focusable = el.root.querySelectorAll(
      'button:not([disabled]):not([hidden]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    var first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ── Setup ──────────────────────────────────────────────────────────────── */

  function init() {
    pageTitle = document.title;
    el.root = document.getElementById("viewer");
    el.frame = document.getElementById("stage-frame");
    el.flipper = document.getElementById("flipper");
    el.imgObv = document.getElementById("img-obv");
    el.imgRev = document.getElementById("img-rev");
    el.prev = document.getElementById("viewer-prev");
    el.next = document.getElementById("viewer-next");
    el.era = document.getElementById("detail-era");
    el.title = document.getElementById("viewer-title");
    el.notes = document.getElementById("detail-notes");
    el.specs = document.getElementById("detail-specs");
    el.detail = document.getElementById("detail");
    el.body = document.querySelector(".viewer-body");

    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Both faces, on every screen. This used to be a wide-screen luxury, with a
    // phone getting one side and a tap to turn it over — but comparing the two
    // is most of what looking at a coin is, and doing it from memory, one side
    // at a time, is the version that needs the bigger screen, not the smaller.
    spread = true;
    el.root.classList.add("is-spread");

    el.prev.addEventListener("click", function () { step(-1); });
    el.next.addEventListener("click", function () { step(1); });
    document.getElementById("viewer-close").addEventListener("click", function () { close(); });
    document.addEventListener("keydown", onKey);

    bindSwipe();

    // Re-check the prev/next bounds when filtering changes what's on screen.
    window.Coins.onChange(updateNav);
  }

  document.addEventListener("coins:ready", init);

  return {
    open: open,
    close: close,
    flip: flip,
    show: show,
    currentId: function () { return current ? current.id : null; },
    current: function () { return current; },
    rerender: function () {
      if (!current) return;
      var fresh = window.Coins.byId(current.id);
      if (!fresh) return;
      current = fresh;

      // Saving a field rebuilds this whole panel, and a scroller whose contents
      // are replaced returns to the top — so choosing a die axis halfway down
      // the table threw the reader back up to the title. Which element scrolls
      // depends on the width: the panel has its own overflow on a wide screen,
      // and on a narrow one the page scrolls as a whole. Remember both.
      var panelTop = el.detail ? el.detail.scrollTop : 0;
      var bodyTop = el.body ? el.body.scrollTop : 0;

      renderDetail(fresh);

      if (el.detail) el.detail.scrollTop = panelTop;
      if (el.body) el.body.scrollTop = bodyTop;
    },
    reloadFaces: function () {
      if (!current) return;
      var fresh = window.Coins.byId(current.id);
      if (fresh) current = fresh;
      loadFace(el.imgObv, current, "obv");
      loadFace(el.imgRev, current, "rev");
      if (!window.Coins.hasImage(current, face)) {
        var only = window.Coins.primaryFace(current);
        if (only) show(only);
      }
    }
  };
})();
