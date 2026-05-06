// Cloudflare Worker — returns currently-playing track for the spotify display
// on garvitgupta.com.
//
// Deploy via Cloudflare dashboard:
//   1. dash.cloudflare.com -> Workers & Pages -> Create -> Worker
//   2. Paste this file's contents into the editor.
//   3. Settings -> Variables and Secrets, add (Type: Secret):
//        SPOTIFY_CLIENT_ID
//        SPOTIFY_CLIENT_SECRET
//        SPOTIFY_REFRESH_TOKEN
//   4. Deploy. Note the worker URL (e.g. https://NAME.YOURNAME.workers.dev).
//   5. Paste that URL into js/spotify.js.

export default {
	async fetch(request, env) {
		const cors = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Cache-Control": "public, max-age=10",
			"Content-Type": "application/json",
		};

		if (request.method === "OPTIONS") {
			return new Response(null, { headers: cors });
		}

		try {
			// 1. Use the long-lived refresh_token to mint a fresh access_token.
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
				const text = await tokenRes.text();
				return new Response(JSON.stringify({ error: "token", detail: text }), {
					status: 502,
					headers: cors,
				});
			}
			const { access_token } = await tokenRes.json();

			// 2. Fetch currently-playing.
			const playRes = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
				headers: { "Authorization": `Bearer ${access_token}` },
			});

			// 204 = nothing playing.
			if (playRes.status === 204) {
				return new Response(JSON.stringify({ playing: false }), { headers: cors });
			}
			if (!playRes.ok) {
				return new Response(JSON.stringify({ error: "spotify", status: playRes.status }), {
					status: 502,
					headers: cors,
				});
			}
			const data = await playRes.json();
			if (!data || !data.item) {
				return new Response(JSON.stringify({ playing: false }), { headers: cors });
			}

			const body = {
				playing: !!data.is_playing,
				track: data.item.name,
				artist: data.item.artists.map(a => a.name).join(", "),
				albumArt: (data.item.album.images[1] || data.item.album.images[0])?.url,
				progressMs: data.progress_ms,
				durationMs: data.item.duration_ms,
				url: data.item.external_urls.spotify,
			};
			return new Response(JSON.stringify(body), { headers: cors });
		} catch (err) {
			return new Response(JSON.stringify({ error: "exception", detail: String(err) }), {
				status: 500,
				headers: cors,
			});
		}
	},
};
