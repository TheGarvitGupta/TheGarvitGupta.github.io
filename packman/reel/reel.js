// Packman playing itself, for a short film of it: loaded by game.js only on a copy on this machine, when the
// address says ?reel (see index.html beside it, which shows it at the size of a phone). It is the real game: the shapes of
// each level fly to their spots in its solution, one hard on the heels of another, and the game judges and sounds
// as it does for a player. The party is kept for the card at the end. A tap starts it, because a browser lets nothing make a sound until
// the page has been touched; with ?auto in the address it starts by itself, silent.
(function () {
  'use strict';
  var P = window.Packman;
  // the levels shown, in order: how long after one shape the next sets off, how long each is in the air, and how long the packed box is left on show
  var SHOW = [
    { name: 'Home', gap: 70, air: 460, hold: 600 },
    { name: 'Dozen', gap: 45, air: 500, hold: 650 },
    { name: 'Barge', gap: 75, air: 460, hold: 650 }
  ];
  // and then the card it ends on: the name, with shapes crowding round it. Each is [kind, across, down, turn], in squares from the middle.
  var CROWD = [['hexagon', -1.75, -4.0, -10], ['square', 0.4, -4.45, 9], ['triangle', 2.2, -3.75, 18], ['domino', 0.5, -2.85, 5], ['triangle', -2.35, -2.3, -22],
    ['square', -2.05, 2.55, -12], ['triangle', 2.45, 2.3, -15], ['triangle', -0.5, 3.2, 200], ['hexagon', 1.55, 3.75, 15], ['domino', -1.0, 4.7, -8], ['square', 1.3, 5.6, 20], ['square', -2.3, 6.0, 8]];
  var HUES = ['#FF6B6B', '#FFC93C', '#3DDBB4', '#4DA8FF', '#9B7BFF', '#FF8FCB', '#FF9F45', '#B5E655', '#45D9E6', '#D987F5', '#FFB59E'];
  var UNIT = 60, card = null;   // a square on the card, in pixels
  var style = document.createElement('style');
  style.textContent = '.dev,#win-lb{display:none !important}' +
    '.reel-end{position:fixed; inset:0; z-index:25; display:grid; place-items:center; overflow:hidden; --ink:#2B2140; --face:#2B2140; --bw:5px; color:#2B2140;' +
    ' background:#FFF4DE radial-gradient(rgba(43,33,64,.09) 1.6px, transparent 1.7px) 0 0 / 26px 26px; animation:reel-in .3s ease-out both}' +
    '@keyframes reel-in{from{opacity:0; transform:scale(1.06)}}' +
    '.reel-end > svg{position:absolute; left:50%; top:50%; overflow:visible}' +
    '.reel-pop{transform-box:fill-box; transform-origin:center; animation:reel-pop .6s cubic-bezier(.34,1.56,.64,1) both; animation-delay:calc(var(--n) * 55ms + 200ms)}' +
    '@keyframes reel-pop{from{transform:scale(0) rotate(-70deg); opacity:0}}' +
    '.reel-bob{transform-box:fill-box; transform-origin:center; animation:reel-bob 1.1s ease-in-out infinite alternate; animation-delay:calc(var(--n) * -170ms)}' +
    '@keyframes reel-bob{from{transform:translateY(.07px) rotate(-4deg)} to{transform:translateY(-.09px) rotate(4deg)}}' +
    // (the mascot and the name side by side, as at the top of the game)
    '.reel-name{position:relative; display:flex; align-items:center; gap:18px; margin-top:-34px}' +
    '.reel-name > svg:first-child{width:76px; height:76px; flex:none; animation:reel-pop .6s cubic-bezier(.34,1.56,.64,1) both, bob 1.6s ease-in-out .6s infinite; --n:0}' +
    '.reel-name .word{display:flex !important; font-size:60px; letter-spacing:1px} .reel-name .word b{animation:hop .6s cubic-bezier(.34,1.56,.64,1) both, wave .9s ease-in-out infinite; animation-delay:calc(var(--n) * 60ms + 250ms), calc(var(--n) * 90ms + 1200ms)}' +
    '.reel-go{position:fixed; inset:0; z-index:90; display:grid; place-items:center; border:0; padding:0; background:rgba(21,18,31,.55); cursor:pointer; -webkit-tap-highlight-color:transparent}' +
    '.reel-go span{padding:14px 30px 15px; font:700 22px/1 "Fredoka", ui-rounded, system-ui, sans-serif; color:#2B2140; background:#FFC93C; border:2.5px solid #2B2140; border-radius:18px; box-shadow:0 5px 0 #2B2140}';
  document.head.appendChild(style);

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function frame() { return new Promise(function (r) { requestAnimationFrame(r); }); }
  function ease(k) { return 1 - Math.pow(1 - k, 3); }   // fast away, gently down

  async function level(s) {
    P.play(s.name);
    await wait(380);
    var lv = P.level(), all = P.pieces();
    var spot = function (i) { return lv.solution[i] || lv.solution[lv.pieces.indexOf(all[i].type)] || lv.haunt; };
    // they set off from the middle of the box outwards
    var order = all.map(function (p, i) { return i; }).sort(function (a, b) { return Math.hypot(spot(a)[0], spot(a)[1]) - Math.hypot(spot(b)[0], spot(b)[1]); });
    var from = all.map(function (p) { return [p.x, p.y, p.angle]; }), landed = 0, start = performance.now();
    P.clock();
    for (;;) {
      var now = performance.now() - start, down = 0;
      order.forEach(function (i, n) {
        var p = all[i], to = spot(i), k = Math.max(0, Math.min(1, (now - n * s.gap) / s.air)), e = ease(k);
        var turn = ((to[2] - from[i][2]) % 360 + 540) % 360 - 180;   // the short way round
        p.x = from[i][0] + (to[0] - from[i][0]) * e; p.y = from[i][1] + (to[1] - from[i][1]) * e;
        p.angle = k < 1 ? from[i][2] + Math.round(turn * e) : to[2];
        if (k > 0 && !p.up) { p.up = true; p.el.parentNode.appendChild(p.el); }   // each one over those still waiting
        P.render(i);
        if (k >= 1) down++;
      });
      for (; landed < down; landed++) P.sfx.fit((landed + 1) / (all.length + 1));   // a note for each as it lands, climbing
      if (down === all.length) break;
      await frame();
    }
    P.judge();   // the shapes smile and the marks light up; the party is kept for the end
    await wait(s.hold);
  }
  // The card at the end. The shapes on it are the game's own, drawn as the board draws them, each with a face and a smile.
  function finish() {
    var E = PackmanPiece.el, faces = PackmanFaces.filter(function (k) { return !k.color; }).sort(function () { return Math.random() - 0.5; });
    card = document.createElement('div'); card.className = 'reel-end';
    var W = innerWidth / UNIT, H = innerHeight / UNIT;
    var svg = E('svg', '', { viewBox: (-W / 2) + ' ' + (-H / 2) + ' ' + W + ' ' + H, width: innerWidth, height: innerHeight });
    svg.style.cssText = 'margin:' + (-innerHeight / 2) + 'px 0 0 ' + (-innerWidth / 2) + 'px; --u:' + (1 / UNIT);
    CROWD.forEach(function (c, n) {
      var at = E('g', '', { transform: 'translate(' + c[1] + ' ' + (c[2] - 0.45) + ') rotate(' + c[3] + ')' }), pop = E('g', 'reel-pop'), bob = E('g', 'reel-bob piece good');
      pop.style.setProperty('--n', n); bob.style.setProperty('--n', n); bob.style.setProperty('--c', HUES[n % HUES.length]);
      bob.appendChild(E('path', 'fill', { d: P.drawn(c[0], 1 / UNIT) }));
      bob.appendChild(PackmanPiece.face(faces[n % faces.length], c[0]).face);
      pop.appendChild(bob); at.appendChild(pop); svg.appendChild(at);
    });
    card.appendChild(svg);
    var name = document.createElement('div'), logo = document.querySelector('.logo');
    name.className = 'reel-name';
    name.appendChild(logo.querySelector('svg').cloneNode(true)); name.appendChild(logo.querySelector('.word').cloneNode(true));
    card.appendChild(name);
    document.body.appendChild(card);
    P.sfx.deal(9);
    setTimeout(function () { P.confetti(170); P.sfx.win(); }, 750);
  }
  var busy = false;
  async function show() {
    if (busy) return;
    busy = true;
    P.fresh();
    await wait(350);
    for (var n = 0; n < SHOW.length; n++) await level(SHOW[n]);
    finish();
    await wait(3000);
    busy = false;
    card.style.cursor = 'pointer';   // a tap on the card plays it through again
    card.addEventListener('click', function () { card.parentNode.removeChild(card); card = null; P.wake(); show(); });
  }
  function offer(word) {
    var b = document.createElement('button'), s = document.createElement('span');
    b.className = 'reel-go'; b.type = 'button'; s.textContent = word;
    b.appendChild(s);
    b.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.sheet.open'), function (e) { e.classList.remove('open'); });
      b.parentNode.removeChild(b); P.wake(); setTimeout(function () { P.wake(); show(); }, 60);   // (the first call makes the sound, the second sets it going)
    });
    document.body.appendChild(b);
  }
  if (/[?&]auto\b/.test(location.search)) show(); else offer('Play');
})();
