/* Running-bar widget. Fetches YTD + lifetime running totals from a Cloudflare
   Worker, then animates the bar fill + runner emoji + stats line into view
   the first time the about section enters the viewport.
   Worker source: cloudflare-worker/strava-ytd.js */

(function () {
	var WORKER_URL = "https://www.garvitgupta.com/api/strava";
	var M_PER_MILE = 1609.344;
	var KM_PER_MILE = 1.60934;
	// Goal: 1 000 000 m = 1000 km ≈ 621 mi
	var GOAL_MILES = 1000000 / M_PER_MILE;
	var TRIGGER_SELECTOR = ".run-bar";

	var pending = null;
	var revealed = false;

	function localDateString(d) {
		var y = d.getFullYear();
		var m = String(d.getMonth() + 1).padStart(2, "0");
		var day = String(d.getDate()).padStart(2, "0");
		return y + "-" + m + "-" + day;
	}

	function todayLocalDate() {
		return localDateString(new Date());
	}

	function yesterdayLocalDate() {
		var d = new Date();
		d.setDate(d.getDate() - 1);
		return localDateString(d);
	}

	function isMetric() {
		return window.GG && window.GG.units === "metric";
	}

	function fmtDist(miles, decimals, omitUnit) {
		var unit = isMetric() ? " km" : " miles";
		var val = isMetric() ? miles * KM_PER_MILE : miles;
		var str = decimals
			? val.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
			: Math.round(val).toLocaleString("en-US");
		return str + (omitUnit ? "" : unit);
	}

	function renderStats(data) {
		var miles = data.ytdMiles != null
			? data.ytdMiles
			: (data.ytdMeters || 0) / M_PER_MILE;
		var lifetimeMiles = data.lifetimeMiles != null
			? data.lifetimeMiles
			: (data.lifetimeMeters || 0) / M_PER_MILE;

		var $stats = $(".run-stats");
		var latestDate  = data.latestRunDate || "";
		var ranToday     = latestDate === todayLocalDate();
		var ranYesterday = latestDate === yesterdayLocalDate();

		if (ranToday || ranYesterday) {
			var recentDist = fmtDist(data.latestRunMiles || 0, true);
			var ytdDist    = fmtDist(miles, true, true);
			var when       = ranToday ? "today" : "yesterday";
			$stats.text("Ran " + recentDist + " " + when + ", " + ytdDist + " this year");
			$stats.attr("title", fmtDist(lifetimeMiles, false) + " lifetime");
		} else {
			$stats.text("Ran " + fmtDist(miles, true) + " this year, " + fmtDist(lifetimeMiles, false, true) + " lifetime");
			$stats.removeAttr("title");
		}
	}

	function reveal(data) {
		var miles = data.ytdMiles != null
			? data.ytdMiles
			: (data.ytdMeters || 0) / M_PER_MILE;
		var pct = Math.min((miles / GOAL_MILES) * 100, 100);
		$(".completed-run-bar").css({ width: pct + "%" });
		$(".run-icon").css({ left: pct + "%" });
		if (data.profileUrl) {
			$(".strava-link").attr("href", data.profileUrl);
		}
		renderStats(data);
	}

	// Expose for units toggle to call on unit change
	window.GG = window.GG || {};
	window.GG.refreshStrava = function () {
		if (pending && revealed) renderStats(pending);
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
