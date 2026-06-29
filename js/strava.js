/* Running-goal widget. Fetches YTD running total (1000 km goal bar) + the most
   recent activity from a Cloudflare Worker. Runs/rides render as the decoded
   GPS route trace; workouts render as a heart-rate trace with HR-zone gridlines.
   Animates into view the first time the about section enters the viewport.
   Worker source: cloudflare-worker/strava-ytd.js */

(function () {
	var WORKER_URL = "https://www.garvitgupta.com/api/strava";
	var M_PER_MILE = 1609.344;
	var MAX_HR = 190; // basis for HR-zone gridlines (≈ 60/70/80/90% of max)
	var TRIGGER_SELECTOR = ".run-activity";

	var VERB = { Run: "Ran", TrailRun: "Ran", VirtualRun: "Ran",
		Ride: "Rode", VirtualRide: "Rode", GravelRide: "Rode", MountainBikeRide: "Rode",
		Walk: "Walked", Hike: "Hiked" };

	var pending = null;
	var revealed = false;

	function isMetric() {
		return window.GG && window.GG.units === "metric";
	}

	function fmtDist(meters) {
		var val = isMetric() ? meters / 1000 : meters / M_PER_MILE;
		var unit = isMetric() ? "km" : "mi";
		var str = val >= 10 ? Math.round(val).toString() : val.toFixed(1);
		return str + " " + unit;
	}

	// "today" / "yesterday" / "N days ago" / "Jun 3"
	function relWhen(dateStr) {
		if (!dateStr) return "";
		var p = dateStr.split("-");
		var d = new Date(+p[0], +p[1] - 1, +p[2]);
		var today = new Date(); today.setHours(0, 0, 0, 0);
		var diff = Math.round((today - d) / 86400000);
		if (diff <= 0) return "today";
		if (diff === 1) return "yesterday";
		return diff + " days ago";
	}

	function prettyType(t) {
		if (!t) return "Workout";
		return t.replace(/([a-z])([A-Z])/g, "$1 $2"); // WeightTraining -> Weight Training
	}

	// --- Google-encoded polyline -> [[lat,lng], …] ---
	function decodePolyline(str) {
		var idx = 0, lat = 0, lng = 0, coords = [];
		while (idx < str.length) {
			var b, shift = 0, res = 0;
			do { b = str.charCodeAt(idx++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
			lat += (res & 1) ? ~(res >> 1) : (res >> 1);
			shift = 0; res = 0;
			do { b = str.charCodeAt(idx++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
			lng += (res & 1) ? ~(res >> 1) : (res >> 1);
			coords.push([lat / 1e5, lng / 1e5]);
		}
		return coords;
	}

	// Catmull-Rom spline through the points -> smooth cubic-bezier path 'd'
	var TENSION = 0.16; // spline control-point distance (corner roundness)
	function smoothPath(p) {
		if (p.length < 3) {
			return "M" + p.map(function (q) { return q[0].toFixed(1) + "," + q[1].toFixed(1); }).join("L");
		}
		var d = "M" + p[0][0].toFixed(1) + "," + p[0][1].toFixed(1);
		for (var i = 0; i < p.length - 1; i++) {
			var p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
			var c1x = p1[0] + (p2[0] - p0[0]) * TENSION, c1y = p1[1] + (p2[1] - p0[1]) * TENSION;
			var c2x = p2[0] - (p3[0] - p1[0]) * TENSION, c2y = p2[1] - (p3[1] - p1[1]) * TENSION;
			d += "C" + c1x.toFixed(1) + "," + c1y.toFixed(1) + " " +
				c2x.toFixed(1) + "," + c2y.toFixed(1) + " " +
				p2[0].toFixed(1) + "," + p2[1].toFixed(1);
		}
		return d;
	}

	// Moving-average smoothing to remove GPS jitter (endpoints anchored).
	function movingAvg(p, r) {
		if (p.length < 2 * r + 1) return p;
		var out = [];
		for (var i = 0; i < p.length; i++) {
			var a = Math.max(0, i - r), b = Math.min(p.length - 1, i + r);
			var sx = 0, sy = 0, n = 0;
			for (var j = a; j <= b; j++) { sx += p[j][0]; sy += p[j][1]; n++; }
			out.push([sx / n, sy / n]);
		}
		out[0] = p[0]; out[p.length - 1] = p[p.length - 1];
		return out;
	}

	// Keep every `step`-th point (plus the last) to give the spline room to flow.
	function downsample(p, step) {
		if (step <= 1 || p.length < 3) return p;
		var out = [];
		for (var i = 0; i < p.length; i += step) out.push(p[i]);
		if (out[out.length - 1] !== p[p.length - 1]) out.push(p[p.length - 1]);
		return out;
	}

	// route coords -> smoothed path tight-fit to its real aspect ratio.
	// Longer dimension is scaled to TARGET user-units; returns the viewBox too.
	function buildRoute(coords) {
		var TARGET = 300, pad = 0;
		var lat0 = coords[0][0] * Math.PI / 180, kx = Math.cos(lat0); // lng -> equal-distance
		var xs = coords.map(function (c) { return c[1] * kx; });
		var ys = coords.map(function (c) { return c[0]; });
		var minX = Math.min.apply(0, xs), maxX = Math.max.apply(0, xs);
		var minY = Math.min.apply(0, ys), maxY = Math.max.apply(0, ys);
		var spanX = maxX - minX || 1e-9, spanY = maxY - minY || 1e-9;
		var scale = TARGET / Math.max(spanX, spanY);
		var pts = coords.map(function (c, i) {
			return [pad + (xs[i] - minX) * scale, pad + (maxY - ys[i]) * scale];
		});
		// de-jitter: average, then thin, then average again for a clean flow
		pts = movingAvg(downsample(movingAvg(pts, 2), 1), 2);
		return {
			d: smoothPath(pts),
			start: pts[0],
			end: pts[pts.length - 1],
			vbW: spanX * scale + 2 * pad,
			vbH: spanY * scale + 2 * pad
		};
	}

	// HR samples -> {line, area, last} sparkline path in a w×h box
	function hrSpark(v, w, h, pad) {
		var lo = Math.min.apply(0, v), hi = Math.max.apply(0, v), span = hi - lo || 1;
		var n = v.length, iw = w - 2 * pad, ih = h - 2 * pad;
		var pts = v.map(function (b, i) {
			return [pad + (i / (n - 1)) * iw, pad + (1 - (b - lo) / span) * ih];
		});
		var line = "M" + pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join("L");
		var area = line + "L" + pts[n - 1][0].toFixed(1) + "," + (h - pad).toFixed(1) +
			"L" + pad.toFixed(1) + "," + (h - pad).toFixed(1) + "Z";
		return { line: line, area: area, last: pts[n - 1] };
	}

	function hrChartHtml(hr) {
		var W = 220, H = 80, pad = 8;
		var sp = hrSpark(hr, W, H, pad);
		var zn = ["Z1", "Z2", "Z3", "Z4", "Z5"];
		var bounds = [0.6, 0.7, 0.8, 0.9].map(function (f) { return Math.round(f * MAX_HR); });
		var lo = Math.min.apply(0, hr), hi = Math.max.apply(0, hr), span = hi - lo || 1;
		var grid = bounds.map(function (b, i) {
			if (b <= lo || b >= hi) return "";
			var y = (pad + (1 - (b - lo) / span) * (H - 2 * pad)).toFixed(1);
			return '<line class="hr-grid" x1="' + pad + '" y1="' + y + '" x2="' + (W - pad) + '" y2="' + y + '"></line>' +
				'<text class="hr-zlabel" x="' + (W - pad + 3) + '" y="' + (parseFloat(y) + 2.5) + '">' + zn[i + 1] + "</text>";
		}).join("");
		return '<div class="hrchart"><svg viewBox="0 0 236 80">' + grid +
			'<path class="hr-area" d="' + sp.area + '"></path>' +
			'<path class="hr-line" d="' + sp.line + '"></path>' +
			'<circle class="hr-dot" cx="' + sp.last[0].toFixed(1) + '" cy="' + sp.last[1].toFixed(1) + '" r="3"></circle>' +
			"</svg></div>";
	}

	function renderActivity(data) {
		var $a = $(".run-activity");
		var act = data.latest;
		if (!act) { $a.empty(); return; }
		var when = relWhen(act.date), whenStr = when ? " · " + when : "";
		var html = "";

		if (act.kind === "route" && act.polyline) {
			var rp = buildRoute(decodePolyline(act.polyline));
			var verb = VERB[act.sportType] || "Did";
			html =
				'<div class="route"><svg viewBox="0 0 ' + rp.vbW.toFixed(1) + ' ' + rp.vbH.toFixed(1) + '" preserveAspectRatio="xMidYMid meet">' +
					'<path d="' + rp.d + '"></path>' +
					'<circle class="end" cx="' + rp.end[0].toFixed(1) + '" cy="' + rp.end[1].toFixed(1) + '" r="4.5"></circle>' +
					'<circle class="start" cx="' + rp.start[0].toFixed(1) + '" cy="' + rp.start[1].toFixed(1) + '" r="4.5"></circle></svg></div>' +
				'<div class="run-kicker">' + verb + " " + fmtDist(act.distanceMeters) + whenStr + "</div>" +
				(act.place ? '<div class="run-place">' + act.place + "</div>" : "");
		} else {
			var mins = Math.round((act.movingSeconds || 0) / 60);
			html =
				(act.hr && act.hr.length > 1 ? hrChartHtml(act.hr) : "") +
				'<div class="run-kicker w">' + mins + " min" + whenStr + "</div>" +
				'<div class="run-place">' + prettyType(act.sportType) + "</div>" +
				(act.place ? '<div class="run-sub">' + act.place + "</div>" : "");
		}
		$a.html(html);
	}

	function reveal(data) {
		if (data.profileUrl) $(".strava-link").attr("href", data.profileUrl);
		renderActivity(data);
	}

	// Expose for units toggle to re-render the distance line on unit change
	window.GG = window.GG || {};
	window.GG.refreshStrava = function () {
		if (pending && revealed) renderActivity(pending);
	};

	function tryReveal() {
		if (revealed || !pending) return;
		var el = document.querySelector(TRIGGER_SELECTOR);
		if (!el) return;
		var rect = el.getBoundingClientRect();
		if (rect.top < window.innerHeight && rect.bottom > 0) {
			revealed = true;
			reveal(pending);
		}
	}

	$(document).ready(function () {
		fetch(WORKER_URL, { cache: "no-store" })
			.then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
			.then(function (data) {
				pending = data;
				tryReveal();
			})
			.catch(function (err) { console.warn("Strava worker fetch failed", err); });

		$(window).on("scroll resize", tryReveal);
		tryReveal();
	});
})();
