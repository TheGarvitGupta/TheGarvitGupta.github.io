// Cloudflare Worker — returns currently-playing or last-played track for the
// spotify display on garvitgupta.com.
//
// Required Spotify scopes on the refresh token:
//   user-read-playback-state     (current track + active device name)
//   user-read-recently-played    (last track when not actively playing)
//
// Required Cloudflare bindings:
//   Secrets: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN
//   KV namespace: SPOTIFY_CACHE  (bind as "SPOTIFY_CACHE" in worker settings)
//
// Deploy via Cloudflare dashboard:
//   1. dash.cloudflare.com -> Workers & Pages -> the spotify-now-playing worker
//   2. Edit code -> paste this file -> Deploy.
//   3. Settings -> Variables and Secrets, three Secrets (see above).
//   4. Settings -> KV namespace bindings -> add SPOTIFY_CACHE binding.
//   5. Settings -> Triggers -> Cron Triggers -> add "* * * * *" (every 1 min).

const CACHE_KEY = "last_playing";

async function getAccessToken(env) {
	const basic = btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`);
	const res = await fetch("https://accounts.spotify.com/api/token", {
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
	if (!res.ok) throw new Error(`token: ${await res.text()}`);
	const { access_token } = await res.json();
	return access_token;
}

// Returns track object if playing, null otherwise. Updates KV cache if playing.
async function fetchSpotify(env) {
	const access_token = await getAccessToken(env);
	const auth = { "Authorization": `Bearer ${access_token}` };

	const playRes = await fetch("https://api.spotify.com/v1/me/player", { headers: auth });
	if (playRes.status === 200) {
		const data = await playRes.json();
		if (data && data.item && data.is_playing) {
			const track = {
				playing: true,
				track: data.item.name,
				artist: data.item.artists.map(a => a.name).join(", "),
				albumArt: (data.item.album.images[1] || data.item.album.images[0])?.url,
				progressMs: data.progress_ms,
				durationMs: data.item.duration_ms,
				url: data.item.external_urls.spotify,
				deviceName: data.device?.name || null,
				deviceType: data.device?.type || null,
			};
			// Cache the playing track with current timestamp (strip progress, add cachedAt)
			const cached = { ...track, playing: false, cachedAt: Date.now() };
			delete cached.progressMs;
			delete cached.deviceName;
			delete cached.deviceType;
			await env.SPOTIFY_CACHE.put(CACHE_KEY, JSON.stringify(cached));
			return track;
		}
	}
	return null;
}

export default {
	// On-demand: called by the browser every 2s
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
			// Always try Spotify live first
			const track = await fetchSpotify(env);
			if (track) return json(track);

			// Not playing — try recently-played from Spotify
			const access_token = await getAccessToken(env);
			const recentRes = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=1", {
				headers: { "Authorization": `Bearer ${access_token}` },
			});
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

			// Last resort — fall back to KV cache from cron
			const cached = await env.SPOTIFY_CACHE.get(CACHE_KEY);
			if (cached) {
				const data = JSON.parse(cached);
				data.playedAt = new Date(data.cachedAt).toISOString();
				delete data.cachedAt;
				return json(data);
			}

			return json({ playing: false });
		} catch (err) {
			return json({ error: "exception", detail: String(err) }, 500);
		}
	},

	// Cron: runs every minute to keep KV cache warm
	async scheduled(event, env) {
		try {
			await fetchSpotify(env);
		} catch (_) {
			// best-effort, swallow errors
		}
	},
};
