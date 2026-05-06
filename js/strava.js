/* Running-bar widget. Hits a Cloudflare Worker that returns YTD + lifetime
   running totals from Strava. Fills the bar to YTD/goal, sets the runner
   icon, writes the under-bar stats, and links the whole thing to the
   Strava profile.
   Worker source: cloudflare-worker/strava-ytd.js */

(function () {
	var WORKER_URL = "https://www.garvitgupta.com/api/strava";
	var GOAL_MILES = 1000;

	function update(data) {
		var miles = data.ytdMiles || 0;
		var pct = Math.min((miles / GOAL_MILES) * 100, 100);
		$(".completed-run-bar").css({ width: pct + "%" });
		$(".run-icon").css({ left: pct + "%" });
		if (data.profileUrl) {
			$(".strava-link").attr("href", data.profileUrl);
		}
		var ytd = miles.toFixed(2);
		var lifetime = Math.round(data.lifetimeMiles || 0).toLocaleString("en-US");
		$(".run-stats").text(ytd + " miles this year · " + lifetime + " miles lifetime");
	}

	$(document).ready(function () {
		fetch(WORKER_URL, { cache: "no-store" })
			.then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
			.then(update)
			.catch(function (err) { console.warn("Strava worker fetch failed", err); });
	});
})();
