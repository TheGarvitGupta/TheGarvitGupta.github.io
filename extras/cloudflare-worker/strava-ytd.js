// Cloudflare Worker — returns year-to-date running stats for the
// running-bar widget on garvitgupta.com.
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

			// 2. Fetch athlete stats (has ytd_run_totals).
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

			// 3. Fetch latest run activity to check if one happened today.
			const actRes = await fetch(
				"https://www.strava.com/api/v3/athlete/activities?per_page=1&type=Run",
				{ headers: { "Authorization": `Bearer ${access_token}` } }
			);
			let latestRunDate = null;
			let latestRunMiles = null;
			if (actRes.ok) {
				const acts = await actRes.json();
				if (acts.length > 0) {
					// start_date_local is "2026-05-07T08:30:00Z" — take the date part
					latestRunDate = (acts[0].start_date_local || "").slice(0, 10);
					latestRunMiles = (acts[0].distance || 0) / 1609.344;
				}
			}

			const result = {
				ytdMeters: Math.round(ytd.distance || 0),
				lifetimeMeters: Math.round(all.distance || 0),
				ytdRunCount: ytd.count || 0,
				lifetimeRunCount: all.count || 0,
				profileUrl: `https://www.strava.com/athletes/${env.STRAVA_ATHLETE_ID}`,
				latestRunDate,
				latestRunMiles,
			};

			// Only write to KV if data changed (saves KV write quota)
			if (env.KV) {
				const existing = await env.KV.get(CACHE_KEY);
				const existingData = existing ? JSON.parse(existing) : null;
				if (!existingData || existingData.ytdMeters !== result.ytdMeters || existingData.latestRunDate !== result.latestRunDate) {
					await env.KV.put(CACHE_KEY, JSON.stringify(result), { expirationTtl: CACHE_TTL });
				}
			}

			return jsonCached(result);
		} catch (err) {
			return json({ error: "exception", detail: String(err) }, 500);
		}
	},
};
