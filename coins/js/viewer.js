/* ============================================================================
   The Coin Collection — viewer.

   Flip between obverse and reverse, and zoom into the surface. Full images are
   ~2200px shown at roughly 550px, so there is genuine detail to explore; no
   tiling is needed at that ratio, which keeps this dependency-free.

   Zoom and flip share one transform, composed in a fixed order:
       translate(x, y) scale(s) rotateY(r)
   The CSS transition is suppressed while panning or wheeling so those feel
   direct, and re-enabled for the flip, which wants to be a deliberate motion.
   ========================================================================= */

window.Viewer = (function () {
  "use strict";

  var MAX_SCALE = 5;
  var MIN_SCALE = 1;

  var el = {};
  var current = null;   // the coin being shown
  var face = "obv";     // which side is toward the viewer
  var scale = 1, tx = 0, ty = 0;
  var lastFocus = null;
  var reduced = false;

  /* ── Transform ──────────────────────────────────────────────────────────── */

  function paint(animate) {
    el.flipper.classList.toggle("no-transition", !animate);
    // Under reduced motion the faces cross-fade instead of rotating, so the
    // rotation is dropped here rather than in CSS — that leaves the translate
    // and scale intact, and zooming keeps working.
    var r = (!reduced && face === "rev") ? 180 : 0;
    el.flipper.style.transform =
      "translate(" + tx + "px, " + ty + "px) scale(" + scale + ") rotateY(" + r + "deg)";
    el.flipper.classList.toggle("is-flipped", face === "rev");
    el.frame.classList.toggle("is-zoomed", scale > 1.01);
  }

  /** Keep the coin from being dragged out of its own frame. */
  function clamp() {
    var rect = el.frame.getBoundingClientRect();
    var maxX = Math.max(0, (scale - 1) * rect.width / 2);
    var maxY = Math.max(0, (scale - 1) * rect.height / 2);
    tx = Math.min(maxX, Math.max(-maxX, tx));
    ty = Math.min(maxY, Math.max(-maxY, ty));
  }

  /** Zoom toward a point, so the pixel under the cursor stays put. */
  function zoomAt(nextScale, clientX, clientY, animate) {
    var rect = el.frame.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var px = (clientX === undefined ? cx : clientX) - cx;
    var py = (clientY === undefined ? cy : clientY) - cy;

    var s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
    if (s === scale) return;

    // translate() sits left of rotateY() in the transform list, so it resolves
    // in the parent's un-rotated space — screen axes, on both faces. No
    // mirroring correction is needed here or in the pan handler.
    tx = px - (px - tx) * (s / scale);
    ty = py - (py - ty) * (s / scale);

    scale = s;
    if (scale <= 1.001) { scale = 1; tx = 0; ty = 0; }
    clamp();
    paint(animate !== false);
    updateHint();
  }

  function resetZoom(animate) {
    scale = 1; tx = 0; ty = 0;
    clamp();
    paint(animate !== false);
    updateHint();
  }

  function updateHint() {
    if (!el.hint) return;
    if (scale > 1.01) {
      el.hint.textContent = Math.round(scale * 100) + "%  ·  double-click to fit";
    } else {
      el.hint.textContent = reduced ? "Use the buttons to turn the coin over"
                                    : "Scroll to zoom  ·  drag to pan  ·  F to turn over";
    }
  }

  /* ── Flip ───────────────────────────────────────────────────────────────── */

  function show(nextFace) {
    if (!current) return;
    if (!window.Coins.hasImage(current, nextFace)) return;
    face = nextFace;
    resetZoom(true);
    el.btnObv.classList.toggle("is-active", face === "obv");
    el.btnRev.classList.toggle("is-active", face === "rev");
    paint(true);
  }

  function flip() {
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
        wrap.className = "spec";
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
    resetZoom(false);
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

  var pointers = {};
  var panStart = null;
  var pinchStart = null;
  var downAt = null;

  function bindStage() {
    el.frame.addEventListener("wheel", function (e) {
      if (!current) return;
      e.preventDefault();
      // Trackpad pinch arrives as ctrlKey+wheel; both paths want the same feel.
      var factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022));
      zoomAt(scale * factor, e.clientX, e.clientY, false);
    }, { passive: false });

    el.frame.addEventListener("pointerdown", function (e) {
      if (!current) return;
      el.frame.setPointerCapture(e.pointerId);
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      downAt = { x: e.clientX, y: e.clientY, t: Date.now() };
      var ids = Object.keys(pointers);

      if (ids.length === 1 && scale > 1.01) {
        panStart = { x: e.clientX, y: e.clientY, tx: tx, ty: ty };
        el.frame.classList.add("is-panning");
      } else if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: scale };
        panStart = null;
        downAt = null;   // a two-finger gesture is never a tap
      }
    });

    el.frame.addEventListener("pointermove", function (e) {
      if (!pointers[e.pointerId]) return;
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pointers);

      if (pinchStart && ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var dist = Math.hypot(a.x - b.x, a.y - b.y);
        zoomAt(pinchStart.scale * (dist / pinchStart.dist),
               (a.x + b.x) / 2, (a.y + b.y) / 2, false);
        return;
      }

      if (panStart) {
        tx = panStart.tx + (e.clientX - panStart.x);
        ty = panStart.ty + (e.clientY - panStart.y);
        clamp();
        paint(false);
      }
    });

    function endPointer(e) {
      // A quick, still tap with nothing zoomed turns the coin over.
      if (downAt && Object.keys(pointers).length === 1) {
        var moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
        if (moved < 5 && Date.now() - downAt.t < 350 && scale <= 1.01) flip();
      }
      downAt = null;
      delete pointers[e.pointerId];
      if (Object.keys(pointers).length < 2) pinchStart = null;
      if (Object.keys(pointers).length === 0) {
        panStart = null;
        el.frame.classList.remove("is-panning");
      }
    }
    el.frame.addEventListener("pointerup", endPointer);
    el.frame.addEventListener("pointercancel", function (e) {
      downAt = null;
      endPointer(e);
    });

    el.frame.addEventListener("dblclick", function (e) {
      if (scale > 1.01) resetZoom(true);
      else zoomAt(2.5, e.clientX, e.clientY, true);
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
      case "+": case "=": e.preventDefault(); zoomAt(scale * 1.4, undefined, undefined, true); break;
      case "-": case "_": e.preventDefault(); zoomAt(scale / 1.4, undefined, undefined, true); break;
      case "0": e.preventDefault(); resetZoom(true); break;
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
