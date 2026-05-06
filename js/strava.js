/* Running-bar widget. Fetches YTD + lifetime running totals from a Cloudflare
   Worker, then animates the bar fill + runner emoji + stats line into view
   the first time the about section enters the viewport.
   Worker source: cloudflare-worker/strava-ytd.js */

(function () {
	var WORKER_URL = "https://www.garvitgupta.com/api/strava";
	var M_PER_MILE = 1609.344;
	// Goal of 1000 km, displayed in miles. 1000 km = 621.371 miles.
	var GOAL_MILES = 1000000 / M_PER_MILE;
	var TRIGGER_SELECTOR = ".run-bar";

	var pending = null;
	var revealed = false;

	function reveal(data) {
		var miles = data.ytdMiles != null
			? data.ytdMiles
			: (data.ytdMeters || 0) / M_PER_MILE;
		var lifetimeMiles = data.lifetimeMiles != null
			? data.lifetimeMiles
			: (data.lifetimeMeters || 0) / M_PER_MILE;
		var pct = Math.min((miles / GOAL_MILES) * 100, 100);
		$(".completed-run-bar").css({ width: pct + "%" });
		$(".run-icon").css({ left: pct + "%" });
		if (data.profileUrl) {
			$(".strava-link").attr("href", data.profileUrl);
		}
		var ytd = Math.round(miles).toLocaleString("en-US");
		var lifetime = Math.round(lifetimeMiles).toLocaleString("en-US");
		$(".run-stats").text("Ran " + ytd + " miles this year, " + lifetime + " lifetime");
	}

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
