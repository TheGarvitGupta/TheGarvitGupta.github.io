// Cloudflare Worker — returns year-to-date running stats + the most recent
// activity (run/ride route, or workout heart-rate trace) for the widget on
// garvitgupta.com.
//
// Required Strava scope on the refresh token: activity:read_all
//
// Deploy via Cloudflare dashboard:
//   1. dash.cloudflare.com -> Workers & Pages -> Create -> Worker (name: strava-ytd)
//   2. Edit code -> paste this file -> Deploy.
//   3. Settings -> Variables and Secrets, four Secrets:
//        STRAVA_CLIENT_ID
//        STRAVA_CLIENT_SECRET
//        STRAVA_REFRESH_TOKEN
//        STRAVA_ATHLETE_ID
//   4. Domains & Routes -> Add Route: www.garvitgupta.com/api/strava*
//   5. Settings -> Bindings -> Add KV namespace binding:
//        Variable name: KV  (create a new namespace called "strava-cache")

const CACHE_KEY = "strava:stats";
const CACHE_TTL = 90; // seconds — re-fetch from Strava at most once every 90s

// Activity types that have a GPS route we draw as a trace. Anything else
// (WeightTraining, Workout, Yoga, …) is treated as a "workout" and we draw the
// heart-rate trace instead.
const ROUTE_TYPES = new Set([
	"Run", "TrailRun", "VirtualRun",
	"Ride", "VirtualRide", "GravelRide", "MountainBikeRide",
	"Walk", "Hike",
]);

// Reverse-geocode a start point to a short place name (free, OpenStreetMap).
async function geocode(lat, lng) {
	try {
		const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&zoom=16&addressdetails=1`;
		const r = await fetch(url, {
			headers: { "User-Agent": "garvitgupta.com running widget (contact garvitgupta@icloud.com)" },
		});
		if (!r.ok) return null;
		const j = await r.json();
		const a = j.address || {};
		return (
			a.leisure || a.park || a.neighbourhood || a.suburb || a.quarter ||
			a.hamlet || a.village || a.town || a.city_district || a.road ||
			a.city || (j.display_name || "").split(",")[0] || null
		);
	} catch (e) {
		return null;
	}
}

// Fetch the heart-rate stream for a workout and downsample to ~60 points.
async function hrStream(id, token) {
	try {
		const r = await fetch(
			`https://www.strava.com/api/v3/activities/${id}/streams?keys=heartrate&key_by_type=true`,
			{ headers: { "Authorization": `Bearer ${token}` } }
		);
		if (!r.ok) return null;
		const j = await r.json();
		const hr = j.heartrate && j.heartrate.data;
		if (!hr || !hr.length) return null;
		const N = 60, step = Math.max(1, Math.floor(hr.length / N)), out = [];
		for (let i = 0; i < hr.length; i += step) out.push(hr[i]);
		return out;
	} catch (e) {
		return null;
	}
}

export default {
	async fetch(request, env) {
		const cors = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Cache-Control": "public, max-age=300",
			"Content-Type": "application/json",
		};
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: cors });
		}

		// Serve from Cloudflare edge cache if fresh (max 90s, matching KV TTL)
		const cache = caches.default;
		const cacheKey = new Request(request.url);
		const cachedEdge = await cache.match(cacheKey);
		if (cachedEdge) return cachedEdge;

		const json = (body, status = 200) =>
			new Response(JSON.stringify(body), { status, headers: cors });
		const jsonCached = async (body, status = 200) => {
			const res = new Response(JSON.stringify(body), { status, headers: cors });
			await cache.put(cacheKey, res.clone());
			return res;
		};

		try {
			// Return cached response if fresh (KV layer)
			if (env.KV) {
				const cached = await env.KV.get(CACHE_KEY);
				if (cached) return jsonCached({ ...JSON.parse(cached), cached: true });
			}

			// 1. Refresh access token (Strava tokens expire every 6 hours).
			const tokenRes = await fetch("https://www.strava.com/oauth/token", {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					client_id: env.STRAVA_CLIENT_ID,
					client_secret: env.STRAVA_CLIENT_SECRET,
					grant_type: "refresh_token",
					refresh_token: env.STRAVA_REFRESH_TOKEN,
				}),
			});
			if (!tokenRes.ok) {
				return json({ error: "token", detail: await tokenRes.text() }, 502);
			}
			const { access_token } = await tokenRes.json();

			// 2. Fetch athlete stats (has ytd_run_totals) for the 1000 km goal bar.
			const statsRes = await fetch(
				`https://www.strava.com/api/v3/athletes/${env.STRAVA_ATHLETE_ID}/stats`,
				{ headers: { "Authorization": `Bearer ${access_token}` } }
			);
			if (!statsRes.ok) {
				return json({ error: "stats", status: statsRes.status, detail: (await statsRes.text()).slice(0, 200) }, 502);
			}
			const stats = await statsRes.json();
			const ytd = stats.ytd_run_totals || {};
			const all = stats.all_run_totals || {};

			// 3. Fetch the most recent activity of ANY type.
			const actRes = await fetch(
				"https://www.strava.com/api/v3/athlete/activities?per_page=1",
				{ headers: { "Authorization": `Bearer ${access_token}` } }
			);
			let latest = null;
			if (actRes.ok) {
				const acts = await actRes.json();
				const act = acts[0];
				if (act) {
					const sportType = act.sport_type || act.type || "Workout";
					const hasRoute = ROUTE_TYPES.has(sportType) &&
						act.map && act.map.summary_polyline && (act.distance || 0) > 0;
					latest = {
						sportType,
						date: (act.start_date_local || "").slice(0, 10),
						distanceMeters: Math.round(act.distance || 0),
						movingSeconds: act.moving_time || 0,
						kind: hasRoute ? "route" : "workout",
					};
					const ll = Array.isArray(act.start_latlng) && act.start_latlng.length === 2
						? act.start_latlng : null;
					if (ll) latest.place = await geocode(ll[0], ll[1]);

					if (hasRoute) {
						latest.polyline = act.map.summary_polyline;
					} else {
						latest.avgHr = act.average_heartrate ? Math.round(act.average_heartrate) : null;
						latest.maxHr = act.max_heartrate ? Math.round(act.max_heartrate) : null;
						if (act.has_heartrate) latest.hr = await hrStream(act.id, access_token);
					}
				}
			}

			const result = {
				ytdMeters: Math.round(ytd.distance || 0),
				lifetimeMeters: Math.round(all.distance || 0),
				ytdRunCount: ytd.count || 0,
				lifetimeRunCount: all.count || 0,
				profileUrl: `https://www.strava.com/athletes/${env.STRAVA_ATHLETE_ID}`,
				latest,
			};

			// Only write to KV if something changed (saves KV write quota)
			const sig = latest ? `${latest.date}|${latest.sportType}|${latest.distanceMeters}` : "";
			if (env.KV) {
				const existing = await env.KV.get(CACHE_KEY);
				const ex = existing ? JSON.parse(existing) : null;
				const exSig = ex && ex.latest ? `${ex.latest.date}|${ex.latest.sportType}|${ex.latest.distanceMeters}` : "";
				if (!ex || ex.ytdMeters !== result.ytdMeters || exSig !== sig) {
					await env.KV.put(CACHE_KEY, JSON.stringify(result), { expirationTtl: CACHE_TTL });
				}
			}

			return jsonCached(result);
		} catch (err) {
			return json({ error: "exception", detail: String(err) }, 500);
		}
	},
};
