/* Gallery: auto-discover photos in images/photographs/ via GitHub's contents
   API, shuffle, and page through them 12 at a time with prev/next arrows.
   Worker source: github contents API */

(() => {
	const REPO_API = "https://api.github.com/repos/TheGarvitGupta/TheGarvitGupta.github.io/contents/images/photographs";
	const IMAGE_RE = /\.(jpe?g|png|webp|gif|mp4)$/i;
	const VIDEO_RE = /\.mp4$/i;
	const FALLBACK = [
		"69be7b6d-eaca-4a47-8529-5171c81d4c06.mp4",
		"DJI_20251213104838_0010_D.mp4",
		"IMG_0074 2.jpg",
		"IMG_0309.jpg",
		"IMG_0885.jpg",
		"IMG_1950.mp4",
		"IMG_20210227_142846_Original.jpg",
		"IMG_2072.jpg",
		"IMG_2083.mp4",
		"IMG_2230.jpg",
		"IMG_2308.jpg",
		"IMG_2406.jpg",
		"IMG_2481.jpg",
		"IMG_3043.jpg",
		"IMG_3194.jpg",
		"IMG_4700.jpg",
		"IMG_5660.jpg",
		"IMG_5978.jpg",
		"IMG_8813.mp4",
		"Photo_6553705_DJI_105_jpg_4887766_0_202196175122_photo_original.jpg",
		"ScreenRecording_03-03-2026 08-46-09_1.mp4",
		"Weiter.mp4",
		"photograph-12.jpg",
		"photograph-13.jpg",
		"photograph-15.jpg",
		"photograph-16.jpg",
		"photograph-18.jpg",
		"photograph-2.jpg",
		"photograph-20.jpg",
		"photograph-22.mp4",
		"photograph-3.jpg",
		"photograph-4.jpg",
		"photograph-5.jpg",
		"photograph-6.jpg",
		"photograph-7.jpg",
		"photograph-9.jpg",
	];
	const PAGE_SIZE = 12;
	// The first page's tiles start flung out from the middle and are drawn in by
	// the scroll (see scatterTiles / initScrollConverge).
	const SCATTER_REACH    = [0.34, 0.62]; // how far out a tile starts, as a share of the stage's longer side
	const SCATTER_ROTATION = 28;           // degrees, either way
	const SCATTER_SCALE    = [0.55, 0.85]; // size a tile starts at
	const SCATTER_SWIRL    = 0.7;          // radians its way in is bent by, either way
	const SCATTER_LATE     = 0.3;          // the last of the tiles sets off this far into the scroll
	const SNAP_AT          = 0.86;         // from here the tiles finish on their own
	const SNAP_MS          = 420;
	const ANIM_MS = 700;
	// Turning to another page: the two pages travel together, this far apart,
	// and a page seen for the first time has its tiles trail in behind it.
	const PAGE_GAP        = 0.16;  // of the stage's width, and never less than 70px
	const ARRIVE_TRAIL    = 0.3;   // of the stage's width: how far behind its place the last column starts
	const ARRIVE_STAGGER  = 200;   // ms the last column sets off after the first
	const ARRIVE_ROTATION = 9;     // degrees, either way
	// A finger on the stage carries the pages with it, and on letting go they
	// go on to the next page or back.
	const DRAG_SLOP   = 8;     // px a touch moves before it is taken for a drag or a scroll
	const DRAG_COMMIT = 0.22;  // of the stage's width: let go past this and the page turns
	const DRAG_FLICK  = 0.4;   // px per ms: or let go moving this fast

	let allPhotos = [];
	let currentPage = 0;
	let lightbox = null;
	let hasConverged = false;
	let transitioning = false;

	let strip, stage;
	let sections = []; // { gallery, cols, rows, thumbReady, upgrades } indexed by page
	let animationTimer = null;
	let inflightGallery = null; // gallery currently animating in

	const shuffle = (arr) => {
		for (let i = arr.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
		return arr;
	};

	let lastBp = null;
	let featuredPos = null;

	const applyLayout = (gallery, forceRandomize = false) => {
		const featured = gallery?.querySelector(".image-container.featured");
		if (!featured) return;
		const others = gallery.querySelectorAll(".image-container:not(.featured)");

		const isMobile = matchMedia("(max-width: 1180px)").matches;
		const [cols, rows] = isMobile ? [3, 5] : [5, 3];
		const bp = isMobile ? "m" : "d";
		if (bp !== lastBp || forceRandomize) {
			lastBp = bp;
			featuredPos = {
				fc: 1 + Math.floor(Math.random() * (cols - 1)),
				fr: 1 + Math.floor(Math.random() * 2)
			};
		}
		const { fc, fr } = featuredPos;
		featured.style.gridColumn = `${fc} / span 2`;
		featured.style.gridRow    = `${fr} / span 2`;

		const cells = [];
		for (let r = 1; r <= rows; r++) {
			for (let c = 1; c <= cols; c++) {
				const inFeat = r >= fr && r < fr + 2 && c >= fc && c < fc + 2;
				if (!inFeat) cells.push([r, c]);
			}
		}
		others.forEach((el, i) => {
			if (cells[i]) {
				el.style.gridRow    = cells[i][0];
				el.style.gridColumn = cells[i][1];
			}
		});

		// For each of the 4 corners, find whichever cell occupies that corner position
		// and set only that corner's radius on it. Clear all radii first.
		const allContainers = Array.from(gallery.querySelectorAll(".image-container"));
		allContainers.forEach(el => {
			el.style.borderRadius = "";
			el.querySelectorAll("img, video").forEach(m => m.style.borderRadius = "");
		});

		const R = 12;
		const cornerDefs = [
			{ r: 1,    c: 1,    idx: 0 }, // top-left     → border-radius index 0
			{ r: 1,    c: cols, idx: 1 }, // top-right    → index 1
			{ r: rows, c: cols, idx: 2 }, // bottom-right → index 2
			{ r: rows, c: 1,    idx: 3 }, // bottom-left  → index 3
		];

		cornerDefs.forEach(({ r, c, idx }) => {
			const occupant = allContainers.find(el => {
				const rs = parseInt(el.style.gridRow)    || 1;
				const cs = parseInt(el.style.gridColumn) || 1;
				const re = rs + (el.classList.contains("featured") ? 1 : 0);
				const ce = cs + (el.classList.contains("featured") ? 1 : 0);
				return r >= rs && r <= re && c >= cs && c <= ce;
			});
			if (!occupant) return;
			const parts = (occupant.style.borderRadius || "0px 0px 0px 0px")
				.split(" ").map(s => parseFloat(s) || 0);
			parts[idx] = R;
			const radius = parts.map(p => `${p}px`).join(" ");
			occupant.style.borderRadius = radius;
			occupant.querySelectorAll("img, video").forEach(m => m.style.borderRadius = radius);
		});

		return [cols, rows];
	};

	// Where each tile of the first page starts from: flung out from the middle of
	// the stage along its own line, small, turned and unseen; #life clips the
	// ones that start beyond its edges. Returns what
	// initScrollConverge needs to bring each one home.
	const scatterTiles = (gallery, cols, rows) => {
		const rand  = (lo, hi) => lo + Math.random() * (hi - lo);
		const reach = Math.max(stage.offsetWidth, stage.offsetHeight);
		const tiles = Array.from(gallery.querySelectorAll(".image-container")).map(el => {
			const span = el.classList.contains("featured") ? 2 : 1;
			const dx = ((parseFloat(el.style.gridColumn) || 1) - 1 + span / 2) / cols - 0.5;
			const dy = ((parseFloat(el.style.gridRow)    || 1) - 1 + span / 2) / rows - 0.5;
			// straight out from the middle, give or take; a tile at the middle has no way out of its own
			const angle = (Math.abs(dx) + Math.abs(dy) < 0.05 ? rand(0, 2 * Math.PI) : Math.atan2(dy, dx)) + rand(-0.35, 0.35);
			const start = rand(0, SCATTER_LATE);
			return {
				el, angle,
				dist:  rand(SCATTER_REACH[0], SCATTER_REACH[1]) * reach,
				rot:   rand(-SCATTER_ROTATION, SCATTER_ROTATION),
				scale: rand(SCATTER_SCALE[0], SCATTER_SCALE[1]),
				swirl: rand(-SCATTER_SWIRL, SCATTER_SWIRL),
				start,
				end:   rand(Math.max(start + 0.5, 0.85), 1),
			};
		});
		tiles.forEach(t => {
			// Its own layer, so moving it is the compositor's work and the photo is
			// not painted again on every frame of the scroll.
			t.el.style.willChange = "transform, opacity";
			t.el.style.transition = "none";
		});
		return tiles;
	};

	// k: how much of its way a tile still has to go, 1 at the start and 0 home.
	const placeTile = (t, k) => {
		const a = t.angle + t.swirl * k;
		const d = t.dist * k;
		t.el.style.transform = `translate3d(${(Math.cos(a) * d).toFixed(1)}px, ${(Math.sin(a) * d).toFixed(1)}px, 0) rotate(${(t.rot * k).toFixed(2)}deg) scale(${(1 + (t.scale - 1) * k).toFixed(3)})`;
		t.el.style.opacity   = Math.min(1, (1 - k) * 2.5).toFixed(3);
	};

	// A page seen for the first time comes in strung out behind itself: the
	// column that leads is nearly in place, each one after it starts further
	// back, a little turned and unseen, and sets off a little later. direction:
	// 1 = arriving from the right, -1 = from the left. Returns where each tile
	// starts, placed there.
	const trailTiles = (gallery, cols, direction) => {
		const rand = (lo, hi) => lo + Math.random() * (hi - lo);
		const width = stage.offsetWidth;
		const tiles = Array.from(gallery.querySelectorAll(".image-container")).map(el => {
			const col  = ((parseFloat(el.style.gridColumn) || 1) - 1) / (cols - 1);
			const back = direction > 0 ? col : 1 - col;   // 0 for the column that leads
			return {
				el,
				ox:   direction * (30 + back * ARRIVE_TRAIL * width + rand(0, 40)),
				oy:   rand(-26, 26),
				rot:  rand(-ARRIVE_ROTATION, ARRIVE_ROTATION),
				wait: Math.round(back * ARRIVE_STAGGER + rand(0, 60)),
			};
		});
		tiles.forEach(t => { t.el.style.transition = "none"; trailTile(t, 1); });
		return tiles;
	};

	// k: how much of its way a trailing tile still has to go, 1 at the start and 0 home.
	const trailTile = (t, k) => {
		t.el.style.transform = `translate3d(${(t.ox * k).toFixed(1)}px, ${(t.oy * k).toFixed(1)}px, 0) rotate(${(t.rot * k).toFixed(2)}deg) scale(${(1 - 0.1 * k).toFixed(3)})`;
		t.el.style.opacity   = Math.min(1, (1 - k) * 3).toFixed(3);
	};

	// A page that has arrived is left with nothing on its tiles to move them again.
	const settleTiles = (gallery) => {
		gallery.querySelectorAll(".image-container").forEach(el => {
			el.style.transition = el.style.transform = el.style.opacity = "";
		});
	};

	let scrollHandler = null;

	// Two-phase load: first walk every page loading only thumbnails, then once
	// all thumbnails are in, run every page's full-res upgrades. `firstUpgrades`
	// are the already-populated first page's upgrade fns, deferred into phase 2.
	const preloadRemainingPages = (after = Promise.resolve(), firstUpgrades = []) => {
		const numPages = Math.ceil(allPhotos.length / PAGE_SIZE);
		let thumbChain = after;
		const upgradeFns = [...firstUpgrades];
		for (let idx = 0; idx < numPages; idx++) {
			if (sections[idx]) continue;
			const g = createGallerySection();
			const [cols, rows] = applyLayout(g, true);
			sections[idx] = { gallery: g, cols, rows, thumbReady: [], upgrades: [] };
			g.style.display = "none";
			strip.appendChild(g);
			const capturedIdx = idx;
			thumbChain = thumbChain.then(() => {
				const populated = populateGallery(g, capturedIdx * PAGE_SIZE, cols, rows);
				Object.assign(sections[capturedIdx], populated);
				upgradeFns.push(...populated.upgrades);
				return allSettledOrTimeout(populated.thumbReady);
			});
		}
		// Phase 2: every thumbnail is loaded — now upgrade to full-res everywhere.
		return thumbChain.then(() => allSettledOrTimeout(upgradeFns.map(fn => fn())));
	};

	// Draws the scattered tiles of the first page home as the stage scrolls up
	// into view, and lets go once they are nearly there: from SNAP_AT they finish
	// by themselves, and stay.
	const initScrollConverge = (tiles) => {
		let queued = false;
		let last = -1;

		const finish = () => {
			tiles.forEach(t => {
				t.el.style.transition = t.el.style.transform = t.el.style.opacity = t.el.style.willChange = "";
			});
		};

		const snap = () => {
			hasConverged = true;
			window.removeEventListener("scroll", scrollHandler);
			window.removeEventListener("resize", scrollHandler);
			scrollHandler = null;
			// a little past and back, so they land rather than stop
			const ease = `${SNAP_MS}ms cubic-bezier(0.3, 1.35, 0.6, 1)`;
			tiles.forEach(t => {
				t.el.style.transition = `transform ${ease}, opacity ${SNAP_MS / 2}ms ease-out`;
				t.el.style.transform  = "translate3d(0, 0, 0) rotate(0deg) scale(1)";
				t.el.style.opacity    = "1";
			});
			setTimeout(finish, SNAP_MS + 80);
		};

		const frame = () => {
			queued = false;
			if (!scrollHandler) return;
			const { top, height } = stage.getBoundingClientRect();
			const progress = Math.max(0, Math.min(1, (window.innerHeight - top) / height));
			if (progress === last) return;
			last = progress;
			if (progress >= SNAP_AT) { snap(); return; }
			tiles.forEach(t => {
				const p = Math.max(0, Math.min(1, (progress - t.start) / (t.end - t.start)));
				placeTile(t, Math.pow(1 - p, 1.5));
			});
		};

		// Scroll events can come several to a frame; the tiles are moved once.
		scrollHandler = () => {
			if (queued) return;
			queued = true;
			requestAnimationFrame(frame);
		};

		window.addEventListener("scroll", scrollHandler, { passive: true });
		window.addEventListener("resize", scrollHandler, { passive: true });
		frame();
	};

	const createGallerySection = () => {
		const g = document.createElement("div");
		g.className = "gallery";
		const featured = document.createElement("div");
		featured.className = "image-container featured";
		const a0 = document.createElement("a");
		a0.className = "gallery-link";
		featured.appendChild(a0);
		g.appendChild(featured);
		for (let i = 0; i < 11; i++) {
			const c = document.createElement("div");
			c.className = "image-container";
			const a = document.createElement("a");
			a.className = "gallery-link";
			c.appendChild(a);
			g.appendChild(c);
		}
		return g;
	};

	// What is in flight, a turn or a turn called off, lands at once.
	let settleNow = null;
	const abortAnimation = () => {
		if (animationTimer) { clearTimeout(animationTimer); animationTimer = null; }
		drag = null;
		if (settleNow) { const land = settleNow; settleNow = null; land(); }
	};
	const landAfter = (ms, land) => {
		settleNow = land;
		animationTimer = setTimeout(() => { animationTimer = null; settleNow = null; land(); }, ms);
	};

	const PLACED = "position:absolute;top:0;left:0;width:100%;height:100%;overflow:visible;display:grid;";
	// Both pages go the same distance, a page's width and the gap, so they cross
	// the stage as one strip with the gap between them.
	const pageTravel   = () => stage.offsetWidth + Math.max(70, PAGE_GAP * stage.offsetWidth);
	const shownGallery = () => Array.from(strip.children).find(el => el.style.display !== "none") || strip.firstElementChild;

	const sectionFor = (idx) => {
		if (!sections[idx]) {
			const g = createGallerySection();
			const [cols, rows] = applyLayout(g, true);
			const { thumbReady, upgrades } = populateGallery(g, idx * PAGE_SIZE, cols, rows);
			sections[idx] = { gallery: g, cols, rows, thumbReady, upgrades };
		}
		return sections[idx];
	};

	// The turn is over: the page that arrived takes the strip, and the one that
	// left is hidden but kept, so its photos stay in memory.
	const landTurn = (oldGallery, sec, isNew) => {
		inflightGallery = null;
		if (oldGallery && oldGallery !== sec.gallery) {
			oldGallery.removeAttribute("style");
			oldGallery.style.display = "none";
		}
		settleTiles(sec.gallery);
		sec.gallery.removeAttribute("style");
		strip.appendChild(sec.gallery); // move from stage into strip
		transitioning = false;
		syncVideos();
		const fullResReady = isNew
			? allSettledOrTimeout(sec.thumbReady).then(() => allSettledOrTimeout(sec.upgrades.map(fn => fn())))
			: Promise.resolve();
		preloadRemainingPages(fullResReady);
	};

	// The turn is called off: the page that was coming is put away again and the
	// one that was there is as it was.
	const dropTurn = (oldGallery, gallery) => {
		inflightGallery = null;
		if (gallery) {
			settleTiles(gallery);
			gallery.removeAttribute("style");
			gallery.style.display = "none";
			strip.appendChild(gallery);
		}
		if (oldGallery) oldGallery.removeAttribute("style");
		transitioning = false;
		syncVideos();
	};

	// direction: 1 = the new page comes from the right (next), -1 = from the left (prev)
	// isNew: true = first time seeing this page (it slides in with its tiles trailing)
	//        false = revisiting (it slides in as it was left, and nothing else moves)
	const animateFlyIn = (sec, direction, isNew) => {
		const { gallery } = sec;
		const slide  = `transform ${ANIM_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;
		const travel = pageTravel();

		const oldGallery = shownGallery();
		if (oldGallery) {
			oldGallery.style.cssText = `${PLACED}transform:translate3d(0,0,0)`;
		}
		gallery.style.cssText = `${PLACED}transform:translate3d(${direction * travel}px,0,0);opacity:0`;
		stage.appendChild(gallery);
		inflightGallery = gallery;
		syncVideos();

		const tiles = isNew ? trailTiles(gallery, sec.cols, direction) : [];

		gallery.offsetWidth; // force reflow

		// The page leaving is whole for most of its way out and fades only as it
		// goes; the one arriving is there almost at once. It is the travel that
		// is seen, not one page dissolving into the other.
		if (oldGallery) {
			oldGallery.style.transition = `${slide}, opacity ${ANIM_MS * 0.45}ms ease-in ${ANIM_MS * 0.4}ms`;
			oldGallery.style.transform  = `translate3d(${-direction * travel}px,0,0)`;
			oldGallery.style.opacity    = "0";
		}
		gallery.style.transition = `${slide}, opacity ${ANIM_MS * 0.4}ms ease-out`;
		gallery.style.transform  = "translate3d(0,0,0)";
		gallery.style.opacity    = "1";

		tiles.forEach(t => {
			t.el.style.transition = `transform ${ANIM_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1) ${t.wait}ms, opacity ${ANIM_MS * 0.5}ms ease-out ${t.wait}ms`;
			trailTile(t, 0);
		});

		const longest = tiles.reduce((most, t) => Math.max(most, t.wait), 0);
		landAfter(ANIM_MS + longest + 50, () => landTurn(oldGallery, sec, isNew));
	};

	// --- A finger on the stage -------------------------------------------------
	// The page follows the finger, with its neighbour on that side beside it
	// across the gap; a neighbour not yet seen has its tiles trail in as far as
	// it has been pulled. Letting go far enough over, or fast enough, turns the
	// page, and anything less puts it back.
	let drag = null;
	const pageCount = () => Math.ceil(allPhotos.length / PAGE_SIZE);
	const clamp01  = (n) => Math.max(0, Math.min(1, n));

	// Stands the neighbour on one side beside the page being dragged, putting
	// away the one on the other side if the finger has come back across.
	const dragToward = (dir) => {
		if (drag.sec) dropTurn(null, drag.sec.gallery);
		transitioning = true;               // dropTurn says otherwise
		drag.dir = dir;
		drag.sec = drag.tiles = null;
		const idx = currentPage + dir;
		if (idx < 0 || idx >= pageCount()) return;   // nothing that way: the page only gives a little
		const sec = sectionFor(idx);
		drag.sec   = sec;
		drag.idx   = idx;
		drag.isNew = !sec.visited;
		sec.gallery.style.cssText = `${PLACED}transform:translate3d(${dir * drag.travel}px,0,0);opacity:0`;
		stage.appendChild(sec.gallery);
		inflightGallery = sec.gallery;
		drag.tiles = drag.isNew ? trailTiles(sec.gallery, sec.cols, dir) : null;
		syncVideos();
	};

	const dragFrame = () => {
		const { dx, old, sec, dir, travel, tiles } = drag;
		if (!sec) {
			old.style.transform = `translate3d(${(dx * 0.25).toFixed(1)}px,0,0)`;
			return;
		}
		const p = clamp01(Math.abs(dx) / travel);
		old.style.transform = `translate3d(${dx.toFixed(1)}px,0,0)`;
		old.style.opacity   = (1 - clamp01((p - 0.4) / 0.45)).toFixed(3);
		sec.gallery.style.transform = `translate3d(${(dir * travel + dx).toFixed(1)}px,0,0)`;
		sec.gallery.style.opacity   = clamp01(p / 0.3).toFixed(3);
		if (tiles) tiles.forEach(t => trailTile(t, 1 - p));
	};

	const dragStart = (e) => {
		if (e.touches.length !== 1 || !allPhotos.length) { drag = null; return; }
		if (transitioning) abortAnimation();
		const { clientX: x, clientY: y } = e.touches[0];
		drag = { x0: x, y0: y, dx: 0, lock: null, lastX: x, lastT: e.timeStamp, vx: 0 };
	};

	const dragMove = (e) => {
		if (!drag || drag.lock === "v") return;
		const { clientX: x, clientY: y } = e.touches[0];
		if (!drag.lock) {
			const ax = Math.abs(x - drag.x0), ay = Math.abs(y - drag.y0);
			if (ax < DRAG_SLOP && ay < DRAG_SLOP) return;
			if (ay > ax) { drag.lock = "v"; return; }   // the page is being scrolled, not turned
			drag.lock   = "h";
			drag.x0     = x;                             // no jump as the drag takes hold
			drag.travel = pageTravel();
			drag.old    = shownGallery();
			drag.old.style.cssText = `${PLACED}transform:translate3d(0,0,0)`;
			transitioning = true;
			const d = drag;
			settleNow = () => dropTurn(d.old, d.sec?.gallery);
		}
		const dt = e.timeStamp - drag.lastT;
		if (dt > 0) drag.vx = 0.7 * (x - drag.lastX) / dt + 0.3 * drag.vx;
		drag.lastX = x;
		drag.lastT = e.timeStamp;
		drag.dx = Math.max(-drag.travel, Math.min(drag.travel, x - drag.x0));
		const dir = drag.dx < 0 ? 1 : -1;
		if (drag.dx !== 0 && dir !== drag.dir) dragToward(dir);
		if (drag.queued) return;
		drag.queued = true;
		const d = drag;
		requestAnimationFrame(() => {
			d.queued = false;
			if (drag === d) dragFrame();   // not if it has been let go of since
		});
	};

	const dragEnd = (e) => {
		const d = drag;
		drag = null;
		if (!d || d.lock !== "h") return;
		settleNow = null;
		const { old, sec, dir, travel, tiles, isNew } = d;
		const p = clamp01(Math.abs(d.dx) / travel);
		// A finger that has stopped before lifting was not flicking.
		const vx = e.type === "touchend" && e.timeStamp - d.lastT < 80 ? d.vx : 0;
		const flick = Math.abs(vx) > DRAG_FLICK;
		const onward = vx < 0 ? 1 : -1;     // the way a flick is turning the pages
		const turn = e.type === "touchend" && sec &&
			(flick ? onward === dir : Math.abs(d.dx) > DRAG_COMMIT * stage.offsetWidth);
		const ease = "cubic-bezier(0.2, 0.8, 0.2, 1)";

		if (turn) {
			const ms = Math.round(Math.max(200, Math.min(480, ANIM_MS * (1 - p))));
			const move = `transform ${ms}ms ${ease}, opacity ${ms}ms ease-out`;
			old.style.transition = sec.gallery.style.transition = move;
			old.style.transform  = `translate3d(${-dir * travel}px,0,0)`;
			old.style.opacity    = "0";
			sec.gallery.style.transform = "translate3d(0,0,0)";
			sec.gallery.style.opacity   = "1";
			if (tiles) tiles.forEach(t => { t.el.style.transition = move; trailTile(t, 0); });
			currentPage = d.idx;
			sec.visited = true;
			updateDots(pageCount());
			rebuildLightbox();
			landAfter(ms + 50, () => landTurn(old, sec, isNew));
			return;
		}

		const ms = Math.round(Math.max(180, Math.min(400, ANIM_MS * p)));
		const move = `transform ${ms}ms ${ease}, opacity ${ms}ms ease-out`;
		old.style.transition = move;
		old.style.transform  = "translate3d(0,0,0)";
		old.style.opacity    = "1";
		if (sec) {
			sec.gallery.style.transition = move;
			sec.gallery.style.transform  = `translate3d(${dir * travel}px,0,0)`;
			sec.gallery.style.opacity    = "0";
			if (tiles) tiles.forEach(t => { t.el.style.transition = move; trailTile(t, 1); });
		}
		landAfter(ms + 50, () => dropTurn(old, sec?.gallery));
	};


	const allSettledOrTimeout = (promises, ms = 4000) =>
		Promise.race([
			Promise.allSettled(promises),
			new Promise(res => setTimeout(res, ms))
		]);

	// A clip is decoded for as long as it plays, seen or not, so the only ones
	// playing are those on the page being shown, while the stage is on screen.
	let stageInView = false;
	const shouldPlay = (gallery) => stageInView && (gallery === inflightGallery || sections[currentPage]?.gallery === gallery);
	const syncVideos = () => {
		sections.forEach(sec => {
			if (!sec) return;
			const on = shouldPlay(sec.gallery);
			sec.gallery.querySelectorAll("video").forEach(v => {
				if (on) { if (v.paused) v.play().catch(() => {}); }
				else if (!transitioning) v.pause();   // the page sliding out plays until it is gone
			});
		});
	};

	const makeVideo = (src, cr) => {
		const v = document.createElement("video");
		v.muted = true;
		v.loop  = true;
		v.preload = "auto";
		v.playsInline = true;
		v.setAttribute("playsinline", "");
		if (cr) v.style.borderRadius = cr;
		v.src = src;
		return v;
	};

	const populateGallery = (gallery, start, cols, rows) => {
		const containers = Array.from(gallery.querySelectorAll(".image-container"));
		containers.sort((a, b) => {
			const aRow = parseInt(a.style.gridRow)    || 1;
			const aCol = parseInt(a.style.gridColumn) || 1;
			const bRow = parseInt(b.style.gridRow)    || 1;
			const bCol = parseInt(b.style.gridColumn) || 1;
			return aRow !== bRow ? aRow - bRow : aCol - bCol;
		});

		const upgrades   = [];
		const thumbReady = [];

		containers.forEach((container, i) => {
			container.querySelectorAll("video, img").forEach(el => el.remove());

			if (start + i >= allPhotos.length) {
				container.style.background = "transparent";
				const anchor = container.querySelector("a.gallery-link");
				if (anchor) anchor.href = "";
				thumbReady.push(Promise.resolve());
				upgrades.push(() => {});
				return;
			}
			container.style.background = "";

			const idx      = start + i;
			const name     = allPhotos[idx];
			const bust     = location.hostname === "localhost" ? `?b=${Math.random()}` : "";
			const thumbUrl = `images/photographs/thumbs/${name}${bust}`;
			const fullUrl  = `images/photographs/${name}${bust}`;
			const anchor   = container.querySelector("a.gallery-link");
			if (anchor) anchor.href = fullUrl;

			const cr = container.style.borderRadius;

			if (VIDEO_RE.test(name)) {
				const thumb = makeVideo(thumbUrl, cr);
				anchor ? anchor.prepend(thumb) : container.prepend(thumb);
				thumbReady.push(new Promise(res => {
					thumb.addEventListener("canplay", res, { once: true });
					thumb.addEventListener("error",   res, { once: true });
					if (shouldPlay(gallery)) thumb.play().catch(() => {});
				}));
				upgrades.push(() => new Promise(res => {
					const full = makeVideo(fullUrl, cr);
					full.style.cssText += "opacity:0;transition:opacity 0.4s ease;z-index:1;";
					thumb.after(full);
					full.addEventListener("canplaythrough", () => {
						if (shouldPlay(gallery)) full.play().catch(() => {});
						full.style.opacity = "1";
						full.addEventListener("transitionend", () => { thumb.remove(); res(); }, { once: true });
					}, { once: true });
					full.addEventListener("error", res, { once: true });
				}));
			} else {
				const thumb = new Image();
				thumb.alt = "";
				if (cr) thumb.style.borderRadius = cr;
				anchor ? anchor.prepend(thumb) : container.prepend(thumb);
				thumbReady.push(new Promise(res => {
					if (thumb.complete) requestAnimationFrame(res);
					else {
						thumb.addEventListener("load",  () => requestAnimationFrame(res), { once: true });
						thumb.addEventListener("error", res, { once: true });
					}
				}));
				thumb.src = thumbUrl;
				upgrades.push(() => new Promise(res => {
					const full = new Image();
					full.alt = "";
					full.style.cssText = "opacity:0;transition:opacity 0.4s ease;z-index:1;";
					if (cr) full.style.borderRadius = cr;
					thumb.after(full);
					const show = () => {
						full.style.opacity = "1";
						full.addEventListener("transitionend", () => { thumb.remove(); res(); }, { once: true });
					};
					full.onerror = res;
					full.src = fullUrl;
					// decode() readies the pixels off the main thread; left to the
					// first paint, a large photo is a dropped frame mid-scroll.
					if (full.decode) full.decode().then(show, res);
					else full.onload = show;
				}));
			}
		});

		return { thumbReady, upgrades };
	};

	const updateDots = (numPages) => {
		const container = document.querySelector(".gallery-dots");
		if (!container) return;
		container.innerHTML = "";
		for (let i = 0; i < numPages; i++) {
			const dot = document.createElement("div");
			dot.className = "gallery-dot" + (i === currentPage ? " selected" : "");
			dot.addEventListener("click", () => navigateTo(i));
			container.appendChild(dot);
		}
		document.querySelector(".gallery-prev")?.classList.toggle("hidden", currentPage === 0);
		document.querySelector(".gallery-next")?.classList.toggle("hidden", currentPage >= numPages - 1);
	};

	const navigateTo = (targetIdx) => {
		if (!allPhotos.length) return;
		if (transitioning) abortAnimation();
		const numPages = Math.ceil(allPhotos.length / PAGE_SIZE);
		targetIdx = Math.max(0, Math.min(numPages - 1, targetIdx));
		if (targetIdx === currentPage) return;

		const direction = targetIdx > currentPage ? 1 : -1;
		const sec = sectionFor(targetIdx);
		const isNew = !sec.visited;
		currentPage = targetIdx;
		transitioning = true;
		sec.visited = true;

		animateFlyIn(sec, direction, isNew);
		updateDots(numPages);
		rebuildLightbox();
	};

	const showPage = (page) => {
		if (!allPhotos.length || transitioning) return;
		const numPages = Math.ceil(allPhotos.length / PAGE_SIZE);
		page = Math.max(0, Math.min(numPages - 1, page));
		if (page === currentPage && hasConverged) return;
		currentPage = page;
		updateDots(numPages);

		if (!hasConverged) {
			// first-load: populate first section with scroll-driven radial converge
			const firstGallery = strip.querySelector(".gallery");
			const [cols, rows] = applyLayout(firstGallery);
			const { thumbReady, upgrades } = populateGallery(firstGallery, 0, cols, rows);
			sections[0] = { gallery: firstGallery, cols, rows, thumbReady, upgrades, visited: true };
			syncVideos();
			const tiles = scatterTiles(firstGallery, cols, rows);
			tiles.forEach(t => placeTile(t, 1));
			// Phase 1 begins with the first page's thumbnails; once they're in we
			// kick off the scroll converge, then let preloadRemainingPages load the
			// rest of the thumbnails before any full-res (incl. this page's) loads.
			const firstThumbsReady = allSettledOrTimeout(thumbReady).then(() => {
				initScrollConverge(tiles);
			});
			preloadRemainingPages(firstThumbsReady, upgrades);
			rebuildLightbox();
			return;
		}

		navigateTo(page);
	};

	const setArrowsHidden = (hidden) => {
		document.querySelectorAll(".gallery-arrow").forEach(el => {
			el.classList.toggle("hidden", hidden);
		});
	};

	const lightboxVideo = (name) => {
		const v = document.createElement("video");
		v.src = `images/photographs/${name}`;
		v.className = "gallery-lightbox-video";
		// No controls: a video should behave like the photo either side of it, and
		// every clip is encoded silent anyway (tools/gallery.py passes -an), so a
		// scrubber and a volume slider were chrome over nothing. It also settles the
		// swipe question — with no scrubber to drag, a horizontal drag can only ever
		// mean "next slide".
		v.loop = true;
		v.muted = true;          // phones only autoplay silent video
		v.playsInline = true;
		v.setAttribute("playsinline", "");
		// Metadata, not "none": the slide is sized from the element's intrinsic
		// dimensions so it can be inset like a photo, and a <video> with nothing
		// loaded reports the spec's default 300x150 — the frame would appear at a
		// fraction of its size and jump once the first bytes arrived. Headers only;
		// ffmpeg writes these files with +faststart, so it is a small read.
		v.preload = "metadata";
		return v;
	};

	// GLightbox suppresses swipe navigation inside an inline slide so that
	// interactive content can be used without flicking to the next slide. Its test
	// (glightbox.js, touchstart) lets the swipe through when the touched node's
	// immediate parent is itself .gslide-inline, so marking the content wrapper
	// gives a video slide back the swipe every photo slide has. Without it a phone
	// reaches a video and cannot swipe past it.
	const enableSwipeOverVideos = () => {
		document.querySelectorAll(".glightbox-container .ginlined-content").forEach(el => {
			if (el.querySelector(".gallery-lightbox-video")) el.classList.add("gslide-inline");
		});
	};

	// Pause every lightbox video, then start the one on the slide now showing.
	const syncLightboxPlayback = () => {
		enableSwipeOverVideos();
		const vids = document.querySelectorAll(".glightbox-container .gallery-lightbox-video");
		const active = document.querySelector(".gslide.current .gallery-lightbox-video");
		vids.forEach(v => {
			if (v === active) return;
			v.pause();
			v.currentTime = 0;
		});
		if (!active) return;

		// A phone will only autoplay a video that is muted and inline, and both are
		// set — but only headers are preloaded, so this first call can still be
		// rejected for having no frames yet. Swallowing that promise is what leaves a
		// clip sitting on its first frame, so the attempt is made again once the
		// browser reports it has something. play() is idempotent when it is already
		// running, and the listeners are one-shot.
		const attempt = () => { const p = active.play(); if (p) p.catch(() => {}); };
		attempt();
		active.addEventListener("canplay",    attempt, { once: true });
		active.addEventListener("loadeddata", attempt, { once: true });
	};

	const rebuildLightbox = () => {
		if (typeof GLightbox !== "function") return;
		if (lightbox) { try { lightbox.destroy(); } catch (e) {} lightbox = null; }

		// Videos are handed over as inline content, not type:"video". That path pulls
		// Plyr off a CDN and wraps the clip in a player UI, which is the opposite of
		// what's wanted here — inline content leaves a bare element that shows nothing
		// but the picture, the way the photo slides do. Note that an inline slide must
		// not carry an href: slideInline() reads it as a hash, looks for an element by
		// that id, and abandons the slide when it finds none.
		const elements = allPhotos.map(name => VIDEO_RE.test(name)
			? { content: lightboxVideo(name) }
			: { href: `images/photographs/${name}`, type: "image" });

		lightbox = GLightbox({
			elements,
			touchNavigation: true,
			loop: true,
			selector: ".__glightbox_disabled__",
			onOpen:  () => { setArrowsHidden(true); syncLightboxPlayback(); },
			afterSlideChange: () => syncLightboxPlayback(),
			afterSlideLoad:   () => syncLightboxPlayback(),
			onClose: () => {
				document.querySelectorAll(".gallery-lightbox-video").forEach(v => v.pause());
				updateDots(Math.ceil(allPhotos.length / PAGE_SIZE));
			},
		});

		if (stage && !stage._galleryClickBound) {
			stage._galleryClickBound = true;
			stage.addEventListener("click", e => {
				const link = e.target.closest("a.gallery-link");
				if (!link || !link.href) return;
				e.preventDefault();
				// Locally the tiles carry a ?b= cache-buster, so match on the path
				// alone or every click on this machine would open the first slide.
				const href = link.getAttribute("href").split("?")[0];
				// Read allPhotos now rather than closing over a list: this listener is
				// bound once, but rebuildLightbox runs on every page change.
				const idx  = allPhotos.findIndex(n => `images/photographs/${n}` === href);
				lightbox?.openAt(idx >= 0 ? idx : 0);
			});
		}
	};

	addEventListener("resize", () => {
		sections.forEach(s => s && applyLayout(s.gallery));
	});

	const onReady = (cb) => document.readyState === "loading"
		? document.addEventListener("DOMContentLoaded", cb)
		: cb();

	const init = (photos) => {
		allPhotos = shuffle(photos.slice());
		stage = document.querySelector(".gallery-stage");
		strip = document.querySelector(".gallery-strip");

		document.querySelector(".gallery-prev")?.addEventListener("click", () => {
			navigateTo(currentPage - 1);
		});
		document.querySelector(".gallery-next")?.addEventListener("click", () => {
			navigateTo(currentPage + 1);
		});

		// A finger carries the pages (dragStart and the rest, above). The stage is
		// touch-action: pan-y, so a sideways drag is ours and an up-and-down one
		// is the browser's, which ends ours with a touchcancel.
		stage.addEventListener("touchstart",  dragStart, { passive: true });
		stage.addEventListener("touchmove",   dragMove,  { passive: true });
		stage.addEventListener("touchend",    dragEnd,   { passive: true });
		stage.addEventListener("touchcancel", dragEnd,   { passive: true });

		// Keyboard left/right arrows
		document.addEventListener("keydown", (e) => {
			if (lightbox?.lightboxOpen) return;   // GLightbox has no isOpen(); it steps through its own slides
			if (!stage.closest("body")) return;
			const rect = stage.getBoundingClientRect();
			const inView = rect.top < window.innerHeight && rect.bottom > 0;
			if (!inView) return;
			if (e.key === "ArrowLeft")  navigateTo(currentPage - 1);
			if (e.key === "ArrowRight") navigateTo(currentPage + 1);
		});

		// Trackpad / wheel horizontal scroll
		let wheelAccum = 0;
		let wheelCooldown = false;
		stage.addEventListener("wheel", (e) => {
			if (transitioning || wheelCooldown) return;
			if (Math.abs(e.deltaY) > Math.abs(e.deltaX) * 1.5) return;
			e.preventDefault();
			wheelAccum += e.deltaX;
			if (Math.abs(wheelAccum) >= 60) {
				const dir = wheelAccum > 0 ? 1 : -1;
				wheelAccum = 0;
				wheelCooldown = true;
				navigateTo(currentPage + dir);
				setTimeout(() => { wheelCooldown = false; wheelAccum = 0; }, ANIM_MS + 100);
			}
		}, { passive: false });

		if ("IntersectionObserver" in window) {
			new IntersectionObserver((entries) => {
				stageInView = entries[entries.length - 1].isIntersecting;
				syncVideos();
			}, { rootMargin: "200px 0px" }).observe(stage);
		} else {
			stageInView = true;
		}

		showPage(0);
	};

	fetch(REPO_API)
		.then(r => r.ok ? r.json() : Promise.reject(`API ${r.status}`))
		.then(items => items
			.filter(it => it.type === "file" && IMAGE_RE.test(it.name) && !it.name.startsWith("thumb_"))
			.map(it => it.name))
		.then(photos => onReady(() => init(photos)))
		.catch(err => {
			console.warn("Gallery: GitHub API failed, using fallback list", err);
			onReady(() => init(FALLBACK));
		});
})();
