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
		var str = val >= 10 ? Math.round(val).toLocaleString("en-US") : val.toFixed(1);
		return str + " " + unit;
	}

	// "today" / "yesterday" / "N days ago" / "Jun 3"
	function relWhen(dateStr) {
		if (!dateStr) return "";
		var p = dateStr.split("-");
		var d = new Date(+p[0], +p[1] - 1, +p[2]);
		var today = new Date(); today.setHours(0, 0, 0, 0);
		var diff = Math.round((today - d) / 86400000);
		if (diff <= 0) return "Today";
		if (diff === 1) return "Yesterday";
		return diff + " days ago";
	}

	function prettyType(t) {
		if (!t) return "Workout";
		return t.replace(/([a-z])([A-Z])/g, "$1 $2"); // WeightTraining -> Weight Training
	}

	// Strava's own activity glyphs, inlined so they pick up the line colour
	// (currentColor) and need no extra request.
	var ICON_PATH = {
		run: "M8.688 0C8.025 0 7.38.215 6.85.613l-3.32 2.49-2.845.948A1 1 0 000 5c0 1.579.197 2.772.567 3.734.376.978.907 1.654 1.476 2.223.305.305.6.567.886.82.785.697 1.5 1.33 2.159 2.634 1.032 2.57 2.37 4.748 4.446 6.27C11.629 22.218 14.356 23 18 23c2.128 0 3.587-.553 4.549-1.411a4.378 4.378 0 001.408-2.628c.152-.987-.389-1.787-.967-2.25l-3.892-3.114a1 1 0 01-.329-.477l-3.094-9.726A2 2 0 0013.769 2h-1.436a2 2 0 00-1.2.4l-.57.428-.516-1.803A1.413 1.413 0 008.688 0zM8.05 2.213c.069-.051.143-.094.221-.127l1.168 4.086L12.333 4h1.436l.954 3H12v2h3.36l.318 1H13v2h3.314l.55 1.726a3 3 0 00.984 1.433l3.106 2.485c-.77.19-1.778.356-2.954.356-1.97 0-3.178-.431-4.046-1.087-.895-.677-1.546-1.675-2.251-3.056-.224-.437-.45-.907-.688-1.403C9.875 10.08 8.444 7.1 5.531 4.102zM3.743 5.14c2.902 2.858 4.254 5.664 5.441 8.126.25.517.49 1.018.738 1.502.732 1.432 1.55 2.777 2.827 3.74C14.053 19.495 15.72 20 18 20c1.492 0 2.754-.23 3.684-.479a2.285 2.285 0 01-.467.575c-.5.446-1.435.904-3.217.904-3.356 0-5.629-.718-7.284-1.931-1.663-1.22-2.823-3.028-3.788-5.44a1.012 1.012 0 00-.034-.076c-.853-1.708-1.947-2.673-2.79-3.417a14.61 14.61 0 01-.647-.593c-.431-.431-.775-.88-1.024-1.527-.21-.545-.367-1.271-.417-2.3z",
		ride: "M4 4v2h1.705l1.428 2.498-.836 1.672A5 5 0 109.9 16H11a1 1 0 00.868-.504l3.607-6.313.639 1.733a5 5 0 101.835-.806L16.434 6H19.5a.5.5 0 010 1H19v2h.5a2.5 2.5 0 000-5H15a1 1 0 00-.938 1.346L14.672 7H8.58L8.01 6H9V4zm4.325 6.585L10.277 14H6.618zM11.5 12.11L9.723 9h3.554zM5 12c.125 0 .25.008.37.023l-1.264 2.53A1 1 0 005 16h2.83A3.001 3.001 0 115 12zm11.848.91l1.06 2.874 1.876-.691-1.132-3.073a3 3 0 11-1.804.89z",
		weight: "M21.4 13.913a2 2 0 01-2.83 0l-2.297-2.298-4.657 4.657 2.298 2.298a2 2 0 010 2.829L12.5 22.813a2 2 0 01-2.829 0l-.707-.707-1.207 1.207a2 2 0 01-2.828 0L.686 19.07a2 2 0 010-2.828l1.207-1.207-.707-.707a2 2 0 010-2.829L2.6 10.085a2 2 0 012.829 0l2.298 2.298 4.657-4.657-2.298-2.298a2 2 0 010-2.828L11.5 1.185a2 2 0 012.828 0l.708.707L16.243.685a2 2 0 012.828 0l4.243 4.243a2 2 0 010 2.828l-1.208 1.208.707.707a2 2 0 010 2.828zM12.913 2.6L11.5 4.014l8.485 8.485 1.414-1.414-2.121-2.121 2.621-2.622L17.657 2.1 16.45 3.307l2.828 2.828-1.414 1.414zm.884 6.54L9.14 13.797l1.06 1.06 4.658-4.656zM12.5 19.984L4.015 11.5 2.6 12.913l4.95 4.95-1.414 1.414-2.828-2.828L2.1 17.656l4.243 4.243 2.621-2.622 2.122 2.122z"
	};

	// sportType -> icon markup ("" when we have no glyph for it)
	function actIcon(sportType) {
		var t = sportType || "";
		var key = /^(Run|TrailRun|VirtualRun)$/.test(t) ? "run"
			: /^(Ride|VirtualRide|GravelRide|MountainBikeRide|EBikeRide)$/.test(t) ? "ride"
			: /^(WeightTraining|Workout|Crossfit)$/.test(t) ? "weight" : "";
		if (!key) return "";
		return '<svg class="act-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
			'<path d="' + ICON_PATH[key] + '"></path></svg>';
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
		var lpad = 1; // half the line stroke, so its rounded left cap sits flush at x=0
		var n = v.length, iw = w - pad - lpad, ih = h - 2 * pad; // pad only on the right (label gutter)
		var pts = v.map(function (b, i) {
			return [lpad + (i / (n - 1)) * iw, pad + (1 - (b - lo) / span) * ih];
		});
		var line = "M" + pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join("L");
		var area = line + "L" + pts[n - 1][0].toFixed(1) + "," + (h - pad).toFixed(1) +
			"L" + pad.toFixed(1) + "," + (h - pad).toFixed(1) + "Z";
		return { line: line, area: area, last: pts[n - 1] };
	}

	function hrChartHtml(hr) {
		var W = 260, H = 80, pad = 8;
		var sp = hrSpark(hr, W, H, pad);
		var zn = ["Z1", "Z2", "Z3", "Z4", "Z5"];
		var bounds = [0.6, 0.7, 0.8, 0.9].map(function (f) { return Math.round(f * MAX_HR); });
		var lo = Math.min.apply(0, hr), hi = Math.max.apply(0, hr), span = hi - lo || 1;
		var grid = bounds.map(function (b, i) {
			if (b <= lo || b >= hi) return "";
			var y = (pad + (1 - (b - lo) / span) * (H - 2 * pad)).toFixed(1);
			return '<line class="hr-grid" x1="0" y1="' + y + '" x2="' + (W - pad) + '" y2="' + y + '"></line>' +
				'<text class="hr-zlabel" x="' + (W - pad + 9) + '" y="' + (parseFloat(y) + 2.5) + '">' + zn[i + 1] + "</text>";
		}).join("");
		return '<div class="hrchart"><svg viewBox="0 0 290 80">' +
			'<defs><linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">' +
				'<stop offset="0" stop-color="#E23B3B" stop-opacity="0.22"></stop>' +
				'<stop offset="1" stop-color="#E23B3B" stop-opacity="0"></stop>' +
			"</linearGradient></defs>" + grid +
			'<path class="hr-area" d="' + sp.area + '"></path>' +
			'<path class="hr-line" d="' + sp.line + '"></path>' +
			"</svg></div>";
	}

	function renderActivity(data) {
		var $a = $(".run-activity");
		var act = data.latest;
		if (!act) { $a.empty(); return; }
		var when = relWhen(act.date), whenStr = when ? " " + when : "";
		var html = "";
		// Totals (this year + lifetime) — runs use run totals, rides use ride totals
		var isRun = /^(Run|TrailRun|VirtualRun)$/.test(act.sportType || "");
		var isRide = /^(Ride|VirtualRide|GravelRide|MountainBikeRide)$/.test(act.sportType || "");
		var totals = "";
		if (isRun) {
			totals = '<div class="run-totals">' + fmtDist(data.ytdMeters || 0) + " this year · " +
				fmtDist(data.lifetimeMeters || 0) + " lifetime</div>";
		} else if (isRide && data.rideLifetimeMeters) {
			totals = '<div class="run-totals">' + fmtDist(data.rideYtdMeters || 0) + " this year · " +
				fmtDist(data.rideLifetimeMeters || 0) + " lifetime</div>";
		}

		if (act.kind === "route" && act.polyline) {
			var rp = buildRoute(decodePolyline(act.polyline));
			var verb = VERB[act.sportType] || "Did";
			// Size the element box to the route's real aspect ratio (capped to
			// 290x220) so the box matches the content -- no letterbox gutters.
			var fit = Math.min(290 / rp.vbW, 220 / rp.vbH);
			var dispW = (rp.vbW * fit).toFixed(1), dispH = (rp.vbH * fit).toFixed(1);
			html =
				'<div class="route"><svg width="' + dispW + '" height="' + dispH + '" viewBox="0 0 ' + rp.vbW.toFixed(1) + ' ' + rp.vbH.toFixed(1) + '" preserveAspectRatio="xMidYMid meet">' +
					'<path d="' + rp.d + '"></path>' +
					'<circle class="end" cx="' + rp.end[0].toFixed(1) + '" cy="' + rp.end[1].toFixed(1) + '" r="4.5"></circle>' +
					'<circle class="start" cx="' + rp.start[0].toFixed(1) + '" cy="' + rp.start[1].toFixed(1) + '" r="4.5"></circle></svg></div>' +
				'<div class="run-kicker">' + actIcon(act.sportType) + verb + " " + fmtDist(act.distanceMeters) + whenStr +
					(act.place ? " · " + act.place : "") + "</div>" + totals;
		} else {
			// Mirror the run/ride layout: HR trace, then a coloured top line and a
			// dark second line. Top (red): pulsing heart + average BPM. Bottom (dark):
			// workout type + duration + place. (Strava has no weight-training totals.)
			var mins = Math.round((act.movingSeconds || 0) / 60);
			var chart = act.hr && act.hr.length > 1 ? hrChartHtml(act.hr) : "";
			var titleLine = actIcon(act.sportType) + prettyType(act.sportType) + " " + mins + " min" + whenStr +
				(act.place ? " · " + act.place : "");
			// one lub-dub per animation cycle, timed to the actual BPM (60 / bpm seconds)
			var beat = (60 / act.avgHr).toFixed(3);
			var heart = '<svg class="hr-heart" viewBox="2 3 20 18.4"><path style="animation-duration:' + beat + 's" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>';
			html = act.avgHr
				? chart +
					'<div class="run-kicker w">' + heart + " avg " + act.avgHr + " bpm</div>" +
					'<div class="run-totals">' + titleLine + "</div>"
				: chart + '<div class="run-kicker w">' + titleLine + "</div>";
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
