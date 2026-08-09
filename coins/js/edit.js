/* ============================================================================
   The Coin Collection — edit mode.

   This file is loaded by the public site too, but it does nothing there. It
   probes /api/ping first; only the local server (tools/coins.py) answers, so
   on GitHub Pages every branch below is skipped and the page stays read-only.

   Everything here decorates the exhibit that's already on screen rather than
   building a second interface: click a value to change it, drop a photo onto
   a coin to set that face, "+ Add detail" for the fields a coin doesn't have
   yet. What you edit is what visitors will see.
   ========================================================================= */

(function () {
  "use strict";

  var pending = { total: 0 };
  var bar = null;
  var unsavedIds = {};     // coin id -> true, for the marks in the grid
  var unsavedDetail = {};  // coin id -> which fields and faces are unsaved

  /* ── Server ─────────────────────────────────────────────────────────────── */

  function api(method, path, body, headers) {
    var opts = { method: method, headers: headers || {} };
    if (body !== undefined && body !== null) {
      if (body instanceof Blob || body instanceof ArrayBuffer) {
        opts.body = body;
      } else {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(body);
      }
    }
    return fetch(path, opts).then(function (r) { return r.json(); });
  }

  function toast(msg, isError) {
    var t = document.createElement("div");
    t.className = "toast" + (isError ? " is-error" : "");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add("is-out"); }, isError ? 4200 : 1800);
    setTimeout(function () { t.remove(); }, isError ? 4600 : 2200);
  }

  function refreshPending() {
    return api("GET", "/api/golive/preview").then(function (p) {
      pending = p;
      if (!bar) return;

      var unsaved = p.pending || 0;
      var waiting = p.collectionSteps || 0;

      unsavedIds = {};
      (p.pendingIds || []).forEach(function (id) { unsavedIds[String(id)] = true; });
      markUnsaved();
      loadUnsavedDetail();

      // The same three actions are always present, in the order the work moves
      // through them: throw away, save, publish. Only the one that applies is
      // live, so the bar never changes shape and the next step is obvious
      // without reading anything.
      bar.discard.disabled = !unsaved;
      bar.save.disabled = !unsaved;
      bar.publish.disabled = !!unsaved || !waiting;

      if (unsaved) {
        var n = p.pendingCoins || 0;
        bar.root.className = "topbar is-unsaved";
        bar.text.textContent = n
          ? (n === 1 ? "1 coin unsaved" : n + " coins unsaved")
          : "Unsaved changes";
      } else if (waiting) {
        bar.root.className = "topbar is-waiting";
        bar.text.textContent = waiting === 1
          ? "1 change not published" : waiting + " changes not published";
      } else {
        // "Collection", not "Everything": changes to the site's own code can be
        // waiting too, and they are not this bar's business. Reporting them
        // here produced "Site updates not published" in an interface about
        // coins, which means nothing to the person using it.
        bar.root.className = "topbar is-live";
        bar.text.textContent = "Collection published";
      }
    });
  }

  /**
   * The timeline is a view of the same state the bar acts on, so anything that
   * changes that state has to tell it. Discarding from the bar while the panel
   * is open otherwise leaves an unsaved step sitting there describing changes
   * that no longer exist.
   */
  function refreshHistory() {
    if (window.CoinHistory && window.CoinHistory.isOpen()) window.CoinHistory.refresh();
  }

  function onDiscard() {
    if (!confirm("Throw away every unsaved change?\n\nPhotos added since the last save will be deleted, and edits since then undone.")) return;
    api("POST", "/api/discard", {}).then(function (res) {
      if (!res.ok) { toast(res.error || "Could not discard", true); return null; }
      return window.Coins.reload().then(function () {
        refreshPending();
        refreshHistory();
        toast("Changes discarded");
      });
    });
  }

  /** Save a patch, then pull the catalogue back so every view agrees. */
  function patch(coinId, fields) {
    return api("PATCH", "/api/coin/" + encodeURIComponent(coinId), fields)
      .then(function (res) {
        if (!res.ok) { toast(res.error || "Could not save", true); return null; }
        return window.Coins.reload().then(function () {
          if (window.Viewer.currentId() === coinId) window.Viewer.rerender();
          refreshPending();
          return res.coin;
        });
      });
  }

  /* ── Uploading photos ───────────────────────────────────────────────────── */

  function uploadFace(coinId, faceKey, file) {
    return api("POST", "/api/image", file, {
      "X-Coin-Id": coinId,
      "X-Face": faceKey,
      "X-Filename": file.name,
      "Content-Type": "application/octet-stream"
    }).then(function (res) {
      if (!res.ok) { toast(res.error || "Could not process that photo", true); return null; }
      // The filename is unchanged, so mark this coin's images as new before
      // anything re-reads them.
      window.Coins.bust(coinId);
      return window.Coins.reload().then(function () {
        if (window.Viewer.currentId() === coinId) {
          window.Viewer.reloadFaces();
          window.Viewer.rerender();
        }
        refreshPending();
        return res.filename;
      });
    });
  }

  /**
   * Work out which side each dropped file is. Matches the naming convention in
   * PHOTOGRAPHY.md; failing that, falls back to pairing files two at a time in
   * sorted order, which is what a camera produces shooting front-then-back.
   */
  function pairFiles(files) {
    var list = Array.prototype.slice.call(files).filter(function (f) {
      return /^image\//.test(f.type) || /\.(jpe?g|png|webp|tiff?|heic|bmp)$/i.test(f.name);
    });
    list.sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { numeric: true }); });

    var OBV = /(^|[-_ ])(obv|obverse|front|head|heads)([-_ .]|$)/i;
    var REV = /(^|[-_ ])(rev|reverse|back|tail|tails)([-_ .]|$)/i;

    var labelled = list.length > 0 && list.every(function (f) {
      var stem = f.name.replace(/\.[^.]+$/, "");
      return OBV.test(stem) || REV.test(stem);
    });

    var pairs = [];
    if (labelled) {
      var byKey = {};
      list.forEach(function (f) {
        var stem = f.name.replace(/\.[^.]+$/, "");
        var side = OBV.test(stem) ? "obv" : "rev";
        var key = stem.replace(OBV, "").replace(REV, "").replace(/[-_ ]+$/, "");
        byKey[key] = byKey[key] || {};
        byKey[key][side] = f;
      });
      Object.keys(byKey).sort().forEach(function (k) { pairs.push(byKey[k]); });
    } else {
      for (var i = 0; i < list.length; i += 2) {
        pairs.push({ obv: list[i], rev: list[i + 1] || null });
      }
    }
    return pairs;
  }

  /** Create a coin per pair and upload both faces. Carries the last coin's
      context forward, since collections cluster and consecutive coins are
      usually near-identical. */
  function ingest(files) {
    var pairs = pairFiles(files);
    if (!pairs.length) { toast("No images in that drop", true); return; }

    var seed = carryForward();
    var done = 0;
    bar.progress.hidden = false;
    bar.progress.textContent = "Adding 0 of " + pairs.length + "…";

    var chain = Promise.resolve();
    pairs.forEach(function (pair) {
      chain = chain.then(function () {
        return api("POST", "/api/coin", seed).then(function (res) {
          if (!res.ok) return;
          var id = res.coin.id;
          var p = Promise.resolve();
          if (pair.obv) p = p.then(function () { return uploadFace(id, "obv", pair.obv); });
          if (pair.rev) p = p.then(function () { return uploadFace(id, "rev", pair.rev); });
          return p.then(function () {
            done++;
            bar.progress.textContent = "Adding " + done + " of " + pairs.length + "…";
          });
        });
      });
    });

    chain.then(function () {
      bar.progress.hidden = true;
      return window.Coins.reload();
    }).then(function () {
      refreshPending();
      toast(pairs.length === 1 ? "Coin added" : pairs.length + " coins added");
    });
  }

  /* ── Carry-forward ──────────────────────────────────────────────────────── */

  var CARRY_KEYS = ["era", "ruler", "mint", "mintMark", "metal", "type", "shape", "edge"];

  function rememberCarry(coin) {
    var seed = {};
    CARRY_KEYS.forEach(function (k) { if (coin[k]) seed[k] = coin[k]; });
    try { localStorage.setItem("coins:carry", JSON.stringify(seed)); } catch (e) {}
  }

  function carryForward() {
    try {
      var raw = localStorage.getItem("coins:carry");
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  /* ── Field controls ─────────────────────────────────────────────────────── */

  function V() { return window.Coins.state.vocab; }
  function look(list, id) { return window.Coins.look(list, id); }

  function optionsFor(field, coin) {
    var vocab = V()[field.vocab] || [];
    if (field.vocab === "rulers" && coin.era) {
      var byEra = vocab.filter(function (r) { return r.era === coin.era; });
      if (byEra.length) vocab = byEra;
    }
    if (field.vocab === "mints" && coin.era) {
      var m = vocab.filter(function (x) { return (x.era || []).indexOf(coin.era) !== -1; });
      if (m.length) vocab = m;
    }
    return vocab;
  }

  /**
   * Size a single-line field to what is in it. Digits are tabular here, so a
   * ch is an honest measure — the field ends up exactly as wide as the number
   * needs and no wider, whether that is 1 or 1222.
   */
  function fitWidth(el, min) {
    var text = String(el.value || el.placeholder || "");
    el.style.width = (Math.max(min || 2, text.length) + 2) + "ch";
  }

  /** Size a text area to its content, so it is never a window onto the text. */
  function autoFit(ta) {
    if (!ta.isConnected) return;
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }

  // Every text area currently on the panel, so they can all be re-measured
  // together when something that affects their height changes.
  function fitAll() {
    Array.prototype.forEach.call(
      document.querySelectorAll("#detail textarea"), autoFit);
  }

  /**
   * Keep a text area the height of its contents, whenever that becomes true.
   *
   * Measuring at a chosen moment is guesswork: on a reload the panel's width is
   * not settled, the fonts may not have arrived, and the viewer is still hidden
   * when the panel first draws — each of which makes scrollHeight answer a
   * question about a layout that is about to change. Watching the element
   * instead means the height is corrected whenever the thing it depends on
   * moves, rather than at whichever instant seemed late enough.
   */
  var fitObserver = null;

  function scheduleFit(ta) {
    requestAnimationFrame(function () { autoFit(ta); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { autoFit(ta); });
    }
    if (typeof ResizeObserver === "undefined") return;
    if (!fitObserver) {
      fitObserver = new ResizeObserver(function (entries) {
        entries.forEach(function (e) {
          var inner = e.target.querySelector("textarea");
          if (inner) autoFit(inner);
        });
      });
    }
    // Observing the parent: the width it gives the text area is what decides
    // how the text wraps, and observing the area itself would loop.
    if (ta.parentElement) fitObserver.observe(ta.parentElement);
  }

  /** Build the control for one field. onDone(value) fires when it's settled;
      onDone(undefined) means the edit was cancelled. */
  function control(coin, field, onDone) {
    var wrap = document.createElement("div");
    wrap.className = "edit-control";

    if (field.type === "select") {
      var sel = document.createElement("select");
      // Hidden so it is the placeholder rather than a choice in the list —
      // "Add" is not a metal. Not disabled: a disabled option cannot be the
      // selected one, so clearing a field left the browser to fall through to
      // the first real entry, and a cleared mint quietly became Birmingham.
      sel.innerHTML = '<option value="" hidden>Add</option>';
      optionsFor(field, coin).forEach(function (o) {
        var opt = document.createElement("option");
        opt.value = o.id;
        opt.textContent = o.label;
        if (String(coin[field.key]) === String(o.id)) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.value = coin[field.key] != null ? String(coin[field.key]) : "";
      sel.addEventListener("change", function () { onDone(sel.value || null); });
      sel.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { e.preventDefault(); onDone(undefined); }
      });
      wrap.appendChild(sel);

      return wrap;
    }

    if (field.type === "mintmark") {
      // A grid of glyphs cannot sit open in a table row, so this one field
      // keeps a trigger — styled as its own value, so it reads like the rest.
      var mm = document.createElement("div");
      mm.className = "edit-control mintmark-field";

      var trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "mintmark-trigger";
      var mark = look("mintMarks", coin.mintMark);
      trigger.innerHTML = mark
        ? '<span class="mintmark-glyph" aria-hidden="true">' +
          window.Coins.escapeHtml(mark.glyph) + "</span>" +
          window.Coins.escapeHtml(mark.label)
        : '<span class="is-placeholder">Add</span>';

      var pop = document.createElement("div");
      pop.className = "mintmark-pop";
      pop.hidden = true;
      pop.appendChild(mintMarkPicker(coin, function (v) { pop.hidden = true; onDone(v); }));

      trigger.addEventListener("click", function (e) {
        e.stopPropagation();
        pop.hidden = !pop.hidden;
      });
      pop.addEventListener("click", function (e) { e.stopPropagation(); });
      document.addEventListener("click", function () { pop.hidden = true; });

      mm.appendChild(trigger);
      mm.appendChild(pop);
      return mm;
    }

    if (field.type === "denomination") {
      var d = coin.denomination || {};
      var val = document.createElement("input");
      val.type = "number";
      val.step = "any";
      val.placeholder = "1";
      val.className = "denom-value";
      val.value = d.value != null ? d.value : "";
      setTimeout(function () { fitWidth(val, 2); }, 0);
      val.addEventListener("input", function () { fitWidth(val, 2); });

      var unit = document.createElement("select");
      unit.innerHTML = '<option value="">unit</option>';
      // Offer the era's own scale first, then the other, so a mis-set era
      // never hides the unit someone actually needs.
      var both = V().denominations;
      var primary = (coin.era === "republic-india") ? "decimal" : "pre-decimal";
      var other = primary === "decimal" ? "pre-decimal" : "decimal";
      var seen = {};
      (both[primary] || []).concat(both[other] || []).forEach(function (u) {
        if (seen[u.unit]) return;
        seen[u.unit] = 1;
        var opt = document.createElement("option");
        opt.value = u.unit;
        opt.textContent = u.label;
        if (d.unit === u.unit) opt.selected = true;
        unit.appendChild(opt);
      });

      function push() {
        if (!unit.value) return onDone(null);
        onDone({ value: val.value === "" ? null : Number(val.value), unit: unit.value });
      }
      val.addEventListener("change", push);
      unit.addEventListener("change", push);
      wrap.appendChild(val);
      wrap.appendChild(unit);
      return wrap;
    }

    // Free text wraps, so it needs a text area: a single-line input clips what
    // it cannot fit, and "Cupro-nickel five rupees (1992–2004)" simply
    // disappeared past the edge of the row.
    if (field.type === "text") {
      var ta = document.createElement("textarea");
      ta.className = "text-input";
      ta.rows = 1;
      ta.placeholder = field.placeholder || "Add";
      ta.value = coin[field.key] != null ? coin[field.key] : "";
      wrap.appendChild(ta);
      scheduleFit(ta);
      ta.addEventListener("input", function () { autoFit(ta); });
      ta.addEventListener("blur", function () {
        var v = ta.value.trim();
        if (v === String(coin[field.key] == null ? "" : coin[field.key])) return;
        onDone(v === "" ? null : v);
      });
      ta.addEventListener("keydown", function (e) {
        // One line of meaning, however many lines it takes to show.
        if (e.key === "Enter") { e.preventDefault(); ta.blur(); }
        if (e.key === "Escape") { e.preventDefault(); ta.value = coin[field.key] || ""; autoFit(ta); ta.blur(); }
      });
      return wrap;
    }

    var input = document.createElement("input");
    input.type = (field.type === "number" || field.type === "year") ? "number" : "text";
    if (field.type === "number" && field.format !== "integer") input.step = "any";
    input.placeholder = field.placeholder || "Add";
    if (field.unit) input.setAttribute("aria-label", field.label + " in " + field.unit);
    input.value = coin[field.key] != null ? coin[field.key] : "";

    var cancelled = false;
    input.addEventListener("blur", function () {
      if (cancelled) return;
      var v = input.value.trim();
      onDone(v === "" ? null : (input.type === "number" ? Number(v) : v));
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); input.blur(); }
      if (e.key === "Escape") { e.preventDefault(); cancelled = true; onDone(undefined); }
    });
    wrap.appendChild(input);
    if (field.unit) {
      var u = document.createElement("span");
      u.className = "edit-unit";
      u.textContent = field.unit;
      wrap.appendChild(u);
    }
    return wrap;
  }

  /**
   * The mint-mark picker: shows the symbols as they appear on the coin, so a
   * mark can be chosen by looking at it rather than by knowing which city a
   * star means. Naming the mint is then the tool's job, not the collector's.
   */
  function mintMarkPicker(coin, onDone) {
    var wrap = document.createElement("div");
    wrap.className = "mintmark-picker";

    V().mintMarks.forEach(function (mark) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mintmark-choice" + (coin.mintMark === mark.id ? " is-active" : "");

      // Only suggest mints that make sense for the era already recorded.
      var eraMints = (mark.mints || []).filter(function (id) {
        var m = look("mints", id);
        return !coin.era || !m || (m.era || []).indexOf(coin.era) !== -1;
      });
      var shown = (eraMints.length ? eraMints : (mark.mints || [])).map(function (id) {
        var m = look("mints", id);
        return m ? m.label : id;
      });

      b.innerHTML =
        '<span class="glyph">' + window.Coins.escapeHtml(mark.glyph) + "</span>" +
        '<span class="mark-label">' + window.Coins.escapeHtml(mark.label) + "</span>" +
        '<span class="mark-mint">' + window.Coins.escapeHtml(shown.join(" / ")) + "</span>";

      b.addEventListener("click", function () {
        var out = { mintMark: mark.id };
        // One unambiguous mint for this era? Fill it in too — that's the whole
        // point of being able to pick by symbol.
        if (eraMints.length === 1) out.mint = eraMints[0];
        onDone(out);
      });
      wrap.appendChild(b);
    });

    var clear = document.createElement("button");
    clear.type = "button";
    clear.className = "mintmark-choice is-clear";
    clear.textContent = "Clear";
    clear.addEventListener("click", function () { onDone({ mintMark: null }); });
    wrap.appendChild(clear);

    return wrap;
  }

  /* ── Decorating the detail panel ────────────────────────────────────────── */

  function fieldByKey(key) {
    var f = V().fields.filter(function (x) { return x.key === key; });
    return f[0] || null;
  }

  /** Put a live control in the row, in place of the rendered value. */
  function mountControl(coin, field, host) {
    var ctrl = control(coin, field, function (value) {
      if (value === undefined) return;              // cancelled
      var body = {};
      if (field.type === "mintmark") body = value;  // may set the mint too
      else body[field.key] = value;
      var merged = {};
      Object.keys(coin).forEach(function (k) { merged[k] = coin[k]; });
      Object.keys(body).forEach(function (k) { merged[k] = body[k]; });
      rememberCarry(merged);
      patch(coin.id, body);
    });
    host.textContent = "";
    host.appendChild(ctrl);
  }

  /** The note, as a text area that looks like the paragraph it replaces. */
  function mountNotes(coin, host) {
    if (!host) return;
    host.hidden = false;
    host.classList.add("is-editable");
    host.textContent = "";

    var ta = document.createElement("textarea");
    ta.className = "notes-input";
    ta.value = coin.notes || "";
    ta.placeholder = "Where it came from, what is on it, why it matters…";
    ta.rows = 1;
    host.appendChild(ta);

    ta.addEventListener("input", function () { autoFit(ta); });
    scheduleFit(ta);

    ta.addEventListener("blur", function () {
      if ((coin.notes || "") === ta.value.trim()) return;
      patch(coin.id, { notes: ta.value.trim() || null });
    });
    ta.addEventListener("keydown", function (e) {
      if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        ta.blur();
      }
    });
  }

  function decorateDetail(coin) {
    var panel = document.getElementById("detail");
    if (!panel) return;

    // Every field is live. Editing is not a mode a field enters when clicked —
    // the page is already in it, so a control that has to be summoned is one
    // more step between having a fact and recording it. They are styled as the
    // finished page and only show themselves on hover and focus.
    Array.prototype.forEach.call(panel.querySelectorAll(".spec"), function (row) {
      var field = fieldByKey(row.dataset.key);
      if (!field) return;
      var dd = row.querySelector("dd");
      row.classList.add("is-editable");
      mountControl(coin, field, dd);

      // Clearing a field is distinct from blanking it, and there is nothing to
      // clear on one that has no value yet.
      if (row.classList.contains("is-empty")) return;
      var del = document.createElement("button");
      del.type = "button";
      del.className = "spec-remove";
      del.title = "Clear this detail";
      del.setAttribute("aria-label", "Clear " + field.label);
      // The same cross Discard wears, so clearing looks like clearing wherever
      // it happens.
      del.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" ' +
        'stroke-width="1.9" stroke-linecap="round">' +
        '<path d="M7 7l10 10"/><path d="M17 7L7 17"/></svg>';
      del.addEventListener("click", function (e) {
        e.stopPropagation();
        var body = {};
        body[field.key] = null;
        patch(coin.id, body);
      });
      row.appendChild(del);
    });

    // The note, likewise: a text area wearing the prose it holds.
    mountNotes(coin, document.getElementById("detail-notes"));

    var tools = document.createElement("div");
    tools.className = "edit-tools";

    var del = barButton("trash", "Delete coin", "eb-danger");
    del.addEventListener("click", function () {
      if (!confirm("Delete this coin and both its photographs?")) return;
      api("DELETE", "/api/coin/" + encodeURIComponent(coin.id)).then(function (res) {
        if (!res.ok) { toast(res.error || "Could not delete", true); return; }
        window.Viewer.close();
        window.Coins.reload().then(refreshPending);
        toast("Coin deleted");
      });
    });
    tools.appendChild(del);

    document.getElementById("detail-specs").appendChild(tools);
  }

  /* ── Photo drop targets ─────────────────────────────────────────────────── */

  /** Keep the controls on each face in step with the coin on screen. */
  function refreshLead() {
    var coin = window.Viewer.current();
    if (!coin) return;
    var lead = window.Coins.primaryFace(coin);

    Array.prototype.forEach.call(document.querySelectorAll(".face-edit"), function (el) {
      var f = el.dataset.face;
      if (!f) return;
      var has = window.Coins.hasImage(coin, f);
      var side = f === "obv" ? "obverse" : "reverse";
      var word = el.querySelector("span");
      if (word) word.textContent = has ? "Edit" : "Add";
      el.title = (has ? "Replace" : "Add") + " this photograph";
      el.setAttribute("aria-label", (has ? "Replace" : "Add") + " the " + side + " photograph");
    });

    Array.prototype.forEach.call(document.querySelectorAll(".face-star"), function (el) {
      var f = el.dataset.face;
      if (!f) return;
      var on = lead === f;
      var side = f === "obv" ? "obverse" : "reverse";
      el.classList.toggle("is-on", on);
      el.disabled = on || !window.Coins.hasImage(coin, f);
      el.title = on ? "Shown in the collection" : "Show this side in the collection";
      el.setAttribute("aria-label", on
        ? "The " + side + " is shown in the collection"
        : "Show the " + side + " in the collection");
    });
  }

  /**
   * The controls that live on each photograph. Called on every render and
   * guarded per control, so they cannot go missing: attaching them once meant
   * any path that reached the viewer without passing through here left the
   * photographs bare.
   */
  function addFaceControls(frame) {
    // Where the thing it acts on is — the side you clicked is the side
    // you meant, so neither control needs a label naming it. The pair
    // of buttons underneath sat a long way from either face and had to name
    // which side they meant; here that is simply where you clicked.
    [["obv", "Obverse"], ["rev", "Reverse"]].forEach(function (pair) {
      var faceEl = frame.querySelector(".face-" + pair[0]);
      if (!faceEl || faceEl.querySelector(".face-tools")) return;

      // Both controls in one cluster rather than a corner each: they act on the
      // same photograph, and split apart they read as two unrelated things
      // pinned to opposite ends of it.
      var tools = document.createElement("div");
      tools.className = "face-tools";
      faceEl.appendChild(tools);

      var label = document.createElement("label");
      // Shares the bar's button language, so a control is a control wherever
      // it appears.
      label.className = "face-edit eb";
      label.dataset.face = pair[0];
      label.setAttribute("aria-label", "Replace the " + pair[1].toLowerCase() + " photograph");
      label.title = "Replace this photograph";
      label.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M14.5 6.5l3 3"/></svg>' +
        '<span>Edit</span>';

      var input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.addEventListener("change", function () {
        var coin = window.Viewer.current();
        if (!coin || !input.files.length) return;
        uploadFace(coin.id, pair[0], input.files[0]).then(function (f) {
          if (f) toast(pair[1] + " replaced");
          input.value = "";
        });
      });
      label.appendChild(input);
      // The face beneath opens the photograph or turns the coin over.
      label.addEventListener("click", function (e) { e.stopPropagation(); });
      tools.appendChild(label);

      // Which side the collection shows. A coin's denomination is not always
      // on the same face — the 1988 minors carry it beside the Lion Capital,
      // the rupees on the reverse — so it is a judgement made by looking, and
      // the place to make it is on the photograph you are looking at.
      var star = document.createElement("button");
      star.type = "button";
      star.className = "face-star";
      star.dataset.face = pair[0];
      star.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M12 4.6l2.2 4.5 5 .7-3.6 3.5.85 4.95L12 15.9l-4.45 2.35.85-4.95L4.8 9.8l5-.7z"/>' +
        "</svg>";
      star.addEventListener("click", function (e) {
        e.stopPropagation();
        var coin = window.Viewer.current();
        if (!coin) return;
        patch(coin.id, { leadFace: pair[0] });
      });
      tools.insertBefore(star, label);
    });
  }

  function decorateStage() {
    var frame = document.getElementById("stage-frame");
    if (!frame) return;
    addFaceControls(frame);            // checked every render, not just once
    if (frame.dataset.editReady === "1") return;
    frame.dataset.editReady = "1";

    // The face toggle doesn't re-render the panel, so hook it directly.
    ["btn-obv", "btn-rev"].forEach(function (id) {
      document.getElementById(id).addEventListener("click", function () {
        setTimeout(refreshLead, 0);
      });
    });

    ["dragenter", "dragover"].forEach(function (ev) {
      frame.addEventListener(ev, function (e) { e.preventDefault(); frame.classList.add("is-drop"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      frame.addEventListener(ev, function () { frame.classList.remove("is-drop"); });
    });
    frame.addEventListener("drop", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var coin = window.Viewer.current();
      if (!coin || !e.dataTransfer.files.length) return;
      // With both faces on show, the one you dropped on is the one you meant.
      var onFace = e.target && e.target.closest ? e.target.closest(".face") : null;
      var showing = onFace
        ? (onFace.classList.contains("face-rev") ? "rev" : "obv")
        : (document.getElementById("btn-rev").classList.contains("is-active") ? "rev" : "obv");
      uploadFace(coin.id, showing, e.dataTransfer.files[0]).then(function (f) {
        if (f) toast((showing === "obv" ? "Obverse" : "Reverse") + " replaced");
      });
    });


  }

  /* ── Grid affordances ───────────────────────────────────────────────────── */

  /**
   * Mark coins in the grid that have been edited since the last save, so work
   * in progress is visible without opening anything — otherwise the only way
   * to find what you had changed was to remember.
   */
  function markUnsaved() {
    var grid = document.getElementById("grid");
    if (!grid) return;
    Array.prototype.forEach.call(grid.querySelectorAll(".coin[data-id]"), function (li) {
      var on = !!unsavedIds[String(li.dataset.id)];
      li.classList.toggle("has-unsaved", on);
      var pill = li.querySelector(".coin-unsaved");
      if (on && !pill) {
        var cap = li.querySelector(".coin-caption");
        if (!cap) return;
        var tag = document.createElement("span");
        tag.className = "coin-unsaved";
        tag.textContent = "Unsaved";
        cap.appendChild(tag);
      } else if (!on && pill) {
        pill.remove();
      }
    });
  }

  /**
   * Which fields and which faces are unsaved, per coin — the same working diff
   * the history panel reads, so the grid, the timeline and the detail panel all
   * describe the change the same way.
   */
  function loadUnsavedDetail() {
    if (!Object.keys(unsavedIds).length) {
      unsavedDetail = {};
      markUnsavedDetail();
      return;
    }
    fetch("/api/history/diff?to=WORKING", { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        unsavedDetail = {};
        (d.changed || []).forEach(function (c) {
          var f = {}, ph = {};
          (c.fields || []).forEach(function (x) { f[x.key] = true; });
          (c.photos || []).forEach(function (x) { ph[x.face] = true; });
          unsavedDetail[String(c.id)] = { fields: f, photos: ph, whole: false };
        });
        // A coin added since the last save is unsaved in its entirety.
        (d.added || []).forEach(function (c) {
          unsavedDetail[String(c.id)] = { fields: {}, photos: {}, whole: true };
        });
        markUnsavedDetail();
      });
  }

  /** Mark the rows and faces of the coin currently open. */
  function markUnsavedDetail() {
    var coin = window.Viewer && window.Viewer.current();
    if (!coin) return;
    var u = unsavedDetail[String(coin.id)];

    Array.prototype.forEach.call(document.querySelectorAll("#detail .spec"), function (row) {
      var changed = !!(u && (u.whole || u.fields[row.dataset.key]));
      row.classList.toggle("is-unsaved", changed);
      // The mark is a colour and a bar, so say it for anyone not seeing either.
      var dt = row.querySelector("dt");
      if (dt) dt.title = changed ? "Unsaved" : "";
    });
    [["obv", "btn-obv"], ["rev", "btn-rev"]].forEach(function (pair) {
      var b = document.getElementById(pair[1]);
      if (b) b.classList.toggle("is-unsaved", !!(u && (u.whole || u.photos[pair[0]])));
    });

    // The note is not a row in the table and has no label to hang a mark on,
    // so it was the one edit that left no trace.
    var notes = document.getElementById("detail-notes");
    if (notes) {
      var noteChanged = !!(u && (u.whole || u.fields.notes));
      notes.classList.toggle("is-unsaved", noteChanged);
      notes.title = noteChanged ? "Unsaved" : "";
    }
  }

  function decorateGrid() {
    var grid = document.getElementById("grid");
    if (!grid || grid.querySelector(".coin-add")) return;

    var li = document.createElement("li");
    li.className = "coin coin-add is-in";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "coin-add-btn";
    // Same shape as a coin tile — disc, then caption — so the two line up.
    // Dropping photographs anywhere still works; it just isn't captioned, since
    // the whole-page drop target announces itself the moment you drag a file.
    btn.innerHTML = '<span class="coin-add-disc" aria-hidden="true">+</span>' +
                    '<span class="coin-caption">' +
                      '<span class="coin-add-label">Add a coin</span>' +
                    '</span>';

    var picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*";
    picker.multiple = true;
    picker.hidden = true;
    picker.addEventListener("change", function () {
      if (picker.files.length) ingest(picker.files);
      picker.value = "";
    });

    btn.addEventListener("click", function () { picker.click(); });
    li.appendChild(btn);
    li.appendChild(picker);
    grid.insertBefore(li, grid.firstChild);
    markUnsaved();
  }

  function bindPageDrop() {
    var overlay = document.createElement("div");
    overlay.className = "drop-overlay";
    overlay.innerHTML = "<p>Drop photos to add coins</p>" +
      '<p class="sub">Files named …-obv and …-rev are paired automatically</p>';
    document.body.appendChild(overlay);

    function viewerOpen() { return !document.getElementById("viewer").hidden; }

    var depth = 0;
    window.addEventListener("dragenter", function (e) {
      if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types, "Files") === -1) return;
      if (viewerOpen()) return;   // a drop there is aimed at one coin's face
      depth++;
      overlay.classList.add("is-on");
    });
    window.addEventListener("dragleave", function () {
      depth = Math.max(0, depth - 1);
      if (depth === 0) overlay.classList.remove("is-on");
    });
    window.addEventListener("dragover", function (e) { e.preventDefault(); });
    window.addEventListener("drop", function (e) {
      e.preventDefault();
      depth = 0;
      overlay.classList.remove("is-on");
      if (viewerOpen()) return;
      if (e.dataTransfer.files.length) ingest(e.dataTransfer.files);
    });
  }

  /* ── Publish bar ────────────────────────────────────────────────────────── */

  var ICON = {
    history: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/></svg>',
    discard: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11"/><path d="M17.5 6.5l-11 11"/></svg>',
    save:    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5l5 5 10-11"/></svg>',
    publish: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19.5V5.5"/><path d="M5.5 12L12 5.5 18.5 12"/></svg>',
    trash:   '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15"/>' +
             '<path d="M9.5 7V5.4h5V7"/><path d="M6.6 7l.8 11.9h9.2L17.4 7"/></svg>'
  };

  function barButton(kind, label, cls) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "eb " + (cls || "");
    b.innerHTML = ICON[kind] + "<span>" + label + "</span>";
    return b;
  }

  /**
   * The bar answers one question: what is there to do next?
   *
   * It used to lead with "Editing locally" and the branch name, neither of
   * which tells anyone anything — the bar only exists while editing, and the
   * branch is an implementation detail. What is left is the state of the work
   * and the action that follows from it, which changes as the work does:
   * unsaved work offers Save, saved work offers Publish, and published work
   * offers nothing but a way to look back.
   */
  /**
   * Editing hangs its controls on the bar the page already has, rather than
   * bringing a second one. Navigation stays on the left where it always is;
   * the state of the work and the actions that follow from it go to the right.
   */
  function buildBar() {
    var root = document.getElementById("topbar");
    var lead = root && root.querySelector(".topbar-lead");
    var tail = document.getElementById("topbar-tail");
    if (!root || !lead || !tail) return;

    var histBtn = barButton("history", "History", "eb-quiet");
    histBtn.addEventListener("click", function () {
      if (window.CoinHistory) window.CoinHistory.show();
    });
    lead.appendChild(histBtn);

    tail.innerHTML =
      '<span class="editbar-state">' +
        '<span class="editbar-dot" aria-hidden="true"></span>' +
        '<span class="editbar-text"></span>' +
      '</span>' +
      '<span class="editbar-progress" hidden></span>' +
      '<span class="editbar-rule" aria-hidden="true"></span>' +
      '<div class="editbar-actions"></div>';

    var actions = tail.querySelector(".editbar-actions");

    var discard = barButton("discard", "Discard", "eb-danger");
    discard.addEventListener("click", onDiscard);

    var save = barButton("save", "Save", "eb-primary");
    save.addEventListener("click", function () {
      save.disabled = true;
      api("POST", "/api/commit", {}).then(function (res) {
        if (!res.ok) toast(res.error || "Could not save", true);
        else toast("Saved");
        refreshPending();
        refreshHistory();
      });
    });

    var publish = barButton("publish", "Publish", "eb-go");
    publish.addEventListener("click", function () {
      publish.disabled = true;
      goLive(pending, function (ok) { if (!ok) refreshPending(); });
    });

    // Disabled until the status says otherwise: the bar should not offer an
    // action it has not checked.
    [discard, save, publish].forEach(function (b) {
      b.disabled = true;
      actions.appendChild(b);
    });

    bar = {
      root: root,
      dot: tail.querySelector(".editbar-dot"),
      text: tail.querySelector(".editbar-text"),
      progress: tail.querySelector(".editbar-progress"),
      actions: actions,
      discard: discard, save: save, publish: publish
    };
  }

  /** Merge the collection into the published branch and push. */
  function goLive(preview, done) {
    var msg;
    if (preview.collectionSteps) {
      msg = "Publish " + preview.collectionSteps +
            (preview.collectionSteps === 1 ? " change" : " changes") + " to the collection?" +
            "\n\nThis makes them visible to anyone at garvitgupta.com/coins/.";
    } else {
      msg = "Publish " + preview.siteChanges +
            (preview.siteChanges === 1 ? " update" : " updates") + " to the site?" +
            "\n\nThe coins themselves are already up to date.";
    }
    msg += "\n\nThe site updates about a minute afterwards.";
    if (!confirm(msg)) { if (done) done(false); return; }

    api("POST", "/api/golive", {}).then(function (res) {
      if (!res.ok) { toast(res.error || "Could not publish", true); if (done) done(false); return; }
      toast("Published — the site updates in about a minute");
      refreshPending();
      refreshHistory();
      if (done) done(true);
    });
  }

  // history.js drives the same action from its own button.
  window.CoinsEdit = { goLive: goLive, refresh: function () { refreshPending(); } };

  /* ── Boot ───────────────────────────────────────────────────────────────── */

  function start() {
    document.body.classList.add("is-editing");
    // Every field, filled or not, renders in its proper place while editing.
    window.Coins.showEmptyFields(true);

    ["css/edit.css", "css/history.css"].forEach(function (href) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    });

    var hist = document.createElement("script");
    hist.src = "js/history.js";
    hist.onload = function () {
      if (window.Coins.wantedView() === "history" && window.CoinHistory) {
        window.CoinHistory.show();
      }
    };
    document.head.appendChild(hist);

    buildBar();
    bindPageDrop();
    decorateGrid();
    refreshPending();

    // A narrower panel wraps the text further, which makes it taller.
    window.addEventListener("resize", fitAll);

    window.Coins.onChange(decorateGrid);
    document.addEventListener("coins:restored", refreshPending);
    document.addEventListener("viewer:rendered", function (e) {
      decorateStage();
      decorateDetail(e.detail.coin);
      refreshLead();
      markUnsavedDetail();
    });

    // Opening the page on a coin draws the panel before this listener exists:
    // edit mode only starts once the ping has answered, by which time a coin
    // named in the address bar has already been rendered. Draw it again now
    // that there is something to decorate it with.
    if (window.Viewer && window.Viewer.currentId()) window.Viewer.rerender();

    console.log("[coins] edit mode on — served by tools/coins.py");
  }

  document.addEventListener("coins:ready", function () {
    // The only thing distinguishing local from published. On GitHub Pages this
    // 404s and edit mode never wakes up.
    fetch("/api/ping", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (res) { if (res && res.ok) start(); })
      .catch(function () { /* published site — stay read-only */ });
  });
})();
