/* Running-bar widget. Hits a Cloudflare Worker that returns YTD + lifetime
   running totals from Strava. Fills the bar to YTD/goal, sets the runner
   icon, writes the under-bar stats, and links the whole thing to the
   Strava profile.
   Worker source: cloudflare-worker/strava-ytd.js */

(function () {
	var WORKER_URL = "https://www.garvitgupta.com/api/strava";
	// Goal of 1000 km, displayed in miles. 1000 km = 621.371 miles.
	var M_PER_MILE = 1609.344;
	var GOAL_MILES = 1000000 / M_PER_MILE;

	function update(data) {
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

	$(document).ready(function () {
		fetch(WORKER_URL, { cache: "no-store" })
			.then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
			.then(update)
			.catch(function (err) { console.warn("Strava worker fetch failed", err); });
	});
})();
