/* ============================================================================
   The Coin Collection — viewer.

   Both faces side by side on a wide screen; on a narrow one, the coin turns
   over between them.

   Looking closely opens the photograph in its own tab rather than
   reimplementing zoom: the browser's is better, and the image can then be
   saved, printed or sent on. What is left here is the turn between faces.
   ========================================================================= */

window.Viewer = (function () {
  "use strict";

  var el = {};
  var current = null;   // the coin being shown
  var face = "obv";     // which side is toward the viewer, on narrow screens
  var lastFocus = null;
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

  /**
   * Looking closely means opening the photograph itself, in its own tab. The
   * browser's own zoom is better than anything reimplemented here, and the
   * image can then be saved, printed or sent to someone.
   */
  function openFull(which) {
    if (!current) return;
    var url = window.Coins.imgSrc(current, which, "full");
    if (url) window.open(url, "_blank", "noopener");
  }

  function updateHint() {
    if (!el.hint) return;
    // Nothing to explain when both faces are on show — clicking a photograph
    // to see it larger needs no caption. The narrow layout keeps its line,
    // where turning the coin over is the only way to the other side.
    el.hint.textContent = spread ? "" : "Tap the coin to turn it over";
    el.hint.hidden = spread;
  }

  /* ── Flip ───────────────────────────────────────────────────────────────── */

  function show(nextFace) {
    if (!current) return;
    if (!window.Coins.hasImage(current, nextFace)) return;
    face = nextFace;
    el.btnObv.classList.toggle("is-active", face === "obv");
    el.btnRev.classList.toggle("is-active", face === "rev");
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

    el.notes.textContent = coin.notes || "";
    el.notes.hidden = !coin.notes;

    var groups = C.specs(coin);
    el.specs.textContent = "";
    groups.forEach(function (g) {
      var section = document.createElement("section");
      section.className = "spec-group";
      section.dataset.group = g.id;

      var h = document.createElement("h3");
      h.className = "spec-group-label";
      h.textContent = g.label;
      section.appendChild(h);

      var dl = document.createElement("dl");
      dl.style.margin = "0";
      g.rows.forEach(function (row) {
        var wrap = document.createElement("div");
        wrap.className = "spec" + (row.empty ? " is-empty" : "");
        wrap.dataset.key = row.key;
        var dt = document.createElement("dt");
        dt.textContent = row.label;
        var dd = document.createElement("dd");
        dd.innerHTML = row.html;
        wrap.appendChild(dt);
        wrap.appendChild(dd);
        dl.appendChild(wrap);
      });
      section.appendChild(dl);
      el.specs.appendChild(section);
    });

    // Edit mode listens for this to hang its controls off the rendered panel.
    document.dispatchEvent(new CustomEvent("viewer:rendered", { detail: { coin: coin } }));
  }

  /* ── Open / close ───────────────────────────────────────────────────────── */

  function open(id) {
    // Nothing here works before init() has found the elements.
    if (!el.root) return;
    var coin = window.Coins.byId(id);
    if (!coin) return;

    if (el.root.hidden) lastFocus = document.activeElement;
    current = coin;
    face = window.Coins.primaryFace(coin) || "obv";

    loadFace(el.imgObv, coin, "obv");
    loadFace(el.imgRev, coin, "rev");

    el.btnObv.disabled = !window.Coins.hasImage(coin, "obv");
    el.btnRev.disabled = !window.Coins.hasImage(coin, "rev");
    el.btnObv.classList.toggle("is-active", face === "obv");
    el.btnRev.classList.toggle("is-active", face === "rev");

    renderDetail(coin);
    updateNav();

    el.root.hidden = false;
    document.body.style.overflow = "hidden";
    paint(false);
    el.close.focus();
    window.Coins.writeHash();
  }

  function close() {
    el.root.hidden = true;
    document.body.style.overflow = "";
    current = null;
    window.Coins.writeHash();
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

  function bindStage() {
    // Side by side, a face opens its own photograph. Stacked, the coin turns
    // over — which is the only way to see the other side on a narrow screen.
    ["face-obv", "face-rev"].forEach(function (cls) {
      var node = el.frame.querySelector("." + cls);
      if (!node) return;
      node.addEventListener("click", function () {
        if (spread) openFull(cls === "face-rev" ? "rev" : "obv");
        else flip();
      });
    });
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
    el.root = document.getElementById("viewer");
    el.frame = document.getElementById("stage-frame");
    el.flipper = document.getElementById("flipper");
    el.imgObv = document.getElementById("img-obv");
    el.imgRev = document.getElementById("img-rev");
    el.btnObv = document.getElementById("btn-obv");
    el.btnRev = document.getElementById("btn-rev");
    el.close = document.getElementById("viewer-close");
    el.prev = document.getElementById("viewer-prev");
    el.next = document.getElementById("viewer-next");
    el.era = document.getElementById("detail-era");
    el.title = document.getElementById("viewer-title");
    el.notes = document.getElementById("detail-notes");
    el.specs = document.getElementById("detail-specs");
    el.hint = document.getElementById("stage-hint");

    reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var wide = window.matchMedia("(min-width: 900px)");
    function applyMode() {
      spread = wide.matches;
      el.root.classList.toggle("is-spread", spread);
      paint(false);
      updateHint();
    }
    applyMode();
    if (wide.addEventListener) wide.addEventListener("change", applyMode);
    else if (wide.addListener) wide.addListener(applyMode);

    el.close.addEventListener("click", close);
    el.prev.addEventListener("click", function () { step(-1); });
    el.next.addEventListener("click", function () { step(1); });
    el.btnObv.addEventListener("click", function () { show("obv"); });
    el.btnRev.addEventListener("click", function () { show("rev"); });
    el.root.addEventListener("click", function (e) { if (e.target === el.root) close(); });
    document.addEventListener("keydown", onKey);

    bindStage();
    updateHint();

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
      if (fresh) { current = fresh; renderDetail(fresh); }
    },
    reloadFaces: function () {
      if (!current) return;
      var fresh = window.Coins.byId(current.id);
      if (fresh) current = fresh;
      loadFace(el.imgObv, current, "obv");
      loadFace(el.imgRev, current, "rev");
      el.btnObv.disabled = !window.Coins.hasImage(current, "obv");
      el.btnRev.disabled = !window.Coins.hasImage(current, "rev");
      if (!window.Coins.hasImage(current, face)) {
        var only = window.Coins.primaryFace(current);
        if (only) show(only);
      }
    }
  };
})();
