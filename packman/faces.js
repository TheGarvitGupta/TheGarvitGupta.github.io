// Packman's personalities. Each is a face a shape can be dealt: eye (how big), eyeY (how high),
// idle (the mouth at rest), still (does not look about), stare (does not blink) and wear, the
// extras drawn on top as [tag, class, attributes]. Everything is in face units and stays well
// inside the body, so no outfit changes the shape the player has to pack. voice names its sound
// in sounds.js; name and about are for the page that introduces them (personalities.html).
// New ones go at the end, here and among the powers: the leaderboard's pictures are dealt from the ones there are now (see CAST in game.js).
// Something worn that goes with the mouth (teeth, a tongue) is drawn twice, as w-idle and as w-good: one for the mouth at rest and
// one for the smile of a shape that is packed, each where that mouth is. Only one of the two is ever shown.
// A power may also have pour: what is drawn on the body itself, edge to edge, for each of the four shapes. Its parts are written
// as wear is, but in the shape's own units, and are cut off at the shape's edge.
var PackmanFaces = [
  { voice: 'plain', name: 'The regular', about: 'No fuss. Here to be packed.' },
  { voice: 'specs', name: 'The bookworm', about: 'Has read the rules. Twice.', wear: [['circle', 'wear', { cx: -0.13, cy: -0.06, r: 0.088 }], ['circle', 'wear', { cx: 0.13, cy: -0.06, r: 0.088 }], ['path', 'wear', { d: 'M-0.042 -0.07Q0 -0.09 0.042 -0.07' }]] },
  { voice: 'sweet', name: 'The sweetheart', about: 'Blushes when it fits.', wear: [['ellipse', 'blush', { cx: -0.215, cy: 0.045, rx: 0.05, ry: 0.034 }], ['ellipse', 'blush', { cx: 0.215, cy: 0.045, rx: 0.05, ry: 0.034 }],
           ['path', 'wear thin', { d: 'M-0.17 -0.1L-0.205 -0.13M-0.14 -0.115L-0.15 -0.155M0.17 -0.1L0.205 -0.13M0.14 -0.115L0.15 -0.155' }]] },
  { voice: 'host', name: 'The host', about: 'Dressed for the occasion.', wear: [['path', 'wear solid', { d: 'M0 0.27L-0.1 0.215V0.325ZM0 0.27L0.1 0.215V0.325Z' }], ['circle', 'wear solid', { cx: 0, cy: 0.27, r: 0.022 }]] },
  { voice: 'tache', name: 'The baritone', about: 'Hums while it waits.', idle: 'M-0.045 0.138Q0 0.165 0.045 0.138',
    // a handlebar: full under the nose, sweeping out to each side and turning up at the tips; the mouth sits just under it
    wear: [['path', 'wear solid', { d: 'M0 0.022C0.03 -0.005 0.09 -0.005 0.12 0.035C0.137 0.058 0.16 0.052 0.185 0.02C0.175 0.085 0.125 0.1 0.085 0.09C0.05 0.082 0.02 0.07 0 0.048C-0.02 0.07 -0.05 0.082 -0.085 0.09C-0.125 0.1 -0.175 0.085 -0.185 0.02C-0.16 0.052 -0.137 0.058 -0.12 0.035C-0.09 -0.005 -0.03 -0.005 0 0.022Z', transform: 'translate(0 0.012)' }]] },
  { voice: 'grump', name: 'The grump', about: 'Was fine where it was.', idle: 'M-0.06 0.125H0.06', wear: [['path', 'wear', { d: 'M-0.2 -0.175L-0.08 -0.135M0.2 -0.175L0.08 -0.135' }]] },
  { voice: 'sleepy', name: 'The sleepyhead', about: 'Could be packed lying down.', still: true, eye: 0.036, eyeY: -0.045, idle: 'M-0.035 0.115Q0 0.13 0.035 0.115', wear: [['path', 'wear', { d: 'M-0.185 -0.078H-0.075M0.075 -0.078H0.185' }]] },
  { voice: 'kid', name: 'The kid', about: 'Freckles, and cannot sit still.', wear: [-0.24, -0.2, -0.22, 0.2, 0.24, 0.22].map(function (x, n) { return ['circle', 'wear solid', { cx: x, cy: n % 3 === 2 ? 0.07 : 0.03, r: 0.012 }]; }) },
  { voice: 'wide', name: 'The wide-eyed one', about: 'Has never seen a box before.', eye: 0.062, idle: 'M-0.04 0.115Q0 0.14 0.04 0.115' },
  // the cool one: shades with the light glancing off them, and a grin full of teeth with a sparkle at the corner. Nothing to blink or look with behind them.
  { voice: 'cool', name: 'The cool one', about: 'Shades on. Indoors.', still: true, stare: true, idle: 'M-0.075 0.09H0.095',
    wear: [['path', 'wear solid', { d: 'M-0.235 -0.115H-0.03L-0.05 -0.02Q-0.13 0.03 -0.21 -0.02ZM0.03 -0.115H0.235L0.21 -0.02Q0.13 0.03 0.05 -0.02Z' }], ['path', 'wear', { d: 'M-0.03 -0.1H0.03' }],
           ['path', 'glare', { d: 'M-0.195 -0.05L-0.165 -0.092M-0.158 -0.04L-0.143 -0.062M0.07 -0.05L0.1 -0.092M0.107 -0.04L0.122 -0.062' }],
           ['path', 'tooth w-idle', { d: 'M-0.065 0.09H0.085Q0.08 0.165 0.01 0.165Q-0.06 0.165 -0.065 0.09ZM-0.015 0.09V0.162M0.035 0.09V0.162' }],
           ['path', 'glint w-idle', { d: 'M0 -0.055L0.013 -0.013L0.055 0L0.013 0.013L0 0.055L-0.013 0.013L-0.055 0L-0.013 -0.013Z', transform: 'translate(0.095 0.1)' }],
           // and packed, the grin is the whole of its smile
           ['path', 'tooth w-good', { d: 'M-0.12 0.07Q0 0.24 0.12 0.07ZM-0.04 0.07V0.145M0 0.07V0.155M0.04 0.07V0.145' }],
           ['path', 'glint w-good', { d: 'M0 -0.055L0.013 -0.013L0.055 0L0.013 0.013L0 0.055L-0.013 0.013L-0.055 0L-0.013 -0.013Z', transform: 'translate(0.115 0.09)' }]] },
  // the gentleman: a monocle on a chain, and one raised eyebrow
  { voice: 'gent', name: 'The gentleman', about: 'Ahem. After you.', idle: 'M-0.05 0.12H0.05',
    wear: [['circle', 'wear', { cx: 0.13, cy: -0.06, r: 0.095 }], ['path', 'wear thin', { d: 'M0.205 0Q0.255 0.1 0.2 0.21' }], ['path', 'wear', { d: 'M0.065 -0.185Q0.13 -0.22 0.195 -0.185' }]] },
  // the cat: whiskers, a nose, and a mouth like a w
  { voice: 'cat', name: 'The cat', about: 'Fits, therefore sits.', idle: 'M-0.06 0.095Q-0.03 0.135 0 0.095Q0.03 0.135 0.06 0.095',
    wear: [['path', 'wear thin', { d: 'M-0.2 0.04L-0.27 0.02M-0.2 0.075L-0.27 0.085M0.2 0.04L0.27 0.02M0.2 0.075L0.27 0.085' }], ['path', 'wear solid', { d: 'M-0.024 0.03H0.024L0 0.058Z' }]] },
  // the cheeky one: tongue out
  { voice: 'cheeky', name: 'The cheeky one', about: 'Tongue out at the box.', idle: 'M-0.08 0.09Q0 0.15 0.08 0.09', wear: [['path', 'tongue w-idle', { d: 'M-0.012 0.122V0.165A0.036 0.036 0 0 0 0.06 0.165V0.112Z' }], ['path', 'tongue w-good', { d: 'M-0.012 0.156V0.2A0.036 0.036 0 0 0 0.06 0.2V0.136Z' }]] },
  // the smitten one: hearts where the eyes would be
  { voice: 'smitten', name: 'The smitten one', about: 'In love with its neighbour.', eye: 0.001, still: true, stare: true, idle: 'M-0.06 0.1Q0 0.16 0.06 0.1',
    wear: [-0.13, 0.13].map(function (x) {
      return ['path', 'heart', { d: 'M' + x + ' -0.005C' + (x - 0.1) + ' -0.075 ' + (x - 0.05) + ' -0.15 ' + x + ' -0.095C' + (x + 0.05) + ' -0.15 ' + (x + 0.1) + ' -0.075 ' + x + ' -0.005Z' }];
    }) },
  // the startled one: wide eyes, raised brows, a mouth like an o
  { voice: 'jumpy', name: 'The jumpy one', about: 'Did something move?', eye: 0.056, eyeY: -0.065, idle: 'M-0.034 0.135A0.034 0.04 0 1 0 0.034 0.135A0.034 0.04 0 1 0 -0.034 0.135',
    wear: [['path', 'wear', { d: 'M-0.19 -0.18Q-0.13 -0.215 -0.07 -0.18M0.07 -0.18Q0.13 -0.215 0.19 -0.18' }]] },
  // the one that has been through it: a plaster, and a wobbly mouth
  { voice: 'unlucky', name: 'The unlucky one', about: 'Dropped once too often.', idle: 'M-0.07 0.12Q-0.035 0.09 0 0.12Q0.035 0.15 0.07 0.12',
    wear: [['rect', 'plaster', { x: 0.09, y: -0.215, width: 0.15, height: 0.062, rx: 0.031, transform: 'rotate(-18 0.165 -0.184)' }], ['path', 'wear thin', { d: 'M0.15 -0.2L0.16 -0.165M0.18 -0.21L0.19 -0.175' }]] },
  // the goofy one: two front teeth
  { voice: 'goof', name: 'The goof', about: 'Two teeth and a big laugh.', idle: 'M-0.09 0.1Q0 0.14 0.09 0.1', wear: [['path', 'tooth w-idle', { d: 'M-0.034 0.118V0.168H0.034V0.118M0 0.122V0.168' }], ['path', 'tooth w-good', { d: 'M-0.034 0.153V0.205H0.034V0.153M0 0.157V0.205' }]] },
  // the pirate: a patch on a strap
  { voice: 'pirate', name: 'The pirate', about: 'Arr. Stow it in the hold.', idle: 'M-0.05 0.11Q0.03 0.15 0.08 0.09',
    wear: [['path', 'wear thin', { d: 'M-0.27 -0.16L-0.19 -0.1M-0.07 -0.09L0.27 -0.175' }], ['ellipse', 'wear solid', { cx: -0.13, cy: -0.055, rx: 0.078, ry: 0.068 }]] },
  // the goth: a fringe over one eye, a shadow under the other, and its own colours, since it will not wear anyone else's
  { voice: 'goth', name: 'The goth', about: 'It is not a phase. It is a shape.', color: '#4B4460', ink: '#F1ECFF', idle: 'M-0.05 0.13Q0 0.105 0.05 0.13',
    wear: [['path', 'wear thin', { d: 'M-0.18 0.014Q-0.13 0.042 -0.08 0.014' }],
           ['path', 'fringe', { d: 'M-0.23 -0.17Q0 -0.25 0.26 -0.19L0.265 0.03L0.21 -0.02L0.16 0.04L0.1 -0.01L0.05 0.02L0 -0.07L-0.07 -0.13L-0.15 -0.17Z' }]] }
];

