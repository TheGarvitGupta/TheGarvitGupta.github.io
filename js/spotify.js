/* Now-playing display. Hits a Cloudflare Worker that holds the Spotify
   refresh token and returns sanitized currently-playing JSON.
   Worker source: cloudflare-worker/spotify-now-playing.js */

(function () {
	var WORKER_URL = "/api/spotify";
	var POLL_MS = 15000;

	var lastFetched = 0;
	var lastProgressMs = 0;
	var lastDurationMs = 1;
	var lastIsPlaying = false;

	function show(data) {
		lastFetched = Date.now();
		lastProgressMs = data.progressMs || 0;
		lastDurationMs = data.durationMs || 1;
		lastIsPlaying = !!data.playing;

		$(".spotify-music-track").html(data.track || "");
		$(".spotify-music-artist").html(data.artist || "");
		if (data.albumArt) {
			$(".spotify-album-art").css({ "background-image": "url(" + data.albumArt + ")" });
		}
		if (data.url) {
			$(".spotify-link").attr("href", data.url);
		}
		$(".spotify").css({ "display": "block" });
		setTimeout(function () { $(".spotify").css({ "opacity": "1" }); }, 200);
	}

	function hide() {
		lastIsPlaying = false;
		$(".spotify").css({ "opacity": "0" });
		setTimeout(function () { $(".spotify").css({ "display": "none" }); }, 200);
	}

	function tickProgress() {
		if (!lastIsPlaying || !lastDurationMs) return;
		var elapsed = Date.now() - lastFetched;
		var current = Math.min(lastProgressMs + elapsed, lastDurationMs);
		$(".spotify-progress").css({ "width": (current * 100 / lastDurationMs) + "%" });
	}

	function poll() {
		fetch(WORKER_URL, { cache: "no-store" })
			.then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
			.then(function (data) {
				if (!data || !data.playing) { hide(); return; }
				show(data);
			})
			.catch(function (err) { console.warn("Spotify worker fetch failed", err); });
	}

	$(document).ready(function () {
		poll();
		setInterval(poll, POLL_MS);
		setInterval(tickProgress, 500);
	});
})();
