/* The Packman tile in the work section: the Rosette bonus level packing itself, over and over.
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
	// type, colour, where it is packed (x, y, angle), where it waits (x, y, angle), outfit.
	// Listed in the order they go in: the hexagon first, then round the ring.
	var PIECES = [
		["hexagon", "#4DA8FF", 0, 0, 0, -3.2, 0.05, 15, "specs"],
		["square", "#FF6B6B", 0, -1.366, 0, 2.75, -0.7, 14],
		["triangle", "#FFC93C", 0.7887, -1.366, -30, 2.7, -2.05, 25],
		["square", "#3DDBB4", 1.183, -0.683, -30, 3.85, -2.0, -12, "bow"],
		["triangle", "#FF8FCB", 1.5774, 0, 30, 2.7, 0.7, -20],
		["square", "#9B7BFF", 1.183, 0.683, 30, 3.85, 0.62, 8, "blush"],
		["triangle", "#FF9F45", 0.7887, 1.366, -30, 3.85, 2.05, 40],
		["square", "#FFC93C", 0, 1.366, 0, 2.75, 2.0, -9],
		["triangle", "#3DDBB4", -0.7887, 1.366, 30, -2.4, 1.95, -25],
		["square", "#FF8FCB", -1.183, 0.683, -30, -3.6, 2.0, 11, "specs"],
		["triangle", "#9B7BFF", -1.5774, 0, -30, 3.85, -0.65, 15],
		["square", "#FF9F45", -1.183, -0.683, 30, -3.6, -1.95, -14],
		["triangle", "#FF6B6B", -0.7887, -1.366, 30, -2.4, -1.85, 35, "blush"]
	];
	// the loop, in seconds
	var START = 0.9, GAP = 0.3, FLY = 0.8, WIN = START + (PIECES.length - 1) * GAP + FLY + 0.15, OUT = WIN + 2.1, BACK = 0.75, LOOP = OUT + BACK + 0.9;

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

	var svg = el("svg", "", { viewBox: -W / 2 + " " + -HT / 2 + " " + W + " " + HT, role: "img", "aria-label": "Packman: shapes packing themselves into a box" });
	var ring = [];
	for (var k = 0; k < 12; k++) { var r = (15 + k * 30) * Math.PI / 180; ring.push([1.9318517 * Math.cos(r), 1.9318517 * Math.sin(r)]); }
	var bin = el("path", "pk-bin", { d: rounded(scaled(ring, 1.028), 0.13) });
	svg.appendChild(bin);

	var layer = el("g"), parts = PIECES.map(function (p, i) {
		var g = el("g", "pk-piece"), face = el("g", "", FACE[p[0]] ? { transform: FACE[p[0]] } : {});
		g.style.setProperty("--c", p[1]);
		g.appendChild(el("path", "pk-fill", { d: rounded(scaled(SHAPES[p[0]], 1 - 0.034 / INSET[p[0]]), 0.1) }));
		face.innerHTML = '<g class="pk-eyes"><circle cx="-0.13" cy="-0.06" r="0.048"/><circle cx="0.13" cy="-0.06" r="0.048"/></g>' +
			'<path class="pk-line pk-shut" d="M-0.18 -0.06H-0.08M0.08 -0.06H0.18"/>' +
			'<path class="pk-line pk-idle" d="M-0.07 0.1Q0 0.15 0.07 0.1"/><path class="pk-line pk-good" d="M-0.12 0.07Q0 0.24 0.12 0.07"/>' + (OUTFITS[p[8]] || "");
		g.appendChild(face); layer.appendChild(g);
		return { g: g, home: [p[2], p[3], p[4]], loose: [p[5], p[6], p[7]], up: false, mood: "" };
	});
	svg.appendChild(layer);

	// confetti: thrown from the middle of the box when the last piece lands
	var bits = [];
	for (var b = 0; b < 30; b++) {
		var seed = Math.sin(b * 12.9898) * 43758.5453, rnd = seed - Math.floor(seed), dir = (b / 30) * Math.PI * 2 + rnd;
		var bit = el("rect", "pk-bit", { x: -0.06, y: -0.035, width: 0.12, height: 0.07, rx: 0.015, fill: PIECES[b % 7 + 1][1] });
		bits.push({ e: bit, vx: Math.cos(dir) * (2.2 + rnd * 2.4), vy: Math.sin(dir) * (2.2 + rnd * 2) - 2.6, spin: 300 + rnd * 500 });
		svg.appendChild(bit);
	}
	var link = document.createElement("a");
	link.href = "packman/"; link.setAttribute("aria-label", "Play Packman");
	link.appendChild(svg); tile.appendChild(link);

	var prev = 0;
	function frame(t) {
		if (t < prev) parts.forEach(function (p) { p.up = false; });   // a new lap
		prev = t;
		parts.forEach(function (p, i) {
			var leave = START + i * GAP, land = leave + FLY, a, u, lift;
			if (t < OUT) { a = clamp((t - leave) / FLY); u = ease(a); lift = hump(a); }
			else { a = clamp((t - OUT - i * 0.03) / BACK); u = 1 - ease(a); lift = hump(a); }
			var x = p.loose[0] + (p.home[0] - p.loose[0]) * u, y = p.loose[1] + (p.home[1] - p.loose[1]) * u, ang = p.loose[2] + (p.home[2] - p.loose[2]) * u;
			var s = 1 + 0.14 * lift - 0.07 * hump((t - land) / 0.22);
			y -= 0.32 * lift;
			if (u === 0) y += 0.035 * Math.sin(t * 2.2 + i * 1.7);                 // loose pieces bob while they wait
			for (var h = 0; h < 2; h++) y -= 0.2 * hump((t - WIN - h * 0.55 - (p.home[0] + 2) * 0.09) / 0.4);   // packed: a wave of hops, left to right
			p.g.setAttribute("transform", "translate(" + x.toFixed(4) + " " + y.toFixed(4) + ") rotate(" + ang.toFixed(2) + ") scale(" + s.toFixed(4) + ")");
			if (lift > 0 && !p.up) { p.up = true; layer.appendChild(p.g); }       // whichever is in the air is drawn on top
			var mood = (t >= land && t < OUT ? "pk-piece pk-happy" : "pk-piece") + ((t + i * 0.83) % (2.9 + i % 4 * 0.6) < 0.13 ? " pk-blink" : "");
			if (mood !== p.mood) { p.mood = mood; p.g.setAttribute("class", mood); }
		});
		bin.setAttribute("class", t >= WIN && t < OUT ? "pk-bin pk-win" : "pk-bin");
		var c = t - WIN;
		bits.forEach(function (bt) {
			if (c <= 0 || c > 1.9) { bt.e.setAttribute("opacity", 0); return; }
			bt.e.setAttribute("opacity", clamp((1.9 - c) / 0.5));
			bt.e.setAttribute("transform", "translate(" + (bt.vx * c).toFixed(3) + " " + (bt.vy * c + 3.4 * c * c).toFixed(3) + ") rotate(" + (bt.spin * c).toFixed(1) + ")");
		});
	}

	// Anyone who has asked for less motion gets the finished packing, standing still.
	if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) { frame(OUT - 0.05); return; }

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
	frame(0);
	// it only runs while it can be seen
	if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { seen = es[0].isIntersecting; set(seen); }, { threshold: 0.15 }).observe(tile);
	else { seen = true; set(true); }
	document.addEventListener("visibilitychange", function () { set(seen); });
})();