// The powers of chapter two. Each is a face like those above, with a power: the name game.js
// knows it by. tip is the one line shown in the game while it is picked up; does is the longer
// account on the page that introduces them. They are dealt by power, never as a plain personality.
var PackmanPowers = [
  { power: 'mine', voice: 'mine', name: 'Mine', color: '#2A2438', ink: '#F1ECFF', idle: 'M-0.06 0.13Q0 0.1 0.06 0.13',
    tip: 'Mine: put it down before the count runs out. Hold it any longer and boom.',
    does: 'Its fuse burns while you hold it, whether you are carrying it or turning it, and counts down from three, fast: two and a half seconds. Put it down in time, anywhere, and it goes out. Hold on too long and it blows in your hand, tossing out everything it is touching.',
    wear: [['path', 'wear', { d: 'M-0.2 -0.165L-0.08 -0.13M0.2 -0.165L0.08 -0.13' }],
           // the fuse, from the mine out to its tip, where the spark sits; game.js shortens it as it burns
           ['path', 'fuse', { d: 'M-0.02 -0.19Q-0.02 -0.3 0.06 -0.3Q0.13 -0.3 0.16 -0.25', pathLength: 1 }],
           ['path', 'spark', { d: 'M0 -0.055L0.017 -0.017L0.055 0L0.017 0.017L0 0.055L-0.017 0.017L-0.055 0L-0.017 -0.017Z', transform: 'translate(0.16 -0.25)' }]],
    // a rivet at every corner
    pour: {
      square: [['circle', 'rivet', { cx: -0.366, cy: -0.366, r: 0.035 }], ['circle', 'rivet', { cx: 0.366, cy: -0.366, r: 0.035 }], ['circle', 'rivet', { cx: 0.366, cy: 0.366, r: 0.035 }], ['circle', 'rivet', { cx: -0.366, cy: 0.366, r: 0.035 }]],
      domino: [['circle', 'rivet', { cx: -0.83, cy: -0.415, r: 0.035 }], ['circle', 'rivet', { cx: 0.83, cy: -0.415, r: 0.035 }], ['circle', 'rivet', { cx: 0.83, cy: 0.415, r: 0.035 }], ['circle', 'rivet', { cx: -0.83, cy: 0.415, r: 0.035 }]],
      hexagon: [['circle', 'rivet', { cx: 0.81, cy: 0, r: 0.035 }], ['circle', 'rivet', { cx: 0.405, cy: 0.701, r: 0.035 }], ['circle', 'rivet', { cx: -0.405, cy: 0.701, r: 0.035 }], ['circle', 'rivet', { cx: -0.81, cy: 0, r: 0.035 }], ['circle', 'rivet', { cx: -0.405, cy: -0.701, r: 0.035 }], ['circle', 'rivet', { cx: 0.405, cy: -0.701, r: 0.035 }]],
      triangle: [['circle', 'rivet', { cx: 0, cy: -0.387, r: 0.035 }], ['circle', 'rivet', { cx: 0.335, cy: 0.194, r: 0.035 }], ['circle', 'rivet', { cx: -0.335, cy: 0.194, r: 0.035 }]]
    } },

  // the ghost: a pale sheet with hollow eyes, a mouth saying boo, and a wavy hem. It smiles once it has found a shape to share with.
  { power: 'ghost', voice: 'ghost', name: 'Ghost', color: '#F4FBFF', eye: 0.001, still: true, stare: true, idle: 'M0 0.12h0.001',
    tip: 'Ghost: it has no place of its own. Lay it over one other shape, and only one.',
    does: 'It is one shape more than the box has room for. It fits only by lying over one other shape, and only one: the one underneath shows through it, and it smiles.',
    wear: [['ellipse', 'eye', { cx: -0.13, cy: -0.06, rx: 0.05, ry: 0.07 }], ['ellipse', 'eye', { cx: 0.13, cy: -0.06, rx: 0.05, ry: 0.07 }],
           ['ellipse', 'boo', { cx: 0, cy: 0.125, rx: 0.04, ry: 0.055 }],
           ['path', 'hem', { d: 'M-0.24 0.27q0.04 0.05 0.08 0q0.04 -0.05 0.08 0q0.04 0.05 0.08 0q0.04 -0.05 0.08 0q0.04 0.05 0.08 0q0.04 -0.05 0.08 0' }],
           ['ellipse', 'shine', { cx: -0.19, cy: -0.19, rx: 0.06, ry: 0.025, transform: 'rotate(-25 -0.19 -0.19)' }]] },
  { power: 'sticky', voice: 'sticky', name: 'Sticky', color: '#FFB52E', idle: 'M-0.09 0.08Q0 0.17 0.09 0.08',
    tip: 'Sticky: glues to what it touches and rides along. Pick it up to peel it off.',
    does: 'In the box it glues itself to the nearest shape it touches, and goes wherever that one goes. Pick it up to peel it off.',
    // Glue, thick as honey, poured over the top of whatever shape it is and running down: blobs along the top edge, drips below them, and a glint.
    // It never stops running: each drip (the ones marked so) stretches, lets go of a drop that falls right down the page, and springs back. See dripping, below.
    pour: {
      square: [['circle', 'honey', { cx: -0.39, cy: -0.5, r: 0.13 }], ['circle', 'honey', { cx: -0.14, cy: -0.5, r: 0.17 }], ['circle', 'honey', { cx: 0.12, cy: -0.5, r: 0.12 }], ['circle', 'honey', { cx: 0.36, cy: -0.5, r: 0.19 }], ['rect', 'honey drip', { x: -0.185, y: -0.4, width: 0.09, height: 0.145, rx: 0.045 }], ['rect', 'honey drip', { x: 0.315, y: -0.38, width: 0.09, height: 0.185, rx: 0.045 }], ['ellipse', 'shine', { cx: -0.36, cy: 0.34, rx: 0.07, ry: 0.03 }]],
      domino: [['circle', 'honey', { cx: -0.9, cy: -0.5, r: 0.14 }], ['circle', 'honey', { cx: -0.66, cy: -0.5, r: 0.18 }], ['circle', 'honey', { cx: -0.4, cy: -0.5, r: 0.12 }], ['circle', 'honey', { cx: -0.15, cy: -0.5, r: 0.17 }], ['circle', 'honey', { cx: 0.1, cy: -0.5, r: 0.13 }], ['circle', 'honey', { cx: 0.35, cy: -0.5, r: 0.18 }], ['circle', 'honey', { cx: 0.62, cy: -0.5, r: 0.12 }], ['circle', 'honey', { cx: 0.86, cy: -0.5, r: 0.19 }], ['rect', 'honey drip', { x: -0.705, y: -0.4, width: 0.09, height: 0.16, rx: 0.045 }], ['rect', 'honey drip', { x: 0.305, y: -0.4, width: 0.09, height: 0.12, rx: 0.045 }], ['rect', 'honey drip', { x: 0.815, y: -0.38, width: 0.09, height: 0.2, rx: 0.045 }], ['ellipse', 'shine', { cx: -0.84, cy: 0.34, rx: 0.07, ry: 0.03 }]],
      hexagon: [['circle', 'honey', { cx: -0.45, cy: -0.866, r: 0.2 }], ['circle', 'honey', { cx: -0.15, cy: -0.866, r: 0.25 }], ['circle', 'honey', { cx: 0.17, cy: -0.866, r: 0.19 }], ['circle', 'honey', { cx: 0.45, cy: -0.866, r: 0.26 }], ['rect', 'honey drip', { x: -0.21, y: -0.72, width: 0.12, height: 0.24, rx: 0.06 }], ['rect', 'honey drip', { x: 0.39, y: -0.7, width: 0.12, height: 0.32, rx: 0.06 }], ['ellipse', 'shine', { cx: -0.5, cy: 0.56, rx: 0.09, ry: 0.04 }]],
      triangle: [['circle', 'honey', { cx: 0, cy: -0.577, r: 0.33 }], ['rect', 'honey drip', { x: -0.115, y: -0.3, width: 0.07, height: 0.15, rx: 0.035 }], ['rect', 'honey drip', { x: 0.05, y: -0.3, width: 0.07, height: 0.1, rx: 0.035 }], ['ellipse', 'shine', { cx: -0.28, cy: 0.2, rx: 0.05, ry: 0.022 }]]
    } },
  { power: 'puffer', voice: 'puffer', name: 'Puffer', color: '#45D9E6', eye: 0.056, idle: 'M-0.034 0.135A0.034 0.04 0 1 0 0.034 0.135A0.034 0.04 0 1 0 -0.034 0.135',
    tip: 'Puffer: put it down and it puffs up, shoving away whatever it touches.',
    does: 'Every time it is put down in the box it puffs up and shoves away every shape it is touching. Put it in first, and build round it.',
    wear: [['circle', 'blush', { cx: -0.23, cy: 0.05, r: 0.055 }], ['circle', 'blush', { cx: 0.23, cy: 0.05, r: 0.055 }]],
    // spines, all the way round, pointing in from every side
    pour: {
      square: [['path', 'spike', { d: 'M-0.25 -0.45L-0.25 -0.36M0 -0.45L0 -0.36M0.25 -0.45L0.25 -0.36M0.45 -0.25L0.36 -0.25M0.45 0L0.36 0M0.45 0.25L0.36 0.25M0.25 0.45L0.25 0.36M0 0.45L0 0.36M-0.25 0.45L-0.25 0.36M-0.45 0.25L-0.36 0.25M-0.45 0L-0.36 0M-0.45 -0.25L-0.36 -0.25' }]],
      domino: [['path', 'spike', { d: 'M-0.8 -0.45L-0.8 -0.36M-0.4 -0.45L-0.4 -0.36M0 -0.45L0 -0.36M0.4 -0.45L0.4 -0.36M0.8 -0.45L0.8 -0.36M0.95 -0.25L0.86 -0.25M0.95 0L0.86 0M0.95 0.25L0.86 0.25M0.8 0.45L0.8 0.36M0.4 0.45L0.4 0.36M0 0.45L0 0.36M-0.4 0.45L-0.4 0.36M-0.8 0.45L-0.8 0.36M-0.95 0.25L-0.86 0.25M-0.95 0L-0.86 0M-0.95 -0.25L-0.86 -0.25' }]],
      hexagon: [['path', 'spike', { d: 'M0.832 0.192L0.754 0.147M0.707 0.408L0.629 0.363M0.582 0.625L0.504 0.58M0.25 0.816L0.25 0.726M0 0.816L0 0.726M-0.25 0.816L-0.25 0.726M-0.582 0.625L-0.504 0.58M-0.707 0.408L-0.629 0.363M-0.832 0.192L-0.754 0.147M-0.832 -0.192L-0.754 -0.147M-0.707 -0.408L-0.629 -0.363M-0.582 -0.625L-0.504 -0.58M-0.25 -0.816L-0.25 -0.726M0 -0.816L0 -0.726M0.25 -0.816L0.25 -0.726M0.582 -0.625L0.504 -0.58M0.707 -0.408L0.629 -0.363M0.832 -0.192L0.754 -0.147' }]],
      triangle: [['path', 'spike', { d: 'M0.057 -0.379L-0.021 -0.334M0.207 -0.119L0.129 -0.074M0.357 0.14L0.279 0.185M0.3 0.239L0.3 0.149M-0.3 0.239L-0.3 0.149M-0.357 0.14L-0.279 0.185M-0.207 -0.119L-0.129 -0.074M-0.057 -0.379L0.021 -0.334' }]]
    } },

  { power: 'chameleon', voice: 'chameleon', name: 'Chameleon', color: '#3DDBB4', eye: 0.001, still: true, stare: true, idle: 'M-0.06 0.1Q0 0.14 0.06 0.1',
    tip: 'Chameleon: a disguiser. It changes shape each time you pick it up, and only counts in its one true shape.',
    does: 'A disguiser, here to throw you off. It may be dealt as any of the four shapes, and goes round them all, with a colour for each, changing every time you pick it up. It only counts as packed in its real shape, and nothing says which that is.',
    wear: [['circle', 'white', { cx: -0.13, cy: -0.06, r: 0.07 }], ['circle', 'white', { cx: 0.13, cy: -0.06, r: 0.07 }],
           ['circle', 'eye', { cx: -0.155, cy: -0.08, r: 0.03 }], ['circle', 'eye', { cx: 0.155, cy: -0.04, r: 0.03 }],
           ['path', 'wear thin', { d: 'M0.17 0.14Q0.27 0.12 0.25 0.2Q0.23 0.26 0.18 0.22Q0.16 0.19 0.2 0.18' }]] },
  { power: 'sleeper', voice: 'sleeper', name: 'Sleeper', color: '#9B7BFF', still: true, eye: 0.036, eyeY: -0.045, idle: 'M-0.03 0.11A0.03 0.035 0 1 0 0.03 0.11A0.03 0.035 0 1 0 -0.03 0.11',
    tip: 'Sleeper: it will not turn inside the box. Take it out to turn it.',
    does: 'Inside the box it falls asleep and cannot be turned. Carry it out, turn it, and bring it back.',
    // Awake it has heavy lids. Asleep (the rest, shown only then): eyes shut in two curves, mouth open,
    // a strand of drool from the corner of it, which stretches and falls as the glue does (see dripping, below), and three z's drifting up.
    wear: [['path', 'wear lid', { d: 'M-0.185 -0.078H-0.075M0.075 -0.078H0.185' }],
           ['path', 'wear snooze', { d: 'M-0.185 -0.075Q-0.13 -0.015 -0.075 -0.075M0.075 -0.075Q0.13 -0.015 0.185 -0.075' }],
           ['ellipse', 'yawn', { cx: 0, cy: 0.115, rx: 0.042, ry: 0.05 }],
           ['rect', 'drool drip', { x: 0.016, y: 0.14, width: 0.04, height: 0.085, rx: 0.02 }],
           ['path', 'zz z1', { d: 'M0.1 -0.17H0.145L0.1 -0.125H0.145' }], ['path', 'zz z2', { d: 'M0.165 -0.25H0.225L0.165 -0.19H0.225' }],
           ['path', 'zz z3', { d: 'M0.2 -0.335H0.275L0.2 -0.265H0.275' }]] },
  { power: 'magnet', voice: 'magnet', name: 'Magnet', color: '#D5DAE3', eye: 0.05, idle: 'M-0.08 0.09Q0 0.16 0.08 0.09',
    tip: 'Magnet: while you hold it, it drags every shape nearby towards it. Put it down and it lets go.',
    does: 'It is only a magnet while you are holding it. Waves stand round it, and every shape inside them slides towards it until something stops it. Put it down and it is an ordinary shape again.',
    wear: [['path', 'wear thin', { d: 'M-0.1 -0.2Q0 -0.27 0.1 -0.2M-0.06 -0.165Q0 -0.205 0.06 -0.165' }]],
    // its two poles: one end of the shape red and the other blue
    pour: {
      square: [['rect', 'pole n', { x: -1.3, y: -1, width: 1, height: 2 }], ['rect', 'pole s', { x: 0.3, y: -1, width: 1, height: 2 }]],
      domino: [['rect', 'pole n', { x: -1.3, y: -1, width: 0.6, height: 2 }], ['rect', 'pole s', { x: 0.7, y: -1, width: 1, height: 2 }]],
      hexagon: [['rect', 'pole n', { x: -1.3, y: -1, width: 0.68, height: 2 }], ['rect', 'pole s', { x: 0.62, y: -1, width: 1, height: 2 }]],
      triangle: [['rect', 'pole n', { x: -1.3, y: -1, width: 1.04, height: 2 }], ['rect', 'pole s', { x: 0.26, y: -1, width: 1, height: 2 }]]
    } }
];

