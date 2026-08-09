/* ============================================================================
   The Coin Collection — catalogue, grid, filtering, routing.

   Exposes a small `Coins` namespace that viewer.js and edit.js build on.

   The governing rule throughout: a field that isn't known simply isn't shown.
   Nothing renders "Unknown", nothing renders an empty row, and nothing treats
   a missing year as 0. A coin with three known facts should look deliberate,
   not broken — most of this collection is half-documented.
   ========================================================================= */

window.Coins = (function () {
  "use strict";

  var state = {
    all: [],        // every coin, in file order
    view: [],       // after filtering + sorting
    vocab: null,
    filters: {},    // facetKey -> Set of selected values
    sort: "year-desc"
  };

  var listeners = [];
  var el = {};

  // Edit mode shows every field, including the ones this coin has no value
  // for, so they can be filled where they belong instead of being hunted for
  // in a menu. The published site never sets this, so a half-known coin still
  // shows only what is known.
  var showEmpty = false;
  var wantedView = null;   // "history", when the address bar asks for it

  /* ── Vocabulary lookup ──────────────────────────────────────────────────── */

  var vocabIndex = {};

  function indexVocab(v) {
    ["eras", "rulers", "mints", "mintMarks", "metals", "edges",
     "shapes", "grades", "types", "dieAxes", "groups"].forEach(function (list) {
      vocabIndex[list] = {};
      (v[list] || []).forEach(function (item) { vocabIndex[list][item.id] = item; });
    });
  }

  function look(list, id) {
    return (vocabIndex[list] && vocabIndex[list][id]) || null;
  }

  function labelOf(list, id) {
    var item = look(list, id);
    return item ? item.label : id;
  }

  /* ── Formatting ─────────────────────────────────────────────────────────── */

  var FRACTIONS = { 0.25: "¼", 0.5: "½", 0.75: "¾", 0.125: "⅛" };

  function num(n) {
    if (n === null || n === undefined || n === "") return null;
    return FRACTIONS[n] || String(n);
  }

  function unitLabel(unit, value) {
    var map = {
      "pie": "Pie", "pice": "Pice", "anna": "Anna", "rupee": "Rupee",
      "paise": "Paise", "naya-paisa": "Naya Paisa"
    };
    var base = map[unit] || unit;
    // Annas and rupees pluralise; paise and pie are already plural in use.
    if (value > 1 && (unit === "anna" || unit === "rupee" || unit === "pice")) base += "s";
    return base;
  }

  /** "1 Rupee", "½ Anna" — or null when the denomination isn't known. */
  function denomLabel(coin) {
    var d = coin.denomination;
    if (!d || !d.unit) return null;
    var v = num(d.value);
    return v ? v + " " + unitLabel(d.unit, d.value) : unitLabel(d.unit, d.value);
  }

  /** The coin's display name. Never empty — falls back through what exists. */
  function title(coin) {
    if (coin.title) return coin.title;
    var d = denomLabel(coin);
    if (d) return d;
    if (coin.km) return coin.km;
    if (coin.era) return labelOf("eras", coin.era) + " coin";
    return "Unidentified coin";
  }

  /** The year to sort and group by. Null when genuinely unknown. */
  function year(coin) {
    var y = coin.yearOnCoin != null ? coin.yearOnCoin : coin.yearIssued;
    return (y === null || y === undefined || y === "") ? null : Number(y);
  }

  function decade(coin) {
    var y = year(coin);
    return y === null ? null : String(Math.floor(y / 10) * 10) + "s";
  }

  /** Secondary line under a coin in the grid. Joins only what exists. */
  function subtitle(coin) {
    var bits = [];
    if (coin.ruler) bits.push(labelOf("rulers", coin.ruler));
    else if (coin.era) bits.push(labelOf("eras", coin.era));
    var y = year(coin);
    if (y !== null) bits.push(y);
    return bits.join("  ·  ");
  }

  // The catalogue and its photographs live in collection/ — the database,
  // kept separate from the code that draws the page so that edit mode's
  // Publish and Discard can only ever touch data.
  var DB = "collection/";

  // A replaced photograph keeps its filename — 0005-obv.webp is always
  // 0005-obv.webp — so nothing about the URL tells the browser the picture
  // changed, and assigning an identical src does not even reload it. Edit mode
  // stamps a token here when it uploads, which is the only thing that makes a
  // new photograph appear without a manual refresh. The published site never
  // sets one, so its URLs stay clean and cacheable.
  var busts = {};

  function imgSrc(coin, face, size) {
    var file = coin.images && coin.images[face];
    if (!file) return null;
    var url = DB + "images/" + size + "/" + file;
    var v = busts[String(coin.id)];
    return v ? url + "?v=" + v : url;
  }

  function hasImage(coin, face) { return !!(coin.images && coin.images[face]); }

  /**
   * The face to lead with, in the grid and when the viewer opens.
   *
   * Defaults to the obverse, but `leadFace` overrides it per coin. That's
   * needed because the denomination isn't always on the same side: on the 1988
   * stainless-steel minors the numeral shares the obverse with the Lion
   * Capital, while on the rupees it's on the reverse. Leading with whichever
   * face carries the number is what makes a grid of them scannable.
   */
  function primaryFace(coin) {
    var want = coin.leadFace;
    if (want && hasImage(coin, want)) return want;
    return hasImage(coin, "obv") ? "obv" : (hasImage(coin, "rev") ? "rev" : null);
  }

  /* ── Spec table ─────────────────────────────────────────────────────────── */

  /** Format one field for display, or return null if it shouldn't be shown. */
  function formatField(coin, field) {
    var raw = coin[field.key];
    if (raw === null || raw === undefined || raw === "") return null;

    switch (field.type) {
      case "select":
        return escapeHtml(labelOf(field.vocab, raw));

      case "denomination":
        return escapeHtml(denomLabel(coin) || "");

      case "year":
        return escapeHtml(String(raw));

      case "mintmark": {
        var mark = look("mintMarks", raw);
        if (!mark) return escapeHtml(String(raw));
        return '<span class="mintmark-glyph" aria-hidden="true">' + escapeHtml(mark.glyph) +
               "</span>" + escapeHtml(mark.label);
      }

      case "number": {
        if (field.format === "integer") return Number(raw).toLocaleString("en-GB");
        if (field.format === "fineness") {
          // .500 reads as a silver fineness in a way 0.5 does not.
          return "." + String(Math.round(Number(raw) * 1000)).padStart(3, "0");
        }
        return escapeHtml(String(raw)) + (field.unit ? " " + field.unit : "");
      }

      default:
        return escapeHtml(String(raw));
    }
  }

  /**
   * Grouped spec rows for a coin — present fields only.
   * Returns [{ id, label, rows: [{key, label, html}] }], groups with no rows
   * dropped entirely so the panel never shows an empty heading.
   */
  function specs(coin) {
    var v = state.vocab;
    if (!v) return [];
    var byGroup = {};

    v.fields.forEach(function (field) {
      // Ruler is meaningless on a Republic coin — don't offer or show it.
      if (field.onlyEra && coin.era && field.onlyEra.indexOf(coin.era) === -1) return;
      var html = formatField(coin, field);
      if (html === null && !showEmpty) return;
      // A gloss from the vocabulary, where the chosen value has one — what a
      // die axis means, which mint a star stands for. This belongs to the coin,
      // not to editing it: a visitor who does not collect coins needs it more
      // than the person filling the record in.
      var chosen = field.vocab ? look(field.vocab, coin[field.key]) : null;

      (byGroup[field.group] = byGroup[field.group] || []).push({
        key: field.key, label: field.label,
        html: html === null ? "" : html,
        empty: html === null,
        note: (chosen && chosen.note) || null
      });
    });

    return v.groups.map(function (g) {
      return { id: g.id, label: g.label, rows: byGroup[g.id] || [] };
    }).filter(function (g) { return g.rows.length > 0; });
  }

  /* ── Facets ─────────────────────────────────────────────────────────────── */

  // Each facet pulls a value (or null) off a coin. Null means "not known",
  // which is a bucket of its own rather than a match for anything.
  var FACETS = [
    { key: "era",    label: "Era",          get: function (c) { return c.era; },    fmt: function (v) { return labelOf("eras", v); } },
    { key: "ruler",  label: "Ruler",        get: function (c) { return c.ruler; },  fmt: function (v) { return labelOf("rulers", v); } },
    { key: "mint",   label: "Mint",         get: function (c) { return c.mint; },   fmt: function (v) { return labelOf("mints", v); } },
    { key: "metal",  label: "Metal",        get: function (c) { return c.metal; },  fmt: function (v) { return labelOf("metals", v); } },
    { key: "decade", label: "Decade",       get: decade,                            fmt: function (v) { return v; } },
    { key: "unit",   label: "Denomination", get: function (c) { return c.denomination && c.denomination.unit; },
      fmt: function (v) { return unitLabel(v, 2); } },
    { key: "shape",  label: "Shape",        get: function (c) { return c.shape; },  fmt: function (v) { return labelOf("shapes", v); } }
  ];

  /** Every value this facet takes anywhere in the collection. */
  function facetValues(facet) {
    var seen = {};
    state.all.forEach(function (c) {
      if (c.status === "draft") return;
      var v = facet.get(c);
      if (v === null || v === undefined || v === "") return;
      seen[v] = true;
    });
    return Object.keys(seen);
  }

  /** Count coins per value for one facet, against everything the OTHER facets
      allow — so counts reflect what clicking would actually give you. */
  function facetCounts(facet) {
    var pool = state.all.filter(function (c) {
      return c.status !== "draft" && matches(c, facet.key);
    });
    var counts = {};
    pool.forEach(function (c) {
      var v = facet.get(c);
      if (v === null || v === undefined || v === "") return;
      counts[v] = (counts[v] || 0) + 1;
    });
    return counts;
  }

  /** Does this coin pass the active filters (optionally ignoring one facet)? */
  function matches(coin, ignoreKey) {
    return FACETS.every(function (facet) {
      if (facet.key === ignoreKey) return true;
      var sel = state.filters[facet.key];
      if (!sel || sel.size === 0) return true;
      var v = facet.get(coin);
      return v != null && sel.has(String(v));
    });
  }

  /* ── Sorting ────────────────────────────────────────────────────────────── */

  // Coins with no known year sort to the end regardless of direction —
  // an unknown year is not the year zero.
  function byYear(dir) {
    return function (a, b) {
      var ya = year(a), yb = year(b);
      if (ya === null && yb === null) return 0;
      if (ya === null) return 1;
      if (yb === null) return -1;
      return dir === "asc" ? ya - yb : yb - ya;
    };
  }

  // Rank denominations against each other by converting to a common base.
  // Pre-decimal: 1 rupee = 16 annas = 64 pice = 192 pies. The decimal scale is
  // multiplied so a 1957 rupee and an 1862 rupee land in the same place.
  var IN_PIES = { pie: 1, pice: 3, anna: 12, rupee: 192 };
  var IN_PAISE = { "naya-paisa": 1, paise: 1, rupee: 100 };
  var PRE_DECIMAL_ERAS = ["british-india", "east-india-company", "princely-state"];

  function denomRank(coin) {
    var d = coin.denomination;
    if (!d || !d.unit || d.value == null) return null;
    var preDecimal = PRE_DECIMAL_ERAS.indexOf(coin.era) !== -1;
    if (preDecimal && IN_PIES[d.unit] !== undefined) return d.value * IN_PIES[d.unit];
    if (IN_PAISE[d.unit] !== undefined) return d.value * IN_PAISE[d.unit] * 1.92;
    if (IN_PIES[d.unit] !== undefined) return d.value * IN_PIES[d.unit];
    return null;
  }

  var SORTS = {
    "year-desc": byYear("desc"),
    "year-asc": byYear("asc"),
    "denomination": function (a, b) {
      var ra = denomRank(a), rb = denomRank(b);
      if (ra === null && rb === null) return 0;
      if (ra === null) return 1;
      if (rb === null) return -1;
      return ra - rb;
    },
    // Ids are issued in order and never reused, so id order is the order coins
    // were added — exactly, and without a date to keep.
    "added": function (a, b) {
      return (parseInt(b.id, 10) || 0) - (parseInt(a.id, 10) || 0);
    }
  };

  function apply() {
    state.view = state.all
      .filter(function (c) { return c.status !== "draft"; })
      .filter(function (c) { return matches(c); })
      .sort(SORTS[state.sort] || SORTS["year-desc"]);
    renderGrid();
    renderFilters();
    renderCount();
    writeHash();
    listeners.forEach(function (fn) { fn(); });
  }

  /* ── Rendering ──────────────────────────────────────────────────────────── */

  var io = null;

  function observe(node) {
    if (!io) {
      if (!("IntersectionObserver" in window)) { node.classList.add("is-in"); return; }
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        });
      }, { rootMargin: "120px" });
    }
    io.observe(node);
  }

  function coinNode(coin, index) {
    var li = document.createElement("li");
    li.className = "coin";
    li.dataset.id = coin.id;
    li.dataset.sig = tileSignature(coin);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "coin-btn";

    var disc = document.createElement("div");
    disc.className = "coin-disc";

    var face = primaryFace(coin);
    if (face) {
      var img = document.createElement("img");
      img.src = imgSrc(coin, face, "thumbs");
      img.alt = title(coin) + ", " + (face === "obv" ? "obverse" : "reverse");
      img.loading = index < 12 ? "eager" : "lazy";
      img.decoding = "async";
      img.addEventListener("load", function () { img.classList.add("is-loaded"); });
      if (img.complete) img.classList.add("is-loaded");
      disc.appendChild(img);
    } else {
      var ph = document.createElement("div");
      ph.className = "coin-missing";
      ph.textContent = "No photo";
      disc.appendChild(ph);
    }

    var cap = document.createElement("span");
    cap.className = "coin-caption";
    var name = document.createElement("span");
    name.className = "coin-name";
    name.textContent = title(coin);
    cap.appendChild(name);

    var sub = subtitle(coin);
    if (sub) {
      var meta = document.createElement("span");
      meta.className = "coin-meta";
      meta.textContent = sub;
      cap.appendChild(meta);
    }

    btn.appendChild(disc);
    btn.appendChild(cap);
    btn.addEventListener("click", function () { openCoin(coin.id); });
    li.appendChild(btn);

    observe(li);
    return li;
  }

  /** What a tile is showing, so a reused one can be checked against the coin. */
  function tileSignature(coin) {
    var face = primaryFace(coin);
    return [title(coin), subtitle(coin), face, face ? imgSrc(coin, face, "thumbs") : ""].join("|");
  }

  /**
   * Draw the grid, keeping the tiles that are already on screen.
   *
   * Rebuilding it wholesale meant every coin faded in again on every filter,
   * including the ones that had not moved — so narrowing a search made the
   * coins you were looking at flicker and re-enter, which reads as the whole
   * page reloading rather than as a few coins leaving.
   */
  function renderGrid() {
    var existing = {};
    Array.prototype.forEach.call(el.grid.children, function (node) {
      if (node.dataset && node.dataset.id) existing[node.dataset.id] = node;
    });

    var frag = document.createDocumentFragment();
    state.view.forEach(function (coin, i) {
      var id = String(coin.id);
      var node = existing[id];
      // Reuse it only if it is still showing the same thing; an edited coin
      // needs redrawing, a merely re-filtered one does not.
      if (node && node.dataset.sig === tileSignature(coin)) {
        delete existing[id];
        frag.appendChild(node);      // moved, not rebuilt: no animation
        return;
      }
      frag.appendChild(coinNode(coin, i));
    });

    // Anything left in `existing` is no longer in view.
    Object.keys(existing).forEach(function (id) { existing[id].remove(); });
    el.grid.textContent = "";
    el.grid.appendChild(frag);

    var none = state.view.length === 0;
    el.empty.hidden = !none;
    if (none) {
      el.empty.textContent = state.all.length === 0
        ? "The collection is empty — no coins have been catalogued yet."
        : "No coins match those filters.";
    }
  }

  function renderCount() {
    var total = state.all.filter(function (c) { return c.status !== "draft"; }).length;
    var shown = state.view.length;
    if (total === 0) { el.count.textContent = ""; return; }
    el.count.textContent = shown === total
      ? total + (total === 1 ? " coin" : " coins")
      : shown + " of " + total + " coins";
  }

  function renderFilters() {
    var frag = document.createDocumentFragment();
    var anyActive = false;

    FACETS.forEach(function (facet) {
      var counts = facetCounts(facet);
      // Every value the collection holds, not only those still reachable. An
      // option that disappears takes its information with it: you cannot tell
      // whether the collection has no silver coins or whether your other
      // choices have ruled them out, and the list moves under the cursor as
      // you tick things.
      var values = facetValues(facet);
      var sel = state.filters[facet.key] || new Set();
      // A facet nobody's data distinguishes on is just noise.
      if (values.length < 2 && !sel.size) return;
      if (sel.size) anyActive = true;

      var group = document.createElement("section");
      group.className = "facet";

      var title = document.createElement("h3");
      title.className = "facet-title";
      title.textContent = facet.label;
      group.appendChild(title);

      values.sort(function (x, y) {
        if (facet.key === "decade") return x.localeCompare(y);
        return (counts[y] || 0) - (counts[x] || 0);
      }).forEach(function (value) {
        var n = counts[value] || 0;
        var chosen = sel.has(value);
        // Nothing left to reach, and not already chosen: shown, but inert.
        var inert = n === 0 && !chosen;

        var row = document.createElement("label");
        row.className = "facet-option" + (chosen ? " is-on" : "") +
                        (inert ? " is-inert" : "");
        if (inert) row.title = "No coins match this alongside your other filters";

        var box = document.createElement("input");
        box.type = "checkbox";
        box.checked = chosen;
        box.disabled = inert;
        box.addEventListener("change", function () {
          var next = state.filters[facet.key] || new Set();
          if (next.has(value)) next.delete(value); else next.add(value);
          state.filters[facet.key] = next;
          apply();
        });

        var name = document.createElement("span");
        name.className = "facet-name";
        name.textContent = facet.fmt(value);

        var count = document.createElement("span");
        count.className = "facet-count";
        count.textContent = n;

        row.appendChild(box);
        row.appendChild(name);
        row.appendChild(count);
        group.appendChild(row);
      });

      frag.appendChild(group);
    });

    el.filters.textContent = "";
    el.filters.appendChild(frag);
    el.filterbar.hidden = state.all.length === 0;
    el.clear.hidden = !anyActive;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ── Routing ────────────────────────────────────────────────────────────── */

  function writeHash() {
    var parts = [];
    FACETS.forEach(function (f) {
      var sel = state.filters[f.key];
      if (sel && sel.size) parts.push(f.key + "=" + Array.from(sel).map(encodeURIComponent).join(","));
    });
    if (state.sort !== "year-desc") parts.push("sort=" + state.sort);
    var open = window.Viewer && window.Viewer.currentId();
    if (open) parts.push("coin=" + encodeURIComponent(open));
    // So that reloading leaves you where you were rather than back at the grid.
    if (window.CoinHistory && window.CoinHistory.isOpen()) parts.push("view=history");
    var hash = parts.length ? "#" + parts.join("&") : "";
    if (hash !== window.location.hash) {
      history.replaceState(null, "", window.location.pathname + window.location.search + hash);
    }
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, "");
    state.filters = {};
    var openId = null;
    wantedView = null;
    if (hash) {
      hash.split("&").forEach(function (pair) {
        var i = pair.indexOf("=");
        if (i < 0) return;
        var key = pair.slice(0, i), val = decodeURIComponent(pair.slice(i + 1));
        if (key === "coin") { openId = val; return; }
        if (key === "view") { wantedView = val; return; }
        if (key === "sort") { state.sort = val; return; }
        if (FACETS.some(function (f) { return f.key === key; })) {
          state.filters[key] = new Set(val.split(",").map(decodeURIComponent));
        }
      });
    }
    return openId;
  }

  function openCoin(id) {
    if (window.Viewer) window.Viewer.open(id);
  }

  /* ── Public surface ─────────────────────────────────────────────────────── */

  function byId(id) {
    for (var i = 0; i < state.all.length; i++) {
      if (String(state.all[i].id) === String(id)) return state.all[i];
    }
    return null;
  }

  function indexOfInView(id) {
    for (var i = 0; i < state.view.length; i++) {
      if (String(state.view[i].id) === String(id)) return i;
    }
    return -1;
  }

  /* ── Theme ──────────────────────────────────────────────────────────────── */

  // The theme is already applied by the inline script in index.html; this only
  // wires up the toggle and remembers the choice. Once chosen explicitly, the
  // preference sticks and no longer follows the system.
  function initTheme() {
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;

    function label() {
      var dark = document.documentElement.dataset.theme !== "light";
      btn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
    }
    label();

    btn.addEventListener("click", function () {
      var next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("coins:theme", next); } catch (e) {}
      label();
    });

    // Follow the system only while the user hasn't expressed a preference.
    var mq = window.matchMedia("(prefers-color-scheme: light)");
    var onChange = function (e) {
      try { if (localStorage.getItem("coins:theme")) return; } catch (err) {}
      document.documentElement.dataset.theme = e.matches ? "light" : "dark";
      label();
    };
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  /**
   * Home is the collection. It steps back out of the history or a coin, and
   * from the collection itself clears any filtering and returns to the top —
   * so it always lands on the whole thing, and never leaves for the wider site.
   */
  function initHome() {
    var btn = document.getElementById("btn-home");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (window.CoinHistory && window.CoinHistory.isOpen()) { window.CoinHistory.close(); return; }
      if (window.Viewer && window.Viewer.currentId()) { window.Viewer.close(); return; }
      state.filters = {};
      state.sort = "year-desc";
      if (el.sort) el.sort.value = state.sort;
      apply();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /** The filter column, opened and closed from the bar. */
  function initFilterToggle() {
    var btn = document.getElementById("btn-filters");
    if (!btn) return;

    var open = true;
    try { open = localStorage.getItem("coins:filters") !== "closed"; } catch (e) {}

    function paint() {
      document.body.classList.toggle("filters-open", open);
      btn.setAttribute("aria-expanded", String(open));
      btn.setAttribute("aria-label", open ? "Hide filters" : "Show filters");
    }
    paint();

    btn.addEventListener("click", function () {
      open = !open;
      try { localStorage.setItem("coins:filters", open ? "open" : "closed"); } catch (e) {}
      paint();
    });
  }

  function init() {
    initTheme();
    initHome();
    initFilterToggle();
    el.grid = document.getElementById("grid");
    el.empty = document.getElementById("empty");
    el.count = document.getElementById("count");
    el.filters = document.getElementById("filters");
    el.filterbar = document.getElementById("filterbar");
    el.sort = document.getElementById("sort");
    el.clear = document.getElementById("clear-filters");

    el.sort.addEventListener("change", function () { state.sort = el.sort.value; apply(); });
    el.clear.addEventListener("click", function () { state.filters = {}; apply(); });

    // Cache-bust so edit mode sees its own writes immediately.
    var bust = window.location.protocol === "file:" ? "" : "?t=" + Date.now();

    return Promise.all([
      fetch("data/vocab.json" + bust).then(function (r) { return r.json(); }),
      fetch(DB + "coins.json" + bust).then(function (r) { return r.json(); })
    ]).catch(function (err) {
      // Only a genuine loading failure belongs here. Wrapping the rendering in
      // the same catch meant any bug while drawing the page was reported as
      // "the catalogue could not be loaded" — under a fully drawn catalogue.
      el.empty.hidden = false;
      el.empty.textContent = "The catalogue could not be loaded.";
      console.error("[coins] failed to load catalogue", err);
      return null;
    }).then(function (res) {
      if (!res) return null;
      state.vocab = res[0];
      indexVocab(state.vocab);
      state.all = Array.isArray(res[1]) ? res[1] : [];

      var openId = readHash();
      if (el.sort) el.sort.value = state.sort;
      apply();
      // Handed back rather than opened here: the viewer sets itself up on
      // coins:ready, which has not been dispatched yet, so opening a coin from
      // the address bar at this point would reach into an empty viewer.
      return openId;
    });
  }

  return {
    init: init,
    state: state,
    apply: apply,
    reload: function () {
      return fetch(DB + "coins.json?t=" + Date.now())
        .then(function (r) { return r.json(); })
        .then(function (data) { state.all = Array.isArray(data) ? data : []; apply(); });
    },
    onChange: function (fn) { listeners.push(fn); },
    wantedView: function () { return wantedView; },
    showEmptyFields: function (on) { showEmpty = !!on; },
    open: openCoin,
    bust: function (id) { busts[String(id)] = Date.now(); },
    byId: byId,
    indexOfInView: indexOfInView,
    title: title,
    subtitle: subtitle,
    denomLabel: denomLabel,
    year: year,
    specs: specs,
    formatField: formatField,
    imgSrc: imgSrc,
    hasImage: hasImage,
    primaryFace: primaryFace,
    look: look,
    labelOf: labelOf,
    escapeHtml: escapeHtml,
    writeHash: writeHash
  };
})();

document.addEventListener("DOMContentLoaded", function () {
  window.Coins.init().then(function (openId) {
    document.dispatchEvent(new CustomEvent("coins:ready"));
    // Now that the viewer exists, a #coin= link can be honoured.
    if (openId) window.Coins.open(openId);
  });
});
