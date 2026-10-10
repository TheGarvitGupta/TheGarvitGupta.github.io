/* The Packman tile in the work section: the game playing itself, as in its reel (packman/reel). Three levels
   pack themselves one after another, then the name comes up with shapes crowding round it, and it starts again.
   Nothing here is an image. The pieces are SVG, moved a frame at a time. */
(function () {
	"use strict";
	var tile = document.getElementById("packman-tile");
	if (!tile) return;

	var NS = "http://www.w3.org/2000/svg", H = Math.sqrt(3) / 2, W = 9, HT = 5.8;
	var SHAPES = {
		square: [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]],
		triangle: [[0, -2 * H / 3], [0.5, H / 3], [-0.5, H / 3]],
		hexagon: [[1, 0], [0.5, H], [-0.5, H], [-1, 0], [-0.5, -H], [0.5, -H]]
	};
	var INSET = { square: 0.5, triangle: H / 3, hexagon: H };   // centre to edge, for the sliver of gap between neighbours
	var FACE = { square: "", triangle: "translate(0 0.03) scale(0.74)", hexagon: "scale(1.3)" };
	var OUTFITS = {
		specs: '<circle class="pk-wear" cx="-0.13" cy="-0.06" r="0.088"/><circle class="pk-wear" cx="0.13" cy="-0.06" r="0.088"/><path class="pk-wear" d="M-0.042 -0.07Q0 -0.09 0.042 -0.07"/>',
		blush: '<ellipse class="pk-blush" cx="-0.215" cy="0.045" rx="0.05" ry="0.034"/><ellipse class="pk-blush" cx="0.215" cy="0.045" rx="0.05" ry="0.034"/>',
		bow: '<path class="pk-solid" d="M0 0.27L-0.1 0.215V0.325ZM0 0.27L0.1 0.215V0.325Z"/>'
	};
	var TURNS = { square: 90, triangle: 120, hexagon: 60 };   // how far round each looks the same again
	var HUES = ["#FF6B6B", "#FFC93C", "#3DDBB4", "#4DA8FF", "#9B7BFF", "#FF8FCB", "#FF9F45"];
	var WEAR = ["specs", "", "", "bow", "", "blush", "", ""];   // who wears what, going round
	function ngon(n, radius, start) {
		var out = [];
		for (var i = 0; i < n; i++) { var r = (start + i * 360 / n) * Math.PI / 180; out.push([radius * Math.cos(r), radius * Math.sin(r)]); }
		return out;
	}
	var roofY = (Math.sqrt(3) - 2) / 2;   // where the house's walls meet its roof

	// The levels shown, as the reel shows them, each from packman/levels.js: the box, and for every shape its kind and where it is
	// packed (x, y, angle); then where it waits beside the box (x, y, angle). `size` is how large the level is drawn: as large as leaves room
	// for its shapes to wait beside the box. `gap` is how long after one shape the next sets off, `air` how long each is in the air.
	var LEVELS = [
		{ size: 1.3, turn: 90, gap: 0.3, air: 0.8,   // Home, laid on its side so it fills the tile
			box: [[-1, roofY + 2], [1, roofY + 2], [1, roofY], [0, roofY - 2 * H], [-1, roofY]],
			packed: [["square", -0.5, 0.366, 0], ["square", 0.5, 0.366, 0], ["square", -0.5, 1.366, 0], ["square", 0.5, 1.366, 0],
				["triangle", 0, -1.2887, 0], ["triangle", -0.5, -0.4226, 0], ["triangle", 0.5, -0.4226, 0], ["triangle", 0, -0.7113, 180]],
			loose: [[-2.75, -1.5, 14], [-1.3, -1.62, -9], [-2.75, 1.5, -12], [-1.3, 1.62, 11], [0.4, -1.7, 25], [1.8, -1.55, -20], [0.6, 1.7, 40], [2.9, 0.9, -35]] },
		{ size: 0.92, gap: 0.22, air: 0.8,   // Dozen
			box: ngon(12, 1 / (2 * Math.sin(Math.PI / 12)), 15),
			packed: [["square", 1.183, 0.683, 30], ["square", 0, 1.366, 0], ["square", -1.183, 0.683, 60], ["square", -1.183, -0.683, 30], ["square", 0, -1.366, 0], ["square", 1.183, -0.683, 60],
				["triangle", 0.5, 0.2887, 300], ["triangle", 0, 0.5774, 0], ["triangle", -0.5, 0.2887, 60], ["triangle", -0.5, -0.2887, 120], ["triangle", 0, -0.5774, 180], ["triangle", 0.5, -0.2887, 240],
				["triangle", 1.5774, 0, 270], ["triangle", 0.7887, 1.366, 330], ["triangle", -0.7887, 1.366, 30], ["triangle", -1.5774, 0, 90], ["triangle", -0.7887, -1.366, 150], ["triangle", 0.7887, -1.366, 210]],
			loose: [[4.1, -2.25, 12], [4.15, 0, -10], [4.1, 2.25, 8], [-4.1, -2.25, -14], [-4.15, 0, 10], [-4.1, 2.25, -8],
				[2.85, -2.45, 20], [2.8, -1.2, -25], [2.9, 0, 35], [2.8, 1.2, 15], [2.85, 2.45, -30], [4.15, -1.12, 40],
				[-2.85, -2.45, -20], [-2.8, -1.2, 25], [-2.9, 0, -35], [-2.8, 1.2, -15], [-2.85, 2.45, 30], [-4.15, 1.12, -40]] },
		{ size: 1.25, gap: 0.3, air: 0.8,   // Barge
			box: [[-1, -H], [1, -H], [2, H], [-2, H]],
			packed: [["triangle", 0.5, -0.5774, 180], ["triangle", 1, -0.2887, 0], ["triangle", -1.5, 0.5774, 0], ["triangle", 0.5, 0.5774, 0], ["triangle", 1, 0.2887, 180], ["triangle", 1.5, 0.5774, 0], ["hexagon", -0.5, 0, 0]],
			loose: [[2.85, -1.45, 25], [3.05, -0.1, -20], [-0.3, -1.65, 15], [1.2, -1.7, -30], [2.5, 1.62, 40], [0.5, 1.7, -15], [-2.6, -1.22, 15]] }
	];
	// and then the card it ends on: the name, with shapes crowding round it. Each is [kind, across, down, turn].
	var CROWD = [["hexagon", -3.55, -1.65, -10], ["square", -1.75, -1.95, 9], ["triangle", -0.5, -1.7, 18], ["square", 0.85, -2.05, -8], ["triangle", 2.15, -1.7, -22], ["hexagon", 3.6, -1.5, 12],
		["triangle", -3.85, 0.9, 15], ["square", -2.45, 1.8, -12], ["triangle", -1.0, 1.7, 200], ["square", 0.4, 1.95, 8], ["triangle", 1.75, 1.65, -15], ["square", 3.15, 1.75, 20]];
	// how long each part lasts, in seconds
	var DEAL = 0.45, WAIT = 0.45, HOLD = 1.9, GONE = 0.3, CARD = 3.6, BURST = 0.75;

	function el(tag, cls, attrs) {
		var e = document.createElementNS(NS, tag);
		if (cls) e.setAttribute("class", cls);
		for (var k in attrs) e.setAttribute(k, attrs[k]);
		return e;
	}
	// a closed outline through the points, with every corner rounded off
	function rounded(pts, r) {
		var n = pts.length, d = "";
		for (var i = 0; i < n; i++) {
			var v = pts[i], p = pts[(i + n - 1) % n], q = pts[(i + 1) % n];
			var lp = Math.hypot(p[0] - v[0], p[1] - v[1]), lq = Math.hypot(q[0] - v[0], q[1] - v[1]);
			d += (i ? "L" : "M") + (v[0] + (p[0] - v[0]) / lp * r).toFixed(4) + " " + (v[1] + (p[1] - v[1]) / lp * r).toFixed(4) +
				"Q" + v[0].toFixed(4) + " " + v[1].toFixed(4) + " " + (v[0] + (q[0] - v[0]) / lq * r).toFixed(4) + " " + (v[1] + (q[1] - v[1]) / lq * r).toFixed(4);
		}
		return d + "Z";
	}
	function scaled(pts, k) { return pts.map(function (p) { return [p[0] * k, p[1] * k]; }); }
	function ease(a) { return a < 0.5 ? 4 * a * a * a : 1 - Math.pow(-2 * a + 2, 3) / 2; }
	function clamp(a) { return a < 0 ? 0 : a > 1 ? 1 : a; }
	function hump(a) { return a > 0 && a < 1 ? Math.sin(Math.PI * a) : 0; }
	function pop(a) { a = clamp(a); var c = 1.70158; return a === 0 ? 0 : 1 + (c + 1) * Math.pow(a - 1, 3) + c * Math.pow(a - 1, 2); }   // out past its size and back
	function place(g, x, y, ang, s) { g.setAttribute("transform", "translate(" + x.toFixed(4) + " " + y.toFixed(4) + ") rotate(" + ang.toFixed(2) + ") scale(" + Math.max(s, 0.0001).toFixed(4) + ")"); }
	// one shape, with its face
	function piece(kind, n) {
		var g = el("g", "pk-piece"), face = el("g", "", FACE[kind] ? { transform: FACE[kind] } : {});
		g.style.setProperty("--c", HUES[n % HUES.length]);
		g.appendChild(el("path", "pk-fill", { d: rounded(scaled(SHAPES[kind], 1 - 0.034 / INSET[kind]), 0.1) }));
		face.innerHTML = '<g class="pk-eyes"><circle cx="-0.13" cy="-0.06" r="0.048"/><circle cx="0.13" cy="-0.06" r="0.048"/></g>' +
			'<path class="pk-line pk-shut" d="M-0.18 -0.06H-0.08M0.08 -0.06H0.18"/>' +
			'<path class="pk-line pk-idle" d="M-0.07 0.1Q0 0.15 0.07 0.1"/><path class="pk-line pk-good" d="M-0.12 0.07Q0 0.24 0.12 0.07"/>' + (OUTFITS[WEAR[n % WEAR.length]] || "");
		g.appendChild(face);
		return g;
	}

	var svg = el("svg", "", { viewBox: -W / 2 + " " + -HT / 2 + " " + W + " " + HT, role: "img", "aria-label": "Packman: shapes packing themselves into one box after another" });
	var at = 0;
	// a level: its box and its shapes, in a layer of its own, and when its parts happen
	var levels = LEVELS.map(function (lv, k) {
		if (lv.turn) {   // the whole level turned: its box, and each shape's place in it
			var c = Math.cos(lv.turn * Math.PI / 180), sn = Math.sin(lv.turn * Math.PI / 180), spin = function (x, y) { return [x * c - y * sn, x * sn + y * c]; };
			lv.box = lv.box.map(function (p) { return spin(p[0], p[1]); });
			lv.packed = lv.packed.map(function (p) { var q = spin(p[1], p[2]); return [p[0], q[0], q[1], p[3] + lv.turn]; });
		}
		var layer = el("g", "", { transform: "scale(" + lv.size + ")" }), bin = el("path", "pk-bin", { d: rounded(scaled(lv.box, 1.028), 0.13) }), over = el("g");
		layer.appendChild(bin); layer.appendChild(over);
		// they set off from the middle of the box outwards
		var order = lv.packed.map(function (p, i) { return i; }).sort(function (a, b) { return Math.hypot(lv.packed[a][1], lv.packed[a][2]) - Math.hypot(lv.packed[b][1], lv.packed[b][2]); });
		var parts = lv.packed.map(function (p, i) {
			var g = piece(p[0], i + k * 3), home = [p[1], p[2], p[3]], loose = lv.loose[i], same = TURNS[p[0]];
			home[2] = ((home[2] % same) + same + same / 2) % same - same / 2;   // of the ways round that look alike, the one that leaves its face most upright
			home[2] = loose[2] + ((home[2] - loose[2]) % 360 + 540) % 360 - 180;   // the short way round
			over.appendChild(g);
			return { g: g, home: home, loose: loose, turn: order.indexOf(i), up: false, mood: "" };
		});
		svg.appendChild(layer);
		var fly = DEAL + WAIT, win = fly + (parts.length - 1) * lv.gap + lv.air + 0.12, out = win + HOLD;
		var s = { layer: layer, over: over, bin: bin, parts: parts, lv: lv, from: at, fly: fly, win: win, out: out, to: at + out + GONE };
		at = s.to;
		return s;
	});

	// the card: the crowd, the mascot and the name, and the confetti thrown over them
	var card = el("g"), crowd = CROWD.map(function (c, n) {
		var g = piece(c[0], n + 1);
		g.setAttribute("class", "pk-piece pk-happy");
		card.appendChild(g);
		return { g: g, at: c, mood: "" };
	});
	var name = el("g"), mascot = el("svg", "", { viewBox: "0 0 40 40", width: 1.25, height: 1.25, y: -0.67 });
	mascot.innerHTML = '<polygon points="20,2 31,19 9,19" fill="#FFC93C" stroke="#2B2140" stroke-width="2.5" stroke-linejoin="round"/>' +
		'<rect x="6" y="17" width="28" height="21" rx="5" fill="#FF6B6B" stroke="#2B2140" stroke-width="2.5"/>' +
		'<circle cx="15" cy="26" r="2.2" fill="#2B2140"/><circle cx="25" cy="26" r="2.2" fill="#2B2140"/>' +
		'<path d="M15 31q5 4.5 10 0" fill="none" stroke="#2B2140" stroke-width="2.2" stroke-linecap="round"/>';
	var word = el("text", "pk-word", { y: 0.37 });
	"Packman".split("").forEach(function (ch, n) { var s = el("tspan", "", { fill: HUES[[0, 6, 1, 2, 3, 4, 5][n]] }); s.textContent = ch; word.appendChild(s); });
	name.appendChild(mascot); name.appendChild(word); card.appendChild(name);
	svg.appendChild(card);
	// the mascot and the name sit side by side, the pair of them in the middle: set once the name's width is known
	function centre() {
		var w = 0;
		try { w = word.getComputedTextLength(); } catch (e) {}
		if (!w) w = 4.5;
		var left = -(1.25 + 0.22 + w) / 2;
		mascot.setAttribute("x", left.toFixed(3)); word.setAttribute("x", (left + 1.47).toFixed(3));
	}
	var bits = [];
	for (var b = 0; b < 36; b++) {
		var seed = Math.sin(b * 12.9898) * 43758.5453, rnd = seed - Math.floor(seed), dir = (b / 36) * Math.PI * 2 + rnd;
		var bit = el("rect", "pk-bit", { x: -0.06, y: -0.035, width: 0.12, height: 0.07, rx: 0.015, fill: HUES[b % HUES.length], opacity: 0 });
		bits.push({ e: bit, vx: Math.cos(dir) * (2.4 + rnd * 2.8), vy: Math.sin(dir) * (2.2 + rnd * 2) - 2.6, spin: 300 + rnd * 500 });
		svg.appendChild(bit);
	}
	var CARD_AT = at, LOOP = at + CARD + GONE;

	var link = document.createElement("a");
	link.href = "packman/"; link.setAttribute("aria-label", "Play Packman");
	link.appendChild(svg); tile.appendChild(link);
	centre();
	if (document.fonts && document.fonts.ready) document.fonts.ready.then(centre);

	function level(s, t) {
		// the box and its shapes come in small and grow, and go the same way once packed
		var whole = t < s.out ? pop(t / 0.4) : 1 - ease(clamp((t - s.out) / GONE));
		s.layer.setAttribute("transform", "scale(" + Math.max(s.lv.size * whole, 0.0001).toFixed(4) + ")");
		s.parts.forEach(function (p, i) {
			var leave = s.fly + p.turn * s.lv.gap, land = leave + s.lv.air, a = clamp((t - leave) / s.lv.air), u = ease(a), lift = hump(a);
			var x = p.loose[0] + (p.home[0] - p.loose[0]) * u, y = p.loose[1] + (p.home[1] - p.loose[1]) * u, ang = p.loose[2] + (p.home[2] - p.loose[2]) * u;
			var size = pop((t - 0.1 - i * 0.02) / 0.35) * (1 + 0.14 * lift - 0.07 * hump((t - land) / 0.22));
			y -= 0.32 * lift;
			if (u === 0) y += 0.035 * Math.sin(t * 2.2 + i * 1.7);                 // loose pieces bob while they wait
			for (var h = 0; h < 2; h++) y -= 0.2 * hump((t - s.win - h * 0.5 - (p.home[0] + 2) * 0.09) / 0.4);   // packed: a wave of hops, left to right
			place(p.g, x, y, ang, size);
			if (lift > 0 && !p.up) { p.up = true; s.over.appendChild(p.g); }       // whichever is in the air is drawn on top
			var mood = (t >= land ? "pk-piece pk-happy" : "pk-piece") + ((t + i * 0.83) % (2.9 + i % 4 * 0.6) < 0.13 ? " pk-blink" : "");
			if (mood !== p.mood) { p.mood = mood; p.g.setAttribute("class", mood); }
		});
		s.bin.setAttribute("class", t >= s.win ? "pk-bin pk-win" : "pk-bin");
	}
	function ending(t) {
		var gone = 1 - ease(clamp((t - CARD) / GONE));
		crowd.forEach(function (c, n) {
			var a = (t - 0.15 - n * 0.055) / 0.5, s = pop(a) * gone, sway = Math.sin(t * 2.9 + n * 1.3);
			place(c.g, c.at[1], c.at[2] - 0.06 * sway, c.at[3] + 4 * sway - 70 * (1 - clamp(a)), s);
			var mood = "pk-piece pk-happy" + ((t + n * 0.83) % (2.9 + n % 4 * 0.6) < 0.13 ? " pk-blink" : "");
			if (mood !== c.mood) { c.mood = mood; c.g.setAttribute("class", mood); }
		});
		name.setAttribute("transform", "translate(0 " + (-0.05 * Math.sin(t * 2.4)).toFixed(4) + ") scale(" + Math.max(pop((t - 0.1) / 0.5) * gone, 0.0001).toFixed(4) + ")");
		var c = t - BURST;
		bits.forEach(function (bt) {
			if (c <= 0 || c > 1.9) { bt.e.setAttribute("opacity", 0); return; }
			bt.e.setAttribute("opacity", clamp((1.9 - c) / 0.5));
			bt.e.setAttribute("transform", "translate(" + (bt.vx * c).toFixed(3) + " " + (bt.vy * c + 3.4 * c * c).toFixed(3) + ") rotate(" + (bt.spin * c).toFixed(1) + ")");
		});
	}
	var prev = 0, shown = null;
	function frame(t) {
		if (t < prev) levels.forEach(function (s) { s.parts.forEach(function (p) { p.up = false; }); });   // a new lap
		prev = t;
		var now = card;
		for (var k = 0; k < levels.length; k++) if (t < levels[k].to) { now = levels[k]; break; }
		if (now !== shown) {   // only the part being played is drawn at all
			shown = now;
			levels.forEach(function (s) { s.layer.style.display = s === now ? "" : "none"; });
			card.style.display = now === card ? "" : "none";
			if (now !== card) bits.forEach(function (bt) { bt.e.setAttribute("opacity", 0); });
		}
		if (now === card) ending(t - CARD_AT); else level(now, t - now.from);
	}

	// Anyone who has asked for less motion gets the name and its crowd, standing still.
	if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) { frame(CARD_AT + 1.2); bits.forEach(function (bt) { bt.e.setAttribute("opacity", 0); }); return; }

	var clock = 0, last = 0, running = false, seen = false;
	function tick(now) {
		if (!running) return;
		clock = (clock + Math.min((now - last) / 1000, 0.1)) % LOOP; last = now;
		frame(clock);
		requestAnimationFrame(tick);
	}
	function set(on) {
		on = on && !document.hidden;
		if (on === running) return;
		running = on;
		if (on) { last = performance.now(); requestAnimationFrame(tick); }
	}
	clock = 0.45; frame(clock);   // before it has been seen: the first box, with its shapes out beside it
	// it only runs while it can be seen
	if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { seen = es[0].isIntersecting; set(seen); }, { threshold: 0.15 }).observe(tile);
	else { seen = true; set(true); }
	document.addEventListener("visibilitychange", function () { set(seen); });
	window.PackmanTile = { frame: frame, loop: LOOP };   // for looking at any moment of it (tools and tests)
})();
