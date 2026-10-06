// Packman's sounds. None of them is a recording: each is a handful of notes written out
// below, and the browser makes them on the spot. tone(pitch, length, options) plays one
// note; pitch is in hertz and length in seconds. The options are: at (seconds from now),
// to (a pitch to slide to), type (the wave: sine by default, or triangle or square, each
// a little buzzier than the last) and vol (how loud).
var PackmanSounds = function (tone) {
  'use strict';
  // Each personality has a voice: what it says when it is picked up. The names are the ones in faces.js.
  var voices = {
    plain: function () { tone(520, 0.07, { to: 700, vol: 0.07 }); },
    specs: function () { tone(988, 0.05, { type: 'triangle', vol: 0.06 }); tone(1319, 0.08, { at: 0.07, type: 'triangle', vol: 0.06 }); },
    sweet: function () { tone(1047, 0.1, { to: 1568, vol: 0.06 }); tone(1319, 0.14, { at: 0.1, vol: 0.05 }); },
    host: function () { tone(659, 0.14, { type: 'triangle', vol: 0.08 }); tone(523, 0.22, { at: 0.13, type: 'triangle', vol: 0.08 }); },
    tache: function () { tone(131, 0.12, { type: 'triangle', vol: 0.13 }); tone(165, 0.2, { at: 0.13, type: 'triangle', to: 147, vol: 0.13 }); },
    grump: function () { tone(120, 0.2, { type: 'square', to: 78, vol: 0.06 }); },
    sleepy: function () { tone(330, 0.14, { to: 470, vol: 0.06 }); tone(470, 0.4, { at: 0.13, to: 170, vol: 0.06 }); },
    kid: function () { tone(620, 0.06, { to: 930, vol: 0.07 }); tone(780, 0.07, { at: 0.08, to: 1240, vol: 0.07 }); },
    wide: function () { tone(440, 0.24, { to: 830, vol: 0.07 }); },
    cool: function () { tone(196, 0.16, { type: 'triangle', to: 98, vol: 0.14 }); tone(147, 0.14, { at: 0.2, type: 'triangle', vol: 0.12 }); },
    gent: function () { tone(208, 0.05, { type: 'triangle', vol: 0.11 }); tone(262, 0.13, { at: 0.09, type: 'triangle', to: 233, vol: 0.11 }); },
    cat: function () { tone(760, 0.1, { to: 1250, vol: 0.07 }); tone(1250, 0.24, { at: 0.1, to: 620, vol: 0.07 }); },
    cheeky: function () { [[784, 0], [659, 0.09], [880, 0.18], [784, 0.27], [659, 0.36]].forEach(function (n, i) { tone(n[0], i === 4 ? 0.14 : 0.07, { at: n[1], type: 'triangle', vol: 0.07 }); }); },   // nyah-nyah
    smitten: function () { [1319, 1661, 1976, 2637].forEach(function (f, i) { tone(f, 0.16, { at: i * 0.06, vol: 0.045 }); }); },
    jumpy: function () { tone(420, 0.07, { type: 'triangle', to: 1700, vol: 0.07 }); },
    unlucky: function () { tone(640, 0.09, { to: 560, vol: 0.07 }); tone(560, 0.2, { at: 0.09, to: 270, vol: 0.07 }); },
    goof: function () { tone(311, 0.08, { type: 'square', to: 220, vol: 0.045 }); tone(415, 0.12, { at: 0.11, type: 'square', to: 277, vol: 0.045 }); },
    pirate: function () { tone(150, 0.3, { type: 'square', to: 112, vol: 0.05 }); tone(300, 0.3, { type: 'triangle', to: 224, vol: 0.07 }); },
    // the powers of chapter three
    mine: function () { tone(1700, 0.02, { type: 'square', vol: 0.05 }); tone(1700, 0.02, { at: 0.11, type: 'square', vol: 0.05 }); },
    angel: function () { [1568, 2093, 2637].forEach(function (f, i) { tone(f, 0.3, { at: i * 0.07, vol: 0.045 }); }); },
    ghost: function () { tone(420, 0.18, { to: 640, vol: 0.06 }); tone(640, 0.28, { at: 0.17, to: 370, vol: 0.06 }); },
    sticky: function () { tone(180, 0.07, { type: 'triangle', to: 430, vol: 0.1 }); tone(430, 0.06, { at: 0.07, type: 'triangle', to: 150, vol: 0.1 }); },
    puffer: function () { tone(320, 0.11, { type: 'triangle', to: 950, vol: 0.07 }); },
    chameleon: function () { [660, 880, 740].forEach(function (f, i) { tone(f, 0.05, { at: i * 0.06, type: 'triangle', vol: 0.07 }); }); },
    sleeper: function () { tone(115, 0.26, { type: 'triangle', to: 88, vol: 0.13 }); tone(720, 0.2, { at: 0.3, to: 930, vol: 0.03 }); },
    magnet: function () { tone(110, 0.2, { type: 'square', vol: 0.035 }); tone(220, 0.2, { type: 'triangle', to: 330, vol: 0.08 }); },
    goth: function () { tone(392, 0.16, { type: 'triangle', vol: 0.08 }); tone(311, 0.16, { at: 0.15, type: 'triangle', vol: 0.08 }); tone(233, 0.45, { at: 0.3, type: 'triangle', vol: 0.08 }); }
  };
  return {
    voice: function (name) { (voices[name] || voices.plain)(); },
    // handling a shape
    pick: function () { tone(520, 0.07, { to: 700, vol: 0.07 }); },
    drop: function () { tone(210, 0.11, { to: 120, vol: 0.14 }); },
    snap: function () { tone(880, 0.05, { type: 'triangle', to: 1320, vol: 0.06 }); },
    tick: function () { tone(1250, 0.025, { type: 'triangle', vol: 0.035 }); },
    bad: function () { tone(160, 0.12, { type: 'triangle', to: 110, vol: 0.1 }); },
    // A shape goes in. The note climbs an octave over the course of a level: part is how much of the box is packed, 0 to 1.
    fit: function (part) {
      var f = part == null ? 660 : 440 * Math.pow(2, Math.max(0, Math.min(1, part)));
      tone(f, 0.09, { vol: 0.1 }); tone(f * 1.5, 0.14, { at: 0.07, vol: 0.1 });
    },
    // the board
    deal: function (n) { for (var k = 0; k < Math.min(n || 4, 9); k++) tone(300 + k * 48, 0.035, { at: k * 0.045, type: 'triangle', vol: 0.05 }); },
    rattle: function () { for (var k = 0; k < 7; k++) tone(260 + Math.random() * 260, 0.04, { at: k * 0.085, type: 'square', vol: 0.045 }); },
    spot: function () { tone(1175, 0.08, { vol: 0.07 }); tone(1568, 0.1, { at: 0.08, vol: 0.07 }); tone(2349, 0.16, { at: 0.16, vol: 0.05 }); },
    eyeOn: function () { tone(440, 0.08, { type: 'triangle', to: 880, vol: 0.07 }); tone(1320, 0.12, { at: 0.07, vol: 0.06 }); },
    eyeOff: function () { tone(880, 0.08, { type: 'triangle', to: 440, vol: 0.07 }); tone(330, 0.1, { at: 0.07, vol: 0.05 }); },
    chime: function () { tone(784, 0.25, { vol: 0.08 }); tone(1175, 0.35, { at: 0.12, vol: 0.07 }); },
    // buttons and sheets
    tap: function () { tone(900, 0.03, { type: 'triangle', vol: 0.04 }); },
    arm: function () { tone(300, 0.07, { type: 'square', vol: 0.05 }); tone(300, 0.07, { at: 0.11, type: 'square', vol: 0.05 }); },
    open: function () { tone(420, 0.09, { to: 640, vol: 0.06 }); },
    close: function () { tone(520, 0.08, { to: 340, vol: 0.05 }); },
    // what the powers do
    fuse: function (left) { tone(left <= 1 ? 1900 : 1400, 0.03, { type: 'square', vol: 0.05 }); if (left <= 2) tone(left <= 1 ? 1900 : 1400, 0.03, { at: 0.16, type: 'square', vol: 0.05 }); },
    boom: function () {
      tone(150, 0.5, { type: 'square', to: 34, vol: 0.14 }); tone(95, 0.65, { type: 'triangle', to: 30, vol: 0.2 });
      for (var k = 0; k < 8; k++) tone(500 + Math.random() * 2200, 0.05, { at: k * 0.03, type: 'square', vol: 0.04 });
    },
    fizz: function () { tone(1200, 0.16, { to: 300, vol: 0.05 }); },
    bless: function () { [784, 988, 1175, 1568, 1976].forEach(function (f, i) { tone(f, i === 4 ? 0.6 : 0.3, { at: i * 0.09, vol: 0.07 }); }); },
    stone: function () { tone(180, 0.12, { type: 'triangle', to: 90, vol: 0.14 }); },
    glue: function () { tone(260, 0.08, { type: 'triangle', to: 520, vol: 0.09 }); tone(520, 0.1, { at: 0.08, type: 'triangle', to: 200, vol: 0.09 }); },
    peel: function () { tone(300, 0.12, { type: 'triangle', to: 900, vol: 0.06 }); },
    puff: function () { tone(200, 0.18, { to: 1000, vol: 0.1 }); tone(1000, 0.2, { at: 0.16, to: 500, vol: 0.05 }); },
    morph: function () { [500, 750, 1000].forEach(function (f, i) { tone(f, 0.05, { at: i * 0.045, type: 'square', vol: 0.035 }); }); },
    snore: function () { tone(100, 0.2, { type: 'triangle', to: 80, vol: 0.12 }); },
    pull: function () { tone(520, 0.22, { type: 'triangle', to: 160, vol: 0.08 }); },
    // winning
    win: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, 0.22, { at: i * 0.09, type: 'triangle', vol: 0.13 }); }); },
    best: function () { tone(1568, 0.16, { at: 0.5, type: 'triangle', vol: 0.11 }); tone(2093, 0.3, { at: 0.62, type: 'triangle', vol: 0.11 }); },
    top: function () { [1047, 1319, 1568, 2093].forEach(function (f, i) { tone(f, i === 3 ? 0.35 : 0.1, { at: i * 0.07, type: 'triangle', vol: 0.1 }); }); },
    pop: function () { tone(320 + Math.random() * 240, 0.09, { type: 'square', to: 70, vol: 0.05 }); tone(1500 + Math.random() * 900, 0.12, { at: 0.05, type: 'triangle', vol: 0.05 }); },
    fanfare: function () {
      [[523, 0], [523, 0.14], [523, 0.28], [698, 0.42], [880, 0.7], [784, 0.98], [1047, 1.12]].forEach(function (n, i) {
        tone(n[0], i === 6 ? 0.7 : 0.2, { at: n[1], type: 'triangle', vol: 0.14 });
        tone(n[0] / 2, i === 6 ? 0.7 : 0.2, { at: n[1], vol: 0.08 });
      });
    }
  };
};
// What each one is for, in the order of the list above: for the sound board (sounds.html).
PackmanSounds.about = [
  ['Handling a shape', [
    ['pick', 'Picking a shape up, before each had a voice of its own'], ['drop', 'Putting it down outside the box, or starting a level over'], ['snap', 'It snaps against a wall or a neighbour'],
    ['tick', 'Each notch as it turns'], ['bad', 'Put down where it does not fit'],
    ['fit', 'A shape goes in. The note climbs through the level', [0.1, 0.5, 1]]]],
  ['The board', [
    ['deal', 'A new level: the shapes are dealt out', [4, 9]], ['rattle', 'The box shakes a near-finished packing into place'], ['spot', 'A hint shows one spot'],
    ['eyeOn', 'Eyesight on'], ['eyeOff', 'Eyesight off'], ['chime', 'Eyesight is introduced']]],
  ['Buttons and sheets', [
    ['tap', 'Any button'], ['arm', 'Start over asks to be pressed again'], ['open', 'A sheet opens'], ['close', 'A sheet closes']]],
  ['Powers', [
    ['fuse', 'The mine counts down, faster at the end', [5, 2, 1]], ['boom', 'The mine goes off'], ['fizz', 'The mine is put down in time'],
    ['bless', 'The angel places two shapes'], ['stone', 'Trying to move the angel once it is stone'], ['glue', 'Sticky glues on'], ['peel', 'Sticky is peeled off'],
    ['puff', 'The puffer shoves its neighbours'], ['morph', 'The chameleon changes shape'], ['snore', 'Trying to turn the sleeper in the box'], ['pull', 'The magnet pulls a shape in']]],
  ['Winning', [
    ['win', 'A level is packed'], ['best', 'It beat your best time'], ['top', 'You are first on the leaderboard'], ['pop', 'Each firework in the last level\'s party'],
    ['fanfare', 'All seventeen packed']]]
];
