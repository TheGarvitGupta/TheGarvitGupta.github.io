/* Metric / imperial toggle. Set by the country the page is opened in, until the visitor chooses.
   Exposes window.GG.units ("metric" | "imperial") for other widgets. */

(function () {
	var STORAGE_KEY = "gg:units";

	window.GG = window.GG || {};

	// The country the page is opened in, read from the device's time zone: that follows the
	// device from place to place, where its language does not. Imperial in the United States
	// and its Pacific territories, Liberia and Myanmar; metric everywhere else.
	var IMPERIAL_ZONES = /^(US\/|America\/(Adak|Anchorage|Atka|Boise|Chicago|Denver|Detroit|Fort_Wayne|Indiana\/|Indianapolis|Juneau|Kentucky\/|Knox_IN|Los_Angeles|Louisville|Menominee|Metlakatla|New_York|Nome|North_Dakota\/|Phoenix|Shiprock|Sitka|Yakutat)|Pacific\/(Honolulu|Johnston|Guam|Saipan|Pago_Pago|Samoa)$|Africa\/Monrovia$|Asia\/(Yangon|Rangoon)$)/;

	function detectUnits() {
		try {
			var zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
			// a zone that names a place settles it; "UTC" and the like say nothing of where
			if (zone && zone.indexOf("/") !== -1 && zone.indexOf("Etc/") !== 0) return IMPERIAL_ZONES.test(zone) ? "imperial" : "metric";
		} catch (e) {}
		// no time zone to go by: the region of the browser's language, as before
		var locale = navigator.language || navigator.userLanguage || "";
		var country = (locale.split("-")[1] || "").toUpperCase();
		if (!country) return locale.toLowerCase() === "en" ? "imperial" : "metric";
		return ["US", "LR", "MM"].indexOf(country) !== -1 ? "imperial" : "metric";
	}

	function applyUnits(units) {
		window.GG.units = units;
		if (typeof window.GG.refreshWeather === "function") window.GG.refreshWeather();
		if (typeof window.GG.refreshStrava  === "function") window.GG.refreshStrava();
	}

	function syncLabels(units) {
		var isMetric = units === "metric";
		var navText       = document.getElementById("units-nav-text");
		var footerToggle  = document.getElementById("units-copyright-toggle");
		if (navText)      navText.textContent      = isMetric ? "Imperial" : "Metric";
		if (footerToggle) footerToggle.textContent = isMetric ? "Imperial." : "Metric.";
	}

	function init() {
		var stored = localStorage.getItem(STORAGE_KEY);
		var units = stored || detectUnits();   // what the visitor last chose, or else where they are
		applyUnits(units);
		syncLabels(units);

		var navToggle = document.getElementById("units-nav-toggle");
		window.GG.showUnitsHint = function () {
			if (navToggle) navToggle.classList.add('nav-dot-hint');
		};
		window.GG.hideUnitsHint = function () {
			if (navToggle) navToggle.classList.remove('nav-dot-hint');
		};

		function toggle() {
			var current = window.GG.units || "imperial";
			var next = current === "imperial" ? "metric" : "imperial";
			localStorage.setItem(STORAGE_KEY, next);
			applyUnits(next);
			syncLabels(next);
		}

		var footerToggle = document.getElementById("units-copyright-toggle");
		if (navToggle)    navToggle.addEventListener("click", toggle);
		if (footerToggle) footerToggle.addEventListener("click", toggle);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init);
	} else {
		init();
	}
})();
