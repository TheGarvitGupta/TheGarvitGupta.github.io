// Cloudflare Worker — returns currently-playing or last-played track for the
// spotify display on garvitgupta.com.
//
// Required Spotify scopes on the refresh token:
//   user-read-playback-state     (current track + active device name)
//   user-read-recently-played    (last track when not actively playing)
//
// Deploy via Cloudflare dashboard:
//   1. dash.cloudflare.com -> Workers & Pages -> the spotify-now-playing worker
//   2. Edit code -> paste this file -> Deploy.
//   3. Settings -> Variables and Secrets, three Secrets:
//        SPOTIFY_CLIENT_ID
//        SPOTIFY_CLIENT_SECRET
//        SPOTIFY_REFRESH_TOKEN  (must include both scopes above)

export default {
	async fetch(request, env) {
		const cors = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Cache-Control": "public, max-age=2",
			"Content-Type": "application/json",
		};
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: cors });
		}

		const json = (body, status = 200) =>
			new Response(JSON.stringify(body), { status, headers: cors });

		try {
			// 1. Mint a fresh access token from the long-lived refresh token.
			const basic = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
			const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
				method: "POST",
				headers: {
					"Authorization": `Basic ${basic}`,
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({
					grant_type: "refresh_token",
					refresh_token: env.SPOTIFY_REFRESH_TOKEN,
				}),
			});
			if (!tokenRes.ok) {
				return json({ error: "token", detail: await tokenRes.text() }, 502);
			}
			const { access_token } = await tokenRes.json();
			const auth = { "Authorization": `Bearer ${access_token}` };

			// 2. Try /me/player (returns track + device info).
			const playRes = await fetch("https://api.spotify.com/v1/me/player", { headers: auth });
			if (playRes.status === 200) {
				const data = await playRes.json();
				if (data && data.item && data.is_playing) {
					return json({
						playing: true,
						track: data.item.name,
						artist: data.item.artists.map(a => a.name).join(", "),
						albumArt: (data.item.album.images[1] || data.item.album.images[0])?.url,
						progressMs: data.progress_ms,
						durationMs: data.item.duration_ms,
						url: data.item.external_urls.spotify,
						deviceName: data.device?.name || null,
						deviceType: data.device?.type || null,
					});
				}
			}

			// 3. Fall back to recently-played.
			const recentRes = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=1", { headers: auth });
			if (recentRes.ok) {
				const data = await recentRes.json();
				const item = data.items && data.items[0];
				if (item) {
					return json({
						playing: false,
						track: item.track.name,
						artist: item.track.artists.map(a => a.name).join(", "),
						albumArt: (item.track.album.images[1] || item.track.album.images[0])?.url,
						playedAt: item.played_at,
						url: item.track.external_urls.spotify,
					});
				}
			}
			return json({ playing: false });
		} catch (err) {
			return json({ error: "exception", detail: String(err) }, 500);
		}
	},
};
