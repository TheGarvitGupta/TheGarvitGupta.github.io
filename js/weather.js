/* Weather widget for the hero designation line.
   Uses weather.gov (NWS) API — no key required.
   Shows SF normally; Cupertino Tue–Thu 9am–5pm Pacific.
   Caches last known result in localStorage for instant first paint. */

(function () {
	var CACHE_KEY = "gg:weather:v2";
	var CACHE_TTL = 15 * 60 * 1000; // 15 minutes
	var ICON_BASE = "images/weather/";

	var LOCATIONS = {
		sf: {
			label: "San Francisco",
			url: "https://api.weather.gov/gridpoints/MTR/85,105/forecast/hourly",
		},
		cupertino: {
			label: "Cupertino",
			url: "https://api.weather.gov/gridpoints/MTR/94,83/forecast/hourly",
		},
	};

	var ALL_ICONS = [
		"day.svg", "night.svg",
		"cloudy-day-1.svg", "cloudy-day-2.svg", "cloudy-day-3.svg",
		"cloudy-night-1.svg", "cloudy-night-2.svg", "cloudy-night-3.svg",
		"cloudy.svg",
		"rainy-1.svg", "rainy-2.svg", "rainy-3.svg", "rainy-4.svg", "rainy-5.svg", "rainy-6.svg", "rainy-7.svg",
		"snowy-1.svg", "snowy-2.svg", "snowy-3.svg", "snowy-4.svg", "snowy-5.svg", "snowy-6.svg",
		"thunder.svg",
	];

	var CONDITION_ICONS = [
		[/thunder|storm/i,                  "thunder.svg",       "thunder.svg"],
		[/blizzard/i,                       "snowy-3.svg",       "rainy-7.svg"],
		[/snow/i,                           "snowy-3.svg",       "snowy-5.svg"],
		[/sleet|freezing/i,                 "rainy-6.svg",       "rainy-6.svg"],
		[/drizzle/i,                        "rainy-2.svg",       "rainy-4.svg"],
		[/shower/i,                         "rainy-3.svg",       "rainy-5.svg"],
		[/rain/i,                           "rainy-6.svg",       "rainy-6.svg"],
		[/fog|mist|haze|overcast/i,         "cloudy.svg",        "cloudy-night-3.svg"],
		[/mostly cloudy/i,                  "cloudy-day-3.svg",  "cloudy-night-3.svg"],
		[/partly cloudy|partly sunny/i,     "cloudy-day-2.svg",  "cloudy-night-2.svg"],
		[/mostly sunny|mostly clear/i,      "day.svg",           "night.svg"],
		[/sunny|clear/i,                    "day.svg",           "night.svg"],
		[/wind/i,                           "cloudy-day-1.svg",  "cloudy-night-1.svg"],
	];

	var easterEggInterval = null;
	var easterEggIndex = 0;
	var animating = false;
	var svgCache = {};

	function fetchSVG(src, cb) {
		if (svgCache[src]) { cb(svgCache[src]); return; }
		fetch(src)
			.then(function (r) { return r.text(); })
			.then(function (text) {
				var match = text.match(/<svg[\s\S]*<\/svg>/i);
				if (!match) return;
				var svg = match[0];
				// Ensure the SVG fills its container
				svg = svg.replace(/<svg/, '<svg class="weather-icon-svg"');
				svgCache[src] = svg;
				cb(svg);
			})
			.catch(function () {});
	}

	function setIconSVG(src) {
		var $el = $(".weather-icon");
		if (!$el.length) return;
		fetchSVG(src, function (svg) {
			$el.html(svg);
		});
	}

	function conditionIcon(shortForecast, isDaytime) {
		for (var i = 0; i < CONDITION_ICONS.length; i++) {
			if (CONDITION_ICONS[i][0].test(shortForecast)) {
				return ICON_BASE + CONDITION_ICONS[i][isDaytime ? 1 : 2];
			}
		}
		return ICON_BASE + (isDaytime ? "day.svg" : "night.svg");
	}

	function isCupertinoTime() {
		var ptStr = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
		var pt = new Date(ptStr);
		var day = pt.getDay();
		var hour = pt.getHours();
		return (day >= 2 && day <= 4) && (hour >= 9 && hour < 17);
	}

	function ftToC(f) { return Math.round((f - 32) * 5 / 9); }

	function stopEasterEgg() {
		if (easterEggInterval) {
			clearInterval(easterEggInterval);
			easterEggInterval = null;
		}
	}

	function slideToIcon(newSrc) {
		if (animating) return;
		animating = true;
		fetchSVG(newSrc, function (svg) {
			$(".weather-icon").html(svg);
			animating = false;
		});
	}

	function startEasterEgg() {
		if (easterEggInterval) return; // already running
		var currentFile = $(".weather-icon").data("icon-src") || "";
		currentFile = currentFile.split("/").pop();
		easterEggIndex = ALL_ICONS.indexOf(currentFile);
		if (easterEggIndex === -1) easterEggIndex = 0;
		var startIndex = easterEggIndex;

		easterEggInterval = setInterval(function () {
			easterEggIndex = (easterEggIndex + 1) % ALL_ICONS.length;
			var isDark = document.documentElement.classList.contains("dark-mode");
			var src = ICON_BASE + (isDark ? "dark-" : "") + ALL_ICONS[easterEggIndex];
			slideToIcon(src);
			if (easterEggIndex === startIndex) stopEasterEgg();
		}, 400);
	}

	function onIconTap() {
		if (easterEggInterval) {
			stopEasterEgg();
		} else {
			startEasterEgg();
		}
	}

	function buildDisplay(icon, temp, label) {
		return '<span class="weather-icon" data-icon-src="' + icon + '" aria-label="Weather icon by amCharts"></span>' + temp + " &ndash; " + label;
	}

	function renderWeather(tempF, shortForecast, label, isDaytime) {
		var icon = conditionIcon(shortForecast, isDaytime);
		var $el = $(".designation");
		if (!$el.length) return;
		$el.data("weather-f", tempF);
		$el.data("weather-label", label);
		$el.data("weather-icon", icon);
		stopEasterEgg();
		updateWeatherDisplay();
	}

	function darkIcon(icon) {
		var file = icon.split("/").pop();
		return ICON_BASE + "dark-" + file;
	}

	function updateWeatherDisplay() {
		var $el = $(".designation");
		if (!$el.data("weather-f")) return;
		var tempF  = $el.data("weather-f");
		var label  = $el.data("weather-label");
		var icon   = $el.data("weather-icon");
		var isDark = document.documentElement.classList.contains("dark-mode");
		if (isDark) icon = darkIcon(icon);
		var useMetric = window.GG && window.GG.units === "metric";
		var temp = useMetric ? ftToC(tempF) + "°C" : Math.round(tempF) + "°F";
		$el.html(buildDisplay(icon, temp, label));
		setIconSVG(icon);
		$(".weather-icon").on("click", onIconTap);
	}

	window.GG = window.GG || {};
	window.GG.refreshWeather = updateWeatherDisplay;

	function getCache() {
		try {
			var raw = localStorage.getItem(CACHE_KEY);
			if (!raw) return null;
			var cached = JSON.parse(raw);
			if (Date.now() - cached.ts > CACHE_TTL) return null;
			return cached;
		} catch (e) { return null; }
	}

	function fetchWeather(loc) {
		fetch(loc.url, { headers: { "User-Agent": "garvitgupta.com weather widget" } })
			.then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
			.then(function (data) {
				var periods = data.properties && data.properties.periods;
				if (!periods || !periods.length) return;
				var now = Date.now();
				var period = periods[0];
				for (var i = 0; i < periods.length; i++) {
					var start = new Date(periods[i].startTime).getTime();
					var end   = new Date(periods[i].endTime).getTime();
					if (now >= start && now < end) { period = periods[i]; break; }
				}
				try {
					localStorage.setItem(CACHE_KEY, JSON.stringify({
						ts: Date.now(),
						tempF: period.temperature,
						shortForecast: period.shortForecast,
						label: loc.label,
						isDaytime: period.isDaytime,
					}));
				} catch (e) {}
				renderWeather(period.temperature, period.shortForecast, loc.label, period.isDaytime);
			})
			.catch(function (err) { console.warn("Weather fetch failed", err); });
	}

	var cached = getCache();
	if (cached) {
		$(document).ready(function () {
			renderWeather(cached.tempF, cached.shortForecast, cached.label, cached.isDaytime);
		});
	} else {
		$(document).ready(function () {
			fetchWeather(isCupertinoTime() ? LOCATIONS.cupertino : LOCATIONS.sf);
		});
	}
})();
