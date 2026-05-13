/* Now-playing display. Hits a Cloudflare Worker that holds the Spotify
   refresh token and returns sanitized JSON: either {playing: true, ...} for
   currently-playing or {playing: false, playedAt: <ISO>, ...} for last-played.
   Worker source: cloudflare-worker/spotify-now-playing.js */

(function () {
	var WORKER_URL = "https://www.garvitgupta.com/api/spotify";
	var POLL_MS = 2000;

	var state = null;
	var fetchedAt = 0;

	// --- Visualizer config ---
	var VIZ_MIN_HEIGHT        = 4;
	var VIZ_MAX_HEIGHT        = 14;
	var VIZ_PILL_BIAS         = [0.05, 0.6, 1.0, 0.85, 0.35]; // bell curve weights
	var VIZ_PILL_SPIKE_CHANCE = [0.01, 0.10, 0.28, 0.22, 0.06]; // per-tick chance of hitting full height
	var VIZ_PILL_MIN_CHANCE   = [0.35, 0.05, 0.02, 0.03, 0.08]; // per-tick chance of snapping near min height
	var VIZ_NEIGHBOR_INFLUENCE = 0.15; // how much adjacent pills pull each other
	var VIZ_JITTER_PERIOD     = 100;   // ms between height resamples
	var VIZ_ENTROPY_MIN_PERIOD = 3000; // ms min between entropy target changes
	var VIZ_ENTROPY_MAX_PERIOD = 7000; // ms max between entropy target changes
	var VIZ_ENTROPY_RISE_SPEED  = 0.8; // fraction moved per jitter tick when rising
	var VIZ_ENTROPY_DECAY_SPEED = 0.15;// fraction moved per jitter tick when decaying

	// --- Visualizer state ---
	var vizEntropy       = 5;
	var vizTargetEntropy = 5;
	var vizPillHeights   = [9, 11, 14, 11, 9];
	var vizRunning       = false;
	var vizJitterTimer   = null;
	var vizEntropyTimer  = null;

	function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
	function randBetween(lo, hi) { return lo + Math.random() * (hi - lo); }

	function scheduleEntropyChange() {
		var delay = randBetween(VIZ_ENTROPY_MIN_PERIOD, VIZ_ENTROPY_MAX_PERIOD);
		vizEntropyTimer = setTimeout(function () {
			var drift = randBetween(-2, 5);
			vizTargetEntropy = clamp(vizEntropy + drift, 1, 10);
			scheduleEntropyChange();
		}, delay);
	}

	function tickEntropy() {
		var speed = vizTargetEntropy > vizEntropy ? VIZ_ENTROPY_RISE_SPEED : VIZ_ENTROPY_DECAY_SPEED;
		vizEntropy += (vizTargetEntropy - vizEntropy) * speed;
	}

	function samplePillHeights() {
		var normalizedEntropy = (vizEntropy - 1) / 9;
		var raw = [];
		for (var i = 0; i < 5; i++) {
			if (Math.random() < VIZ_PILL_SPIKE_CHANCE[i] * normalizedEntropy) {
				raw.push(VIZ_MAX_HEIGHT);
				continue;
			}
			if (Math.random() < VIZ_PILL_MIN_CHANCE[i]) {
				raw.push(VIZ_MIN_HEIGHT + randBetween(0, 2));
				continue;
			}
			var mean  = VIZ_MIN_HEIGHT + VIZ_PILL_BIAS[i] * normalizedEntropy * (VIZ_MAX_HEIGHT - VIZ_MIN_HEIGHT);
			var range = (VIZ_MAX_HEIGHT - VIZ_MIN_HEIGHT) * (0.55 + Math.random() * 0.35);
			raw.push(clamp(mean + randBetween(-range, range), VIZ_MIN_HEIGHT, VIZ_MAX_HEIGHT));
		}

		// Blend each pill toward its neighbors' previous values
		var blended = [];
		for (var i = 0; i < 5; i++) {
			var neighborSum = 0, neighborCount = 0;
			if (i > 0) { neighborSum += vizPillHeights[i - 1]; neighborCount++; }
			if (i < 4) { neighborSum += vizPillHeights[i + 1]; neighborCount++; }
			var neighborAvg = neighborCount > 0 ? neighborSum / neighborCount : raw[i];
			blended.push(clamp(
				(1 - VIZ_NEIGHBOR_INFLUENCE) * raw[i] + VIZ_NEIGHBOR_INFLUENCE * neighborAvg,
				VIZ_MIN_HEIGHT, VIZ_MAX_HEIGHT
			));
		}
		vizPillHeights = blended;
	}

	function applyPillHeights() {
		var pills = document.querySelectorAll('.spotify-pill');
		for (var i = 0; i < pills.length; i++) {
			var h   = Math.round(vizPillHeights[i]);
			var top = Math.round(1 + (VIZ_MAX_HEIGHT - h) / 2);
			pills[i].style.height = h + 'px';
			pills[i].style.top    = top + 'px';
		}
	}

	function startVisualizer() {
		if (vizRunning) return;
		vizRunning = true;
		scheduleEntropyChange();
		vizJitterTimer = setInterval(function () {
			if (state && state.playing && state.durationMs) {
				var elapsed = Date.now() - fetchedAt;
				var progress = ((state.progressMs || 0) + elapsed) / state.durationMs;
				if (progress >= 0.95) vizTargetEntropy = 1;
			}
			tickEntropy();
			samplePillHeights();
			applyPillHeights();
			var dbg = document.getElementById('viz-debug');
			if (dbg) dbg.innerHTML =
				'entropy:       ' + vizEntropy.toFixed(2) + '<br>' +
				'targetEntropy: ' + vizTargetEntropy.toFixed(2) + '<br>' +
				'pills:         ' + vizPillHeights.map(function(h){ return Math.round(h); }).join(', ');
		}, VIZ_JITTER_PERIOD);
	}

	function stopVisualizer() {
		vizRunning = false;
		clearInterval(vizJitterTimer);
		clearTimeout(vizEntropyTimer);
	}

	// --- Spotify display ---
	function relativeTime(iso) {
		var diff = Date.now() - new Date(iso).getTime();
		var s = Math.max(0, Math.round(diff / 1000));
		if (s < 5) return "Just now";
		if (s < 60) return s + " second" + (s === 1 ? "" : "s") + " ago";
		var m = Math.floor(s / 60);
		if (m < 60) return m + " minute" + (m === 1 ? "" : "s") + " ago";
		var h = Math.floor(m / 60);
		if (h < 24) return h + " hour" + (h === 1 ? "" : "s") + " ago";
		var d = Math.floor(h / 24);
		return d + " day" + (d === 1 ? "" : "s") + " ago";
	}

	function applyState() {
		if (!state || (!state.playing && !state.playedAt)) {
			$(".spotify").css({ "opacity": "0" });
			setTimeout(function () { $(".spotify").css({ "display": "none" }); }, 200);
			stopVisualizer();
			return;
		}
		$(".spotify-music-track").html(state.track || "");
		$(".spotify-music-artist").html(state.artist || "");
		if (state.albumArt) {
			$(".spotify-album-art").css({ "background-image": "url(" + state.albumArt + ")" });
			document.querySelector(".spotify-progress-thumb").style.setProperty("--thumb-art", "url(" + state.albumArt + ")");
		}
		if (state.url) {
			$(".spotify-link").attr("href", state.url);
		}

		if (state.playing) {
			$(".spotify-device")
				.removeClass("ago")
				.text(state.deviceName ? "Listening on " + state.deviceName : "");
			$(".spotify-progress-thumb").addClass("visible");
			startVisualizer();
		} else {
			$(".spotify-device").addClass("ago");
			$(".spotify-progress").css({ "width": "0%" });
			$(".spotify-progress-thumb").removeClass("visible");
			stopVisualizer();
		}

		$(".spotify").css({ "display": "block" });
		setTimeout(function () { $(".spotify").css({ "opacity": "1" }); }, 200);
		tick();
	}

	function tick() {
		if (!state) return;
		if (state.playing && state.durationMs) {
			var elapsed = Date.now() - fetchedAt;
			var current = Math.min((state.progressMs || 0) + elapsed, state.durationMs);
			$(".spotify-progress").css({ "width": (current * 100 / state.durationMs) + "%" });
		} else if (state.playedAt) {
			$(".spotify-device").text("Listening " + relativeTime(state.playedAt));
		}
	}

	function poll() {
		fetch(WORKER_URL, { cache: "no-store" })
			.then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
			.then(function (data) {
				state = data;
				fetchedAt = Date.now();
				applyState();
			})
			.catch(function (err) { console.warn("Spotify worker fetch failed", err); });
	}

	$(document).ready(function () {
		poll();
		setInterval(poll, POLL_MS);
		setInterval(tick, 1000);
	});
})();
