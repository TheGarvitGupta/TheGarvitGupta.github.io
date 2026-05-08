/* Metric / imperial toggle. Auto-detects from locale, defaults to imperial.
   Exposes window.GG.units ("metric" | "imperial") for other widgets. */

(function () {
	var STORAGE_KEY = "gg:units";

	window.GG = window.GG || {};

	function detectLocaleUnits() {
		try {
			// Locales that use metric for everyday measurements
			var locale = navigator.language || navigator.userLanguage || "";
			var country = locale.split("-")[1] || "";
			// US, Liberia (LR), Myanmar (MM) use imperial
			var imperial = ["US", "LR", "MM"];
			if (imperial.indexOf(country.toUpperCase()) !== -1) return "imperial";
			// If no country subtag, try to guess from base locale
			if (!country && locale.toLowerCase() === "en") return "imperial";
			if (!country) return "metric";
			return "metric";
		} catch (e) { return "imperial"; }
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
		var units = stored || detectLocaleUnits();
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
