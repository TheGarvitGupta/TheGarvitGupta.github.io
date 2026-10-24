// One player's saved game, as two devices have it, made one. The game folds in what the board's server has each time it
// is opened or come back to, and the server folds in what each device sends it, both with this (build-worker.py pastes it
// into the worker), so a level packed on a phone is open on the laptop next time it is looked at.
//
// merge(mine, theirs): mine is the device's own (or, on the server, the one just sent); theirs, the other. Nothing is lost:
//   done      every level packed on either, with the better of the two packings (fewer moves, then less time)
//   sent      a level is on the board if the packing kept is one that was sent
//   hints     a day's three are shared: on the same day, the fewer left; else the later day's
//   name      the name and the email last given, on either (named: when)
//   flags     the welcome seen, the game finished, the tips shown, the prize: once on either, on both
//   places    the places on the board last heard of
// and what is the device's own stays as it is: the sound, eyesight, the level it is on and a box left half packed.
var PackmanSync = (function () {
  // Levels that were given new names: what was packed under the old one is the new one's. (The Rival levels were named
  // by number for their first day.)
  var RENAMED = { 'Short Fuse': 'Minefield', 'Rival 1': 'Opening Hand', 'Rival 2': 'Square Off', 'Rival 3': 'Rock Bottom', 'Rival 4': 'House Rules',
    'Rival 5': 'Double Cross', 'Rival 6': 'The Long Game', 'Rival 7': 'Endgame' };
  function named(n) { return RENAMED[n] || n; }
  // a saved game with every level in it under the name it has now (the better packing, if it had both)
  function renamed(s) {
    if (!s || typeof s !== 'object') return s;
    ['done', 'sent', 'places'].forEach(function (f) {
      var o = s[f]; if (!o || typeof o !== 'object') return;
      Object.keys(o).forEach(function (k) {
        var to = RENAMED[k]; if (!to) return;
        var a = o[k], b = o[to];
        if (f === 'done') { if (a && (!b || better(a, b))) { o[to] = a; if (s.sent) { if (s.sent[k]) s.sent[to] = 1; else delete s.sent[to]; } } }
        else if (b == null) o[to] = a;
        delete o[k];
      });
    });
    if (RENAMED[s.last]) s.last = RENAMED[s.last];
    if (s.board && RENAMED[s.board.l]) s.board.l = RENAMED[s.board.l];
    return s;
  }
  var OWN = ['mute', 'eyes', 'last', 'board'];
  var ONCE = ['seen', 'eyeTip', 'powerTip', 'kaleido', 'finished'];
  function better(a, b) { return a.m < b.m || (a.m === b.m && a.t < b.t); }
  function copy(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function merge(mine, theirs) {
    mine = renamed(copy(mine) || {}); theirs = renamed(copy(theirs) || {});
    var out = copy(theirs), k;
    OWN.forEach(function (f) { if (f in mine) out[f] = copy(mine[f]); else delete out[f]; });
    out.v = 3;
    if (mine.pid) out.pid = mine.pid;
    // the levels
    var A = mine.done || {}, B = theirs.done || {}, done = {}, sent = {};
    for (k in B) if (B[k]) { done[k] = copy(B[k]); if (theirs.sent && theirs.sent[k]) sent[k] = 1; }
    for (k in A) if (A[k]) {
      if (!done[k] || better(A[k], done[k])) { done[k] = copy(A[k]); if (mine.sent && mine.sent[k]) sent[k] = 1; else delete sent[k]; }
      else if (!better(done[k], A[k]) && mine.sent && mine.sent[k]) sent[k] = 1;   // (the same packing, sent from here)
    }
    out.done = done; out.sent = sent;
    // a day's hints
    var H = {}, ha = mine.hints || {}, hb = theirs.hints || {};
    for (k in hb) H[k] = copy(hb[k]);
    for (k in ha) {
      var a = ha[k], b = H[k];
      if (!a || typeof a !== 'object' || Array.isArray(a) || a.day == null) { if (!b) H[k] = copy(a); continue; }
      if (!b || typeof b !== 'object' || Array.isArray(b) || b.day == null || a.day > b.day) H[k] = copy(a);
      else if (a.day === b.day) H[k] = { n: Math.min(a.n, b.n), day: a.day };
    }
    out.hints = H;
    // who they are
    var who = (mine.named || 0) >= (theirs.named || 0) ? mine : theirs;
    ['name', 'email', 'as', 'named'].forEach(function (f) { if (who[f] != null) out[f] = who[f]; else if (mine[f] != null && out[f] == null) out[f] = mine[f]; });
    // once, on either
    ONCE.forEach(function (f) { if (mine[f] || theirs[f]) out[f] = mine[f] || theirs[f]; });
    if (mine.top3 || theirs.top3) {
      out.top3 = copy(mine.top3 || theirs.top3);
      if ((mine.top3 && mine.top3.done) || (theirs.top3 && theirs.top3.done)) out.top3.done = true;
    }
    var pa = mine.placed || 0, pb = theirs.placed || 0;
    if (mine.places && pa >= pb) { out.places = copy(mine.places); out.placed = pa; }
    return out;
  }
  // what the other device has changed, the device's own left out: nothing, if they are the same game
  function same(a, b) {
    var flat = function (v) {   // (written out with every object's keys in order, all the way down, so the order they were made in is no difference)
      if (!v || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
      if (Array.isArray(v)) return '[' + v.map(flat).join(',') + ']';
      return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + flat(v[k]); }).join(',') + '}';
    };
    var strip = function (s) { var o = copy(s) || {}; OWN.forEach(function (f) { delete o[f]; }); return flat(o); };
    return strip(a) === strip(b);
  }
  return { merge: merge, same: same, renamed: renamed, named: named };
})();
if (typeof module !== 'undefined') module.exports = PackmanSync;
