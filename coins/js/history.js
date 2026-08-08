/* ============================================================================
   The Coin Collection — history.

   Every commit that touched coins/collection/ is one step in the collection's
   life. Nothing extra is recorded to make this work; git already holds a
   snapshot of the catalogue and every photograph at every point, so this is
   translation rather than bookkeeping.

   Reading rules, in order of importance:
     · a change is shown as coins, not as filenames or JSON
     · a replaced photograph is shown as the old one beside the new one
     · a changed field reads "Mint — → Hyderabad", using the same labels the
       exhibit uses, never a raw key and never a raw id

   Selection follows git: pick one step and you see it against the step before
   it; pick two and you see everything between them.

   Loaded only in edit mode. The published site never requests this file.

   Named CoinHistory rather than History: window.History is the browser's own
   History interface constructor, and overwriting it is asking for trouble.
   ========================================================================= */

window.CoinHistory = (function () {
  "use strict";

  var el = {};
  var steps = [];
  var sel = [];        // one or two shas, newest-first order preserved
  var open = false;

  /* ── Formatting ─────────────────────────────────────────────────────────── */

  var MONTHS = ["January","February","March","April","May","June","July",
                "August","September","October","November","December"];

  function when(iso) {
    var d = new Date(iso);
    var h = d.getHours(), m = String(d.getMinutes()).padStart(2, "0");
    var ampm = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return { day: d.getDate() + " " + MONTHS[d.getMonth()],
             time: h + ":" + m + ampm,
             year: d.getFullYear(),
             stamp: d.toDateString() };
  }

  /** One line describing a step, built from what actually changed. */
  function summarise(s) {
    var u = s.summary || {}, bits = [];
    if (u.added)   bits.push(u.added + (u.added === 1 ? " coin added" : " coins added"));
    if (u.changed) bits.push(u.changed + (u.changed === 1 ? " coin updated" : " coins updated"));
    if (u.removed) bits.push(u.removed + (u.removed === 1 ? " coin removed" : " coins removed"));
    return bits.length ? bits.join(", ") : "No change to the collection";
  }

  var C = function () { return window.Coins; };

  function fieldLabel(key) {
    var f = (C().state.vocab.fields || []).filter(function (x) { return x.key === key; })[0];
    if (f) return f.label;
    return { notes: "Note", status: "Status", leadFace: "Front in grid",
             title: "Name", images: "Photographs" }[key] || key;
  }

  /** Render one value the way the exhibit would, so history reads like the site. */
  function valueText(key, value) {
    if (value === null || value === undefined || value === "") return null;

    var f = (C().state.vocab.fields || []).filter(function (x) { return x.key === key; })[0];

    if (key === "denomination") {
      return C().denomLabel({ denomination: value }) || "—";
    }
    if (key === "leadFace") return value === "rev" ? "Reverse" : "Obverse";
    // A coin's status is about whether it has been identified, not about
    // whether it is on the web — "Published" now means the latter everywhere
    // else, so this must not borrow the word.
    if (key === "status")   return value === "unidentified" ? "Not yet identified" : "Identified";
    if (key === "notes")    return String(value);

    if (f && f.type === "select") return C().labelOf(f.vocab, value);
    if (f && f.type === "mintmark") {
      var mk = C().look("mintMarks", value);
      return mk ? mk.glyph + "  " + mk.label : String(value);
    }
    if (f && f.type === "number") {
      if (f.format === "integer") return Number(value).toLocaleString("en-GB");
      if (f.format === "fineness") return "." + String(Math.round(Number(value) * 1000)).padStart(3, "0");
      return value + (f.unit ? " " + f.unit : "");
    }
    return String(value);
  }

  /* ── Building blocks ────────────────────────────────────────────────────── */

  /** A thumbnail out of history — or, for unsaved work, straight off disk. */
  function blobImg(blob, alt) {
    if (blob && blob.indexOf("live:") === 0) {
      var cur = document.createElement("img");
      cur.src = "collection/images/thumbs/" + blob.slice(5) + "?t=" + Date.now();
      cur.alt = alt || "";
      cur.loading = "lazy";
      return cur;
    }
    if (!blob) {
      var ph = document.createElement("span");
      ph.className = "hno-photo";
      ph.title = "No photograph";
      return ph;
    }
    var img = document.createElement("img");
    img.src = "/api/history/blob/" + blob;
    img.alt = alt || "";
    img.loading = "lazy";
    return img;
  }

  function coinChip(entry, kind) {
    var wrap = document.createElement("div");
    wrap.className = "hchip is-" + kind;

    var disc = document.createElement("div");
    disc.className = "hchip-disc";
    var face = entry.coin && entry.coin.leadFace === "rev" ? "rev" : "obv";
    var blob = (entry.thumbs || {})[face] || (entry.thumbs || {}).obv || (entry.thumbs || {}).rev;
    disc.appendChild(blobImg(blob, ""));
    wrap.appendChild(disc);

    var name = document.createElement("span");
    name.className = "hchip-name";
    name.textContent = entry.coin ? C().title(entry.coin) : "Coin " + entry.id;
    wrap.appendChild(name);

    var sub = document.createElement("span");
    sub.className = "hchip-sub";
    sub.textContent = entry.coin ? (C().subtitle(entry.coin) || "") : "";
    wrap.appendChild(sub);

    return wrap;
  }

  /* ── The rail ───────────────────────────────────────────────────────────── */

  function renderRail(arriving) {
    el.rail.textContent = "";
    var lastDay = null;

    steps.forEach(function (s, i) {
      var t = when(s.date);

      if (t.stamp !== lastDay) {
        lastDay = t.stamp;
        var head = document.createElement("li");
        head.className = "hday";
        head.textContent = t.day + ", " + t.year;
        el.rail.appendChild(head);
      }

      var li = document.createElement("li");
      li.className = "hstep" + (i === 0 && arriving ? " hstep-enter" : "");
      li.dataset.sha = s.sha;

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hstep-btn";

      var isSel = sel.indexOf(s.sha) !== -1;
      var inSpan = sel.length === 2 &&
        i <= Math.max(idx(sel[0]), idx(sel[1])) && i >= Math.min(idx(sel[0]), idx(sel[1]));
      li.classList.toggle("is-selected", isSel);
      li.classList.toggle("is-in-span", inSpan && !isSel);

      var time = document.createElement("span");
      time.className = "hstep-time";
      time.textContent = s.unsaved ? "" : t.time;

      // Saved and live are not the same thing, and the difference is the whole
      // point of a working branch — so it is said outright on every step.
      var badge = document.createElement("span");
      badge.className = "hbadge is-" + (s.state || "saved");
      badge.textContent = s.state === "live" ? "Published"
                        : s.state === "unsaved" ? "Not saved" : "Saved";
      time.appendChild(badge);

      if (s.unsaved) li.classList.add("is-unsaved");
      if (s.state) li.classList.add("is-" + s.state);

      var sum = document.createElement("span");
      sum.className = "hstep-sum";
      sum.textContent = summarise(s);

      btn.appendChild(time);
      btn.appendChild(sum);

      // A few of the coins involved, so the rail is scannable without opening.
      if (s.thumbs && s.thumbs.length) {
        var strip = document.createElement("span");
        strip.className = "hstep-strip";
        s.thumbs.slice(0, 6).forEach(function (th) {
          var b = th.obv || th.rev;
          if (!b) return;
          var d = document.createElement("span");
          d.className = "hstep-dot";
          d.appendChild(blobImg(b, ""));
          strip.appendChild(d);
        });
        if (strip.childNodes.length) btn.appendChild(strip);
      }

      btn.addEventListener("click", function (e) { choose(s.sha, e.shiftKey); });
      li.appendChild(btn);
      el.rail.appendChild(li);
    });
  }

  function idx(sha) {
    for (var i = 0; i < steps.length; i++) if (steps[i].sha === sha) return i;
    return -1;
  }

  /**
   * Click one step to see it against the one before it — the default, and what
   * git does. Shift-click, or click a second step, to span a range.
   */
  function choose(sha, extend) {
    if (extend && sel.length && sel[0] !== sha) {
      sel = [sel[0], sha];
    } else if (sel.length === 1 && sel[0] === sha) {
      sel = [sha];                      // clicking the same step keeps it
    } else {
      sel = [sha];
    }
    renderRail();
    loadDiff();
  }

  /* ── The diff ───────────────────────────────────────────────────────────── */

  function loadDiff() {
    if (!sel.length) return;
    var a, b;
    if (sel.length === 2) {
      var i = idx(sel[0]), j = idx(sel[1]);
      // Steps are newest-first, so the larger index is the older commit.
      var older = steps[Math.max(i, j)], newer = steps[Math.min(i, j)];
      a = older.parent || older.sha;
      b = newer.sha;
    } else {
      b = sel[0];
      a = "";                            // server falls back to the parent
    }

    el.body.classList.add("is-loading");
    var url = "/api/history/diff?to=" + encodeURIComponent(b) + (a ? "&from=" + encodeURIComponent(a) : "");
    fetch(url).then(function (r) { return r.json(); }).then(function (d) {
      el.body.classList.remove("is-loading");
      renderDiff(d);
    });
  }

  function heading(d) {
    var one = sel.length === 1;
    var s = steps[idx(sel[0])] || steps[0];
    if (!s) return { title: "", sub: "" };
    if (one) {
      var t = when(s.date);
      if (s.unsaved) {
        return { title: summarise(s),
                 sub: "Edited since the last save, and not published anywhere yet" };
      }
      var where = s.state === "live" ? "Published" : "Saved, not published yet";
      return { title: summarise(s),
               sub: t.day + ", " + t.year + " at " + t.time + "  ·  " + where };
    }
    var i = idx(sel[0]), j = idx(sel[1]);
    var older = steps[Math.max(i, j)], newer = steps[Math.min(i, j)];
    var to = when(newer.date), from = when(older.date);
    var n = (d.added.length ? d.added.length + " added" : "") ;
    var bits = [];
    if (d.added.length)   bits.push(d.added.length + " added");
    if (d.changed.length) bits.push(d.changed.length + " updated");
    if (d.removed.length) bits.push(d.removed.length + " removed");
    void n;
    return { title: bits.length ? bits.join(", ") : "Nothing changed",
             sub: "Between " + from.day + ", " + from.time + " and " + to.day + ", " + to.time };
  }

  function section(title, kind, entries, render) {
    if (!entries.length) return null;
    var sec = document.createElement("section");
    sec.className = "hsec is-" + kind;
    var h = document.createElement("h3");
    h.className = "hsec-title";
    h.innerHTML = '<span class="hsec-mark" aria-hidden="true"></span>' +
                  C().escapeHtml(title.replace("{n}", entries.length)) ;
    sec.appendChild(h);
    entries.forEach(function (e) { sec.appendChild(render(e)); });
    return sec;
  }

  function renderDiff(d) {
    d = d || {};
    d.added = d.added || []; d.changed = d.changed || []; d.removed = d.removed || [];
    el.body.textContent = "";

    var head = heading(d);
    var hd = document.createElement("header");
    hd.className = "hhead";
    var h2 = document.createElement("h2");
    h2.textContent = head.title;
    var p = document.createElement("p");
    p.textContent = head.sub;
    hd.appendChild(h2);
    hd.appendChild(p);

    var here = steps[idx(sel[0])];

    // Saving and publishing live on the bar, which floats above this panel —
    // one set of controls for the whole of editing rather than a second set
    // that has to be kept in step with it.
    // Restoring is only meaningful for a single point in time, not a range.
    if (sel.length === 1 && idx(sel[0]) > 0 && !(here && here.unsaved)) {
      var back = document.createElement("button");
      back.type = "button";
      back.className = "hrestore-all";
      back.textContent = "Put the collection back to here";
      back.addEventListener("click", function () { restoreAll(sel[0], head.sub); });
      hd.appendChild(back);
    }
    el.body.appendChild(hd);

    if (!d.added.length && !d.changed.length && !d.removed.length) {
      var none = document.createElement("p");
      none.className = "hempty";
      none.textContent = "No coins were added, changed or removed.";
      el.body.appendChild(none);
      return;
    }

    var addSec = section(
      "{n} added", "added", d.added,
      function (e) {
        var row = document.createElement("div");
        row.className = "hrow";
        row.appendChild(coinChip(e, "added"));
        return row;
      });
    if (addSec) el.body.appendChild(addSec);

    var chSec = section(
      "{n} updated", "changed", d.changed,
      function (e) {
        var row = document.createElement("div");
        row.className = "hrow";
        row.appendChild(coinChip(e, "changed"));

        var detail = document.createElement("div");
        detail.className = "hdetail";

        // Photographs first — they're the most visible kind of change.
        e.photos.forEach(function (ph) {
          var pr = document.createElement("div");
          pr.className = "hphoto";
          var lab = document.createElement("span");
          lab.className = "hfield-key";
          lab.textContent = ph.face === "obv" ? "Obverse" : "Reverse";
          pr.appendChild(lab);

          var pair = document.createElement("span");
          pair.className = "hpair";
          if (ph.from) {
            var a = document.createElement("span");
            a.className = "hpair-side is-before";
            a.appendChild(blobImg(ph.from, "before"));
            pair.appendChild(a);
            var arrow = document.createElement("span");
            arrow.className = "harrow";
            arrow.textContent = "→";
            pair.appendChild(arrow);
          }
          var bside = document.createElement("span");
          bside.className = "hpair-side is-after";
          bside.appendChild(blobImg(ph.to, "after"));
          pair.appendChild(bside);
          var note = document.createElement("span");
          note.className = "hphoto-note";
          note.textContent = ph.from ? "replaced" : "added";
          pair.appendChild(note);
          pr.appendChild(pair);
          detail.appendChild(pr);
        });

        e.fields.forEach(function (f) {
          var fr = document.createElement("div");
          fr.className = "hfield";
          var k = document.createElement("span");
          k.className = "hfield-key";
          k.textContent = fieldLabel(f.key);
          fr.appendChild(k);

          var from = valueText(f.key, f.from);
          var to = valueText(f.key, f.to);
          var v = document.createElement("span");
          v.className = "hfield-val";

          if (f.key === "notes") {
            v.classList.add("is-prose");
            v.textContent = !from ? "added" : (!to ? "removed" : "rewritten");
          } else if (from === null) {
            v.innerHTML = '<span class="hnew">' + C().escapeHtml(to) + "</span>";
          } else if (to === null) {
            v.innerHTML = '<span class="hold">' + C().escapeHtml(from) + "</span>" +
                          '<span class="harrow">→</span><span class="hgone">removed</span>';
          } else {
            v.innerHTML = '<span class="hold">' + C().escapeHtml(from) + "</span>" +
                          '<span class="harrow">→</span>' +
                          '<span class="hnew">' + C().escapeHtml(to) + "</span>";
          }
          fr.appendChild(v);
          detail.appendChild(fr);
        });

        row.appendChild(detail);
        return row;
      });
    if (chSec) el.body.appendChild(chSec);

    var rmSec = section(
      "{n} removed", "removed", d.removed,
      function (e) {
        var row = document.createElement("div");
        row.className = "hrow";
        row.appendChild(coinChip(e, "removed"));
        return row;
      });
    if (rmSec) el.body.appendChild(rmSec);
  }

  /* ── Restoring ──────────────────────────────────────────────────────────── */

  function toast(msg, bad) {
    var t = document.createElement("div");
    t.className = "toast" + (bad ? " is-error" : "");
    t.style.zIndex = "90";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add("is-out"); }, bad ? 5000 : 2400);
    setTimeout(function () { t.remove(); }, bad ? 5400 : 2800);
  }

  function restoreAll(sha, label) {
    if (!confirm("Put the whole collection back to " + label + "?\n\n" +
                 "Nothing is lost: the later steps stay in the history, and you can " +
                 "come back to them the same way. This appears as an unsaved change " +
                 "until you save it.")) return;

    fetch("/api/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: sha })
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (!res.ok) { toast(res.error || "Could not restore", true); return; }
      var u = res.summary || {}, bits = [];
      if (u.added)   bits.push(u.added + " back");
      if (u.removed) bits.push(u.removed + " removed");
      if (u.changed) bits.push(u.changed + " reverted");
      afterRestore("Collection restored" + (bits.length ? " — " + bits.join(", ") : "") +
                   ". Save when you're happy with it.");
      show();   // the restore is itself an unsaved step now

    });
  }

  /** The exhibit underneath has changed, so bring it back into agreement. */
  function afterRestore(msg) {
    window.Coins.reload().then(function () {
      if (window.Viewer && window.Viewer.currentId()) window.Viewer.rerender();
      document.dispatchEvent(new CustomEvent("coins:restored"));
      toast(msg);
    });
  }

  /* ── Open / close ───────────────────────────────────────────────────────── */

  function build() {
    var root = document.createElement("div");
    root.className = "history";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "History of the collection");
    root.innerHTML =
      '<div class="history-panel">' +
        '<header class="history-top">' +
          '<h1>History</h1>' +
          '<p class="history-hint">Pick a step to see what changed. Shift-click a second to span a range.</p>' +
          '<button type="button" class="history-close" aria-label="Close">&times;</button>' +
        '</header>' +
        '<div class="history-cols">' +
          '<nav class="history-rail-wrap"><ol class="history-rail"></ol></nav>' +
          '<div class="history-body"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);

    el.root = root;
    el.rail = root.querySelector(".history-rail");
    el.body = root.querySelector(".history-body");
    root.querySelector(".history-close").addEventListener("click", close);
    root.addEventListener("click", function (e) { if (e.target === root) close(); });
    document.addEventListener("keydown", function (e) {
      if (!open) return;
      if (e.key === "Escape") { e.preventDefault(); close(); }
    });
  }

  function show() {
    var reopened = open;      // a re-read, rather than opening for the first time
    if (!el.root) build();
    open = true;
    el.root.hidden = false;
    document.body.style.overflow = "hidden";
    el.rail.textContent = "";
    el.body.textContent = "";
    el.body.classList.add("is-loading");

    fetch("/api/history").then(function (r) { return r.json(); }).then(function (d) {
      steps = d.steps || [];
      el.body.classList.remove("is-loading");
      if (!steps.length) {
        el.body.innerHTML = '<p class="hempty">Nothing has been published yet, so there is no history to show.</p>';
        return;
      }
      sel = [steps[0].sha];
      renderRail(reopened);
      loadDiff();
    });
  }

  /**
   * Re-read the timeline, letting the unsaved step leave first.
   *
   * Saving or discarding removes that step, and rebuilding the panel underneath
   * made it disappear between frames — the one piece of the interface whose
   * whole job is showing what just happened. It collapses out instead, and the
   * step that replaces it arrives in its place.
   */
  function refresh() {
    var li = el.rail && el.rail.querySelector(".hstep.is-unsaved");
    if (!li || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      show();
      return;
    }
    li.style.height = li.offsetHeight + "px";
    li.style.overflow = "hidden";
    requestAnimationFrame(function () {
      li.classList.add("is-leaving");
      li.style.height = "0px";
      li.style.marginTop = "0px";
    });
    setTimeout(show, 320);
  }

  function close() {
    open = false;
    if (el.root) el.root.hidden = true;
    document.body.style.overflow = "";
  }

  return {
    show: show,
    refresh: refresh,
    close: close,
    isOpen: function () { return open; }
  };
})();
