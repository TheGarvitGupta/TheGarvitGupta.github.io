/* Weather widget for the hero designation line.
   Uses weather.gov (NWS) API — no key required.
   Shows SF normally; Cupertino Tue–Thu 9am–5pm Pacific.
   Caches last known result in localStorage for instant first paint. */

(function () {
	var CACHE_KEY = "gg:weather:v1";
	var CACHE_TTL = 15 * 60 * 1000; // 15 minutes

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

	var CONDITION_EMOJIS = [
		[/thunder|storm/i,                  "⛈️"],
		[/snow|blizzard/i,                  "❄️"],
		[/sleet|freezing/i,                 "🌨️"],
		[/rain|shower|drizzle/i,            "🌧️"],
		[/fog|mist|haze/i,                  "🌫️"],
		[/overcast|mostly cloudy/i,         "☁️"],
		[/partly cloudy|partly sunny/i,     "⛅"],
		[/mostly sunny|mostly clear/i,      "🌤️"],
		[/sunny|clear/i,                    "☀️"],
		[/wind/i,                           "🌬️"],
	];

	function conditionEmoji(shortForecast) {
		for (var i = 0; i < CONDITION_EMOJIS.length; i++) {
			if (CONDITION_EMOJIS[i][0].test(shortForecast)) return CONDITION_EMOJIS[i][1];
		}
		return "🌡️";
	}

	function isCupertinoTime() {
		var ptStr = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
		var pt = new Date(ptStr);
		var day = pt.getDay();
		var hour = pt.getHours();
		return (day >= 2 && day <= 4) && (hour >= 9 && hour < 17);
	}

	function ftToC(f) { return Math.round((f - 32) * 5 / 9); }

	function renderWeather(tempF, shortForecast, label, isDaytime) {
		var emoji = conditionEmoji(shortForecast);
		if (!isDaytime && /sunny|clear/i.test(shortForecast)) emoji = "🌙";
		var $el = $(".designation");
		if (!$el.length) return;
		$el.data("weather-f", tempF);
		$el.data("weather-label", label);
		$el.data("weather-emoji", emoji);
		updateWeatherDisplay();
	}

	function updateWeatherDisplay() {
		var $el = $(".designation");
		if (!$el.data("weather-f")) return;
		var tempF  = $el.data("weather-f");
		var label  = $el.data("weather-label");
		var emoji  = $el.data("weather-emoji");
		var useMetric = window.GG && window.GG.units === "metric";
		var temp = useMetric ? ftToC(tempF) + "°C" : Math.round(tempF) + "°F";
		$el.html(emoji + " " + temp + " &ndash; " + label);
	}

	window.GG = window.GG || {};
	window.GG.refreshWeather = updateWeatherDisplay;

	// Returns cached data if still fresh, null otherwise
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

	// Render from cache immediately if fresh — no fetch needed
	var cached = getCache();
	if (cached) {
		$(document).ready(function () {
			renderWeather(cached.tempF, cached.shortForecast, cached.label, cached.isDaytime);
		});
	} else {
		// Cache is stale or missing — fetch from NWS
		$(document).ready(function () {
			fetchWeather(isCupertinoTime() ? LOCATIONS.cupertino : LOCATIONS.sf);
		});
	}
})();
