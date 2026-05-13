/* Now-playing display. Hits a Cloudflare Worker that holds the Spotify
   refresh token and returns sanitized JSON: either {playing: true, ...} for
   currently-playing or {playing: false, playedAt: <ISO>, ...} for last-played.
   Worker source: cloudflare-worker/spotify-now-playing.js */

(function () {
	var WORKER_URL = "https://www.garvitgupta.com/api/spotify";
	var POLL_MS = 2000;

	var state = null;        // last response from worker
	var fetchedAt = 0;       // local timestamp of last fetch (for progress interpolation)

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
		} else {
			$(".spotify-device").addClass("ago");
			$(".spotify-progress").css({ "width": "0%" });
			$(".spotify-progress-thumb").removeClass("visible");
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
