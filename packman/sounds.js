// Packman's sounds. None of them is a recording: each is a handful of notes written out
// below, and the browser makes them on the spot. tone(pitch, length, options) plays one
// note; pitch is in hertz and length in seconds. The options are: at (seconds from now),
// to (a pitch to slide to), type (the wave: sine by default, or triangle or square, each
// a little buzzier than the last) and vol (how loud).
var PackmanSounds = function (tone) {
  'use strict';
  return {
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
    ['pick', 'Picking a shape up'], ['drop', 'Putting it down outside the box, or starting a level over'], ['snap', 'It snaps against a wall or a neighbour'],
    ['tick', 'Each notch as it turns'], ['bad', 'Put down where it does not fit'],
    ['fit', 'A shape goes in. The note climbs through the level', [0.1, 0.5, 1]]]],
  ['The board', [
    ['deal', 'A new level: the shapes are dealt out', [4, 9]], ['rattle', 'The box shakes a near-finished packing into place'], ['spot', 'A hint shows one spot'],
    ['eyeOn', 'Eyesight on'], ['eyeOff', 'Eyesight off'], ['chime', 'Eyesight is introduced']]],
  ['Buttons and sheets', [
    ['tap', 'Any button'], ['arm', 'Start over asks to be pressed again'], ['open', 'A sheet opens'], ['close', 'A sheet closes']]],
  ['Winning', [
    ['win', 'A level is packed'], ['best', 'It beat your best time'], ['top', 'You are first on the leaderboard'], ['pop', 'Each firework in the last level\'s party'],
    ['fanfare', 'All seventeen packed']]]
];
