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
		const json = (body, status = 200) =>
			new Response(JSON.stringify(body), { status, headers: cors });

		try {
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

			return json({
				ytdMeters: Math.round(ytd.distance || 0),
				lifetimeMeters: Math.round(all.distance || 0),
				ytdRunCount: ytd.count || 0,
				lifetimeRunCount: all.count || 0,
				profileUrl: `https://www.strava.com/athletes/${env.STRAVA_ATHLETE_ID}`,
			});
		} catch (err) {
			return json({ error: "exception", detail: String(err) }, 500);
		}
	},
};