// How a shape is drawn, for the game and for every page that shows one: the same parts, built the same way.
var PackmanPiece = (function () {
  var NS = 'http://www.w3.org/2000/svg', made = 0;
  function el(name, cls, at) {
    var e = document.createElementNS(NS, name);
    if (cls) e.setAttribute('class', cls);
    for (var k in at) e.setAttribute(k, at[k]);
    return e;
  }
  // a square about the origin, h from its middle to a side, with corners rounded by r: the outline of a block
  function block(h, r) {
    var a = h - r;
    return 'M' + -a + ' ' + -h + 'H' + a + 'Q' + h + ' ' + -h + ' ' + h + ' ' + -a + 'V' + a + 'Q' + h + ' ' + h + ' ' + a + ' ' + h + 'H' + -a + 'Q' + -h + ' ' + h + ' ' + -h + ' ' + a + 'V' + -a + 'Q' + -h + ' ' + -h + ' ' + -a + ' ' + -h + 'Z';
  }
  // The face a kit gives a shape: two eyes, with the shut and the screwed-up pair that stand in for them,
  // the three mouths (at rest, packed, squashed), and whatever it wears. face is the lot; eyes is the group to move.
  function face(kit, type) {
    var f = el('g', 'face'), eyes = el('g', 'eyes');
    if (type === 'triangle') f.setAttribute('transform', 'translate(0 0.03) scale(0.74)');
    if (type === 'hexagon') f.setAttribute('transform', 'scale(1.3)');
    [-0.13, 0.13].forEach(function (x) {
      eyes.appendChild(el('circle', 'eye', { cx: x, cy: kit.eyeY || -0.06, r: kit.eye || 0.048, 'data-x': x, 'data-y': kit.eyeY || -0.06 }));
    });
    eyes.appendChild(el('path', 'shut', { d: 'M-0.18 -0.06H-0.08M0.08 -0.06H0.18' }));
    eyes.appendChild(el('path', 'wince', { d: 'M-0.18 -0.11L-0.09 -0.06L-0.18 -0.01M0.18 -0.11L0.09 -0.06L0.18 -0.01' }));   // screwed-up eyes, for when it is squashed
    f.appendChild(eyes);
    f.appendChild(el('path', 'mouth m-idle', { d: kit.idle || 'M-0.07 0.1 Q0 0.15 0.07 0.1' }));
    f.appendChild(el('path', 'mouth m-good', { d: 'M-0.12 0.07 Q0 0.24 0.12 0.07' }));
    f.appendChild(el('circle', 'mouth m-bad', { cx: 0, cy: 0.13, r: 0.045 }));
    (kit.wear || []).forEach(function (w) { f.appendChild(el(w[0], w[1], w[2])); if (/\bdrip\b/.test(w[1])) drips(); });
    return { face: f, eyes: eyes };
  }
  // What a kit pours over a shape of this type, if anything, cut off at the outline d. It lies on the body, under the face.
  // g is the group to draw; edge is the outline it is cut to, to be given a new d whenever the shape is drawn at another size.
  function pour(kit, type, d) {
    var po = kit.pour && kit.pour[type];
    if (!po) return null;
    var g = el('g', 'goo'), clip = el('clipPath', '', { id: 'goo' + (++made) }), edge = el('path', '', { d: d }), all = el('g', '', { 'clip-path': 'url(#goo' + made + ')' });
    clip.appendChild(edge); g.appendChild(clip);
    po.forEach(function (w) { all.appendChild(el(w[0], w[1], w[2])); if (/\bdrip\b/.test(w[1])) drips(); });
    g.appendChild(all);
    return { g: g, edge: edge };
  }
  // Whatever is marked drip (the glue's runs, the sleeper's drool) keeps dripping, wherever on whatever page it is drawn, and
  // does it as something thick and sticky would on a shape stood upright, with the ground at the foot of the page.
  //   On the shape. Glue comes down the run and gathers in a bead at its tip. The bead is pinned where it is until it weighs
  //   more than its edge can hold (HOLD). After that it slides, and how fast is settled at once, since anything this thick has
  //   no momentum to speak of: the weight over what it can hold, against its own thickness. So it starts slowly and gets no
  //   faster than a crawl. It leaves a film behind it as it goes and is fed from above, and comes to the size where the two are even.
  //   At the edge. There is nothing under the bead now, but it does not simply fall: it hangs from the edge by a thread of
  //   itself. The thread carries all its weight to begin with and less as it is drawn longer and thinner, so the bead sinks
  //   away, faster and faster, until the thread is too thin to be one and parts.
  //   In the air. The drop falls freely: the same gain in speed every moment, nothing holding it back. It pulls itself round,
  //   with a shiver, as the thread it left snaps back up to the edge. At the foot of the page it lands and spreads, fast with
  //   the blow and then slowly, being thick.
  //   Behind it. The film left on the shape does not climb back: it runs on down after the bead, and off the edge.
  // The run itself is never touched. The film and the bead are drawn in the shape, over its face, and are cut off at the shape's
  // edge as the run is; the thread and the drop are put on the page itself, so nothing cuts them off.
  // (Only numbers change, the way the eyes are moved: nothing in a shape is animated by CSS.)
  var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches, dripping = 0, runs = [], drops = [], going = 0, then = 0;
  var FEED = 0.55,    // glue reaching the bead, a second (a bead of 1 is twice what a run can hold)
      HOLD = 0.5,     // the weight a bead can be and stay where it is
      SLIDE = 0.4,    // how fast a bead slides that weighs twice what can be held, in squares a second: weight against thickness
      LEAVE = 1.8,    // how much of itself a bead leaves behind in sliding one square
      FALL = 2600,    // gravity, in pixels a second, a second
      DRAIN = 0.9;    // how fast the film left behind runs off after the bead, in squares a second
  function at(d, x, y) {   // a point of a run's own, as a place on the screen, and how many pixels one of its units is there
    var m = d.getScreenCTM(), svg = d.ownerSVGElement;
    if (!m || !svg) return null;
    var pt = svg.createSVGPoint();
    pt.x = x; pt.y = y; pt = pt.matrixTransform(m);
    return { x: pt.x, y: pt.y, k: Math.hypot(m.a, m.b) };
  }
  function begin(d) {
    var w = +d.getAttribute('width'), cls = d.getAttribute('class').replace(/\bdrip\b/, '').trim(), ink = getComputedStyle(d), film = el('path', '', { fill: 'none' }), bead = el('path', cls);
    film.style.stroke = ink.fill; film.style.strokeLinecap = film.style.strokeLinejoin = 'round';
    // They go on top of everything the shape has, its face too, and are cut off at its edge if the run is.
    var goo = d.closest('.goo'), host = goo ? goo.parentNode : d.parentNode, over = el('g', goo ? 'goo' : ''), cut = goo && d.parentNode.getAttribute('clip-path');
    if (cut) over.setAttribute('clip-path', cut);
    if (goo) bead.style.stroke = 'none';
    over.appendChild(film); over.appendChild(bead); host.appendChild(over);
    d.busy = true;
    var tip = [+d.getAttribute('x') + w / 2, +d.getAttribute('y') + +d.getAttribute('height')];
    runs.push({ d: d, over: over, film: film, bead: bead, w: w + (goo ? parseFloat(ink.strokeWidth) || 0 : 0),   // as wide as the run looks, with the line round it
      pts: [tip], at: tip, way: [0, 1], gone: 0,   // pts: the corners of the way it has come; at: where the bead is; way: which way is down; gone: how much of the film has drained off, from the top
      m: 0.15, s: 0, v: 0, off: false, feed: FEED * (0.8 + Math.random() * 0.45),   // m: what the bead weighs; s: how far it has slid; v: how fast
      fill: (d.closest('.piece') || d.ownerSVGElement).querySelector('.fill') });   // the shape it is on
    if (!going) { then = performance.now(); going = requestAnimationFrame(frame); }
  }
  function fat(r) { return r.w * 0.36 * Math.pow(r.m / HOLD, 1 / 3); }   // a bead's radius: its weight is its volume
  // The bead goes down the page, whichever way up its shape is, and whichever way it is turned as it goes. The film it has
  // already left is stuck to the shape and turns with it: only the bead takes the new way down, from where it has got to.
  function slide(r, dt) {
    var m = r.over.getScreenCTM(), a = m ? Math.atan2(m.b, m.a) : 0, way = [Math.sin(a), Math.cos(a)];
    if (way[0] * r.way[0] + way[1] * r.way[1] < 0.9995 && r.s > 0) r.pts.push(r.at);   // a corner in the film, where the way down changed
    r.way = way;
    r.at = [r.at[0] + way[0] * r.v * dt, r.at[1] + way[1] * r.v * dt];
    r.s += r.v * dt;
  }
  // One run of glue, all of a piece: a film three quarters the width of the run it comes from, and at the end of it a bead
  // only a little wider, drawn as a drop with its tail running up into the film.
  function show(r) {
    var line = r.pts.concat([r.at]), skip = r.gone, d = '', n = function (v) { return v.toFixed(4); };
    for (var i = 0; i < line.length - 1; i++) {   // the film, from as far down it as has not drained off yet
      var p = line[i], q = line[i + 1], l = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (skip >= l && i < line.length - 2) { skip -= l; continue; }
      var k = l ? Math.min(1, skip / l) : 0;
      if (!d) d = 'M' + n(p[0] + (q[0] - p[0]) * k) + ' ' + n(p[1] + (q[1] - p[1]) * k);
      d += 'L' + n(q[0]) + ' ' + n(q[1]);
      skip = 0;
    }
    r.film.setAttribute('d', d || 'M' + n(r.at[0]) + ' ' + n(r.at[1]));
    r.film.style.strokeWidth = n(r.w * 0.75) + 'px';
    if (r.off) { r.bead.setAttribute('d', ''); return; }
    var b = fat(r), u = r.way, s = [u[1], -u[0]], half = r.w * 0.375, c = [r.at[0] - u[0] * b * 0.6, r.at[1] - u[1] * b * 0.6], up = 3.2 * b;
    function pt(across, along) { return n(c[0] + s[0] * across + u[0] * along) + ' ' + n(c[1] + s[1] * across + u[1] * along); }
    r.bead.setAttribute('d', 'M' + pt(-half, -up) + 'Q' + pt(-half, -b * 1.4) + ' ' + pt(-b, 0) + 'A' + n(b) + ' ' + n(b) + ' 0 0 0 ' + pt(0, b) + 'A' + n(b) + ' ' + n(b) + ' 0 0 0 ' + pt(b, 0) +
      'Q' + pt(half, -b * 1.4) + ' ' + pt(half, -up) + 'Z');
  }
  function end(r) {
    if (r.over.parentNode) r.over.parentNode.removeChild(r.over);
    r.d.busy = false;
  }
  // Is the tip of the run still on its shape? (Where a browser cannot say, it is for one square.)
  function onShape(r, tip) {
    var s = r.fill, m = s && s.isPointInFill && s.getScreenCTM();
    if (!m) return r.s < 1;
    var pt = s.ownerSVGElement.createSVGPoint();
    pt.x = tip.x; pt.y = tip.y;
    return s.isPointInFill(pt.matrixTransform(m.inverse()));
  }
  // the bead goes over the edge: from here it is on the page, hanging by a thread from where the edge was
  function hang(r, tip) {
    if (tip.y > innerHeight || tip.y < -40) return;
    var w = Math.max(3.5, 2.2 * fat(r) * tip.k), h = w * 1.2, ink = getComputedStyle(r.d), b = document.createElement('div'), t = document.createElement('div');
    var base = 'position:fixed; z-index:2147483000; pointer-events:none; top:0; background:' + ink.fill + '; will-change:transform; ';
    t.style.cssText = base + 'left:' + tip.x.toFixed(1) + 'px; width:1px; height:1px; transform-origin:50% 0';
    b.style.cssText = base + 'left:' + (tip.x - w / 2).toFixed(1) + 'px; width:' + w.toFixed(1) + 'px; height:' + h.toFixed(1) + 'px; border-radius:50% 50% 50% 50% / 66% 66% 34% 34%; transform-origin:50% 100%; transition:border-radius .12s' +
      (ink.stroke && ink.stroke !== 'none' && ink.stroke !== ink.fill ? '; box-shadow:0 0 0 1px ' + ink.stroke : '');   // the colour of what it came from, and its line if it has one
    [t, b].forEach(function (e) { e.setAttribute('aria-hidden', 'true'); document.body.appendChild(e); });
    drops.push({ el: b, thread: t, from: tip.y, y: tip.y - h * 0.75, start: tip.y - h * 0.75, w: w, h: h, v: r.v * tip.k, held: true, len: 0, t: 0, flat: 0 });
  }
  function frame(now) {
    var dt = Math.min(0.034, Math.max(0, (now - then) / 1000));
    then = now;
    runs = runs.filter(function (r) {
      if (!r.d.isConnected || r.d.closest('.glued') || getComputedStyle(r.d).visibility === 'hidden') { end(r); return false; }   // gone, or put out of sight (the sleeper woken, say), or stuck fast
      if (!r.off) {
        r.v = SLIDE * Math.max(0, r.m - HOLD) / HOLD;
        r.m += (r.feed - LEAVE * r.v) * dt;
        slide(r, dt);
        var tip = at(r.over, r.at[0], r.at[1]);
        if (!tip) { end(r); return false; }
        if (r.s > 0 && (!onShape(r, tip) || r.s > 2.4)) { hang(r, tip); r.off = true; }
      } else {
        r.gone += DRAIN * dt;   // the film goes on down after the bead, and off the edge
        if (r.gone >= r.s) { end(r); return false; }
      }
      show(r);
      return true;
    });
    drops = drops.filter(function (o) {
      var sx = 1, sy = 1, reach = o.h;   // reach: how far the thread can be drawn before it starts to give
      if (o.flat) {   // landed: it spreads, fast with the blow and then slowly, and is gone
        o.flat += dt;
        sx = 1 + 1.3 * (1 - Math.exp(-o.flat / 0.07)) + 0.6 * (1 - Math.exp(-o.flat / 0.9)); sy = 1 / sx;
        o.el.style.opacity = Math.max(0, Math.min(1, (1.7 - o.flat) / 0.6)).toFixed(3);
        if (o.flat > 1.7) { o.el.remove(); o.thread.remove(); return false; }
      } else {
        var ext = o.y - o.start;
        o.v += FALL * (o.held ? 1 - Math.exp(-ext / reach) : 1) * dt;   // the thread holds it up, and less the longer it is
        o.y += o.v * dt;
        if (o.held) {
          var thick = o.w * 0.55 * Math.exp(-ext / (1.1 * reach));
          o.len = o.y + o.h * 0.4 - o.from;
          sy = 1 + 0.25 * Math.min(1, ext / reach); sx = 1 / Math.sqrt(sy);   // drawn out by what it hangs from
          o.thread.style.transform = 'translate(-50%, ' + o.from.toFixed(1) + 'px) scale(' + Math.max(1, thick).toFixed(2) + ',' + Math.max(1, o.len).toFixed(1) + ')';
          if (thick < 1.2) { o.held = false; o.el.style.borderRadius = '50%'; }   // too thin to be a thread
        } else {
          o.t += dt;
          sy = 1 + 0.22 * Math.exp(-o.t / 0.22) * Math.cos(o.t * 38); sx = 1 / Math.sqrt(sy);   // free, it pulls itself round, and shivers
        }
        if (o.y + o.h >= innerHeight) { o.y = innerHeight - o.h; o.flat = 0.0001; o.held = false; o.el.style.borderRadius = '50%'; }
      }
      if (!o.held && o.len > 0) {   // the thread it left snaps back up to the edge
        o.len -= 1400 * dt;
        if (o.len > 0) o.thread.style.transform = 'translate(-50%, ' + o.from.toFixed(1) + 'px) scale(1,' + o.len.toFixed(1) + ')'; else o.thread.style.display = 'none';
      }
      o.el.style.transform = 'translateY(' + o.y.toFixed(1) + 'px) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')';
      return true;
    });
    going = runs.length || drops.length ? requestAnimationFrame(frame) : 0;
  }
  function drips() {
    if (dripping || calm || !window.requestAnimationFrame) return;
    dripping = setInterval(function () {
      if (document.hidden) return;
      var left = 3;
      Array.prototype.forEach.call(document.querySelectorAll('svg .drip'), function (d) {
        if (d.busy || left < 1 || Math.random() > 0.4 || d.closest('.glued, .avatar') || getComputedStyle(d).visibility === 'hidden') return;   // (glued: stuck to another shape, in the game, its glue is holding and has stopped running; avatar: a picture of a shape, on the leaderboard and such, which is not to drip over what is under it; hidden: on a sheet that is put away, or under eyesight, or the drool of a sleeper that is awake)
        var top = at(d, +d.getAttribute('x'), +d.getAttribute('y'));
        if (!top || top.y < 0 || top.y > innerHeight) return;   // nor one that is off the page
        left--; begin(d);
      });
    }, 900);
  }
  return { el: el, block: block, face: face, pour: pour };
})();
