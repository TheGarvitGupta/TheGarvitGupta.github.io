/* Gallery: auto-discover photos in images/photographs/ via GitHub's contents
   API, shuffle, and page through them 12 at a time with prev/next arrows.
   Worker source: github contents API */

(() => {
	const REPO_API = "https://api.github.com/repos/TheGarvitGupta/TheGarvitGupta.github.io/contents/images/photographs";
	const IMAGE_RE = /\.(jpe?g|png|webp|gif|mp4)$/i;
	const VIDEO_RE = /\.mp4$/i;
	const FALLBACK = [
		"photograph-2.jpg",   "photograph-3.jpg",  "photograph-4.jpg",
		"photograph-5.jpg",   "photograph-6.jpg",  "photograph-7.jpg",
		"photograph-8.jpg",   "photograph-9.jpg",  "photograph-10.jpg",
		"photograph-12.jpg",  "photograph-13.jpg", "photograph-15.jpg",
		"photograph-16.jpg",  "photograph-18.jpg", "photograph-20.jpg",
		"photograph-22.mp4",
		"IMG_20210227_142846_Original.jpg",
		"IMG_2072.jpg", "IMG_2083.mp4", "IMG_2406.jpg",
		"IMG_2464.jpg", "IMG_2481.jpg", "IMG_3043.jpg",
		"IMG_3194.jpg", "IMG_4700.jpg", "IMG_5660.jpg",
		"IMG_5978.jpg", "IMG_8239.jpg", "IMG_8373.jpg",
		"Photo_6553705_DJI_105_jpg_4887766_0_202196175122_photo_original.jpg",
		"DJI_20251213104838_0010_D.mp4",
		"ScreenRecording_03-03-2026 08-46-09_1.mp4",
	];
	const PAGE_SIZE = 12;
	const CONVERGE_PX          = 40;
	const CONVERGE_JITTER_ANGLE = 20 * (Math.PI / 180);
	const CONVERGE_JITTER_DIST  = 10;
	const CONVERGE_ROTATION_MAX = 12;
	const ANIM_MS = 700;

	let allPhotos = [];
	let currentPage = 0;
	let lightbox = null;
	let hasConverged = false;
	let transitioning = false;

	let strip, stage;
	let sections = []; // { gallery, cols, rows, thumbReady, upgrades } indexed by page

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

	// returns random offset data with organic jitter around a base direction angle (scroll converge)
	const randomOffset = (baseAngle) => {
		const angle = baseAngle + (Math.random() * 2 - 1) * CONVERGE_JITTER_ANGLE;
		const dist  = CONVERGE_PX + (Math.random() * 2 - 1) * CONVERGE_JITTER_DIST;
		return {
			ox:  Math.cos(angle) * dist,
			oy:  Math.sin(angle) * dist,
			rot: (Math.random() * 2 - 1) * CONVERGE_ROTATION_MAX,
		};
	};

	// Compute explosion-based offsets for a tile at (col, row) in a (cols x rows) grid.
	// explosionEdge: 'right' = origin at (cols+1, midRow), 'left' = origin at (0, midRow).
	// Returns {ox, oy, rot} — the displacement vector away from the explosion origin.
	const explosionOffset = (col, row, cols, rows, explosionEdge) => {
		const K = 90; // max displacement magnitude in px
		const midRow = (rows + 1) / 2;
		// explosion origin in 1-indexed grid space
		const ex = explosionEdge === 'right' ? cols + 0.5 : 0.5;
		const ey = midRow;
		// vector from explosion to tile center
		const vx = (col + 0.5) - ex;  // negative for 'right' (leftward), positive for 'left'
		const vy = (row + 0.5) - ey;  // negative=up, 0=middle, positive=down
		// normalize components separately by max possible distance so magnitudes are consistent
		const oxNorm = vx / cols;
		const oyNorm = vy / (rows / 2);
		return {
			ox:  oxNorm * K + (Math.random() * 2 - 1) * CONVERGE_JITTER_DIST,
			oy:  oyNorm * K + (Math.random() * 2 - 1) * CONVERGE_JITTER_DIST,
			rot: (Math.random() * 2 - 1) * CONVERGE_ROTATION_MAX,
		};
	};

	// baseAngle: null = radial from center (scroll converge), otherwise fixed direction
	const applyOffsets = (gallery, cols, rows, baseAngle = null) => {
		const cx = (cols + 1) / 2;
		const cy = (rows + 1) / 2;
		gallery.querySelectorAll(".image-container").forEach(el => {
			const col = parseFloat(el.style.gridColumn) || cx;
			const row = parseFloat(el.style.gridRow)    || cy;
			const angle = baseAngle !== null ? baseAngle : Math.atan2(row - cy, col - cx);
			const { ox, oy, rot } = randomOffset(angle);
			el.dataset.ox  = ox;
			el.dataset.oy  = oy;
			el.dataset.rot = rot;
			el.style.transition = "none";
			el.style.transform  = `translate(${ox}px, ${oy}px) rotate(${rot}deg)`;
		});
	};

	// Like applyOffsets but uses explosion model for page transitions.
	// explosionEdge: 'right' tiles fly away from right (outgoing for next), 'left' = prev outgoing.
	const applyExplosionOffsets = (gallery, cols, rows, explosionEdge) => {
		gallery.querySelectorAll(".image-container").forEach(el => {
			const col = parseFloat(el.style.gridColumn) || 1;
			const row = parseFloat(el.style.gridRow)    || 1;
			const { ox, oy, rot } = explosionOffset(col, row, cols, rows, explosionEdge);
			el.dataset.ox  = ox;
			el.dataset.oy  = oy;
			el.dataset.rot = rot;
			el.style.transition = "none";
			el.style.transform  = `translate(${ox}px, ${oy}px) rotate(${rot}deg)`;
		});
	};

	let scrollHandler = null;

	const preloadAdjacentPages = () => {
		const numPages = Math.ceil(allPhotos.length / PAGE_SIZE);
		[currentPage - 1, currentPage + 1].forEach(idx => {
			if (idx < 0 || idx >= numPages || sections[idx]) return;
			const g = createGallerySection();
			const [cols, rows] = applyLayout(g, true);
			const { thumbReady, upgrades } = populateGallery(g, idx * PAGE_SIZE, cols, rows);
			sections[idx] = { gallery: g, cols, rows, thumbReady, upgrades };
			g.style.display = "none";
			strip.appendChild(g);
		});
	};

	const initScrollConverge = (gallery, upgrades) => {
		if (scrollHandler) window.removeEventListener("scroll", scrollHandler);

		scrollHandler = () => {
			const stage = document.querySelector(".gallery-stage");
			if (!stage) return;
			const { top, height } = stage.getBoundingClientRect();
			const vh = window.innerHeight;
			const progress = Math.max(0, Math.min(1, (vh - top) / height));

			gallery.querySelectorAll(".image-container").forEach(el => {
				const ox  = parseFloat(el.dataset.ox)  || 0;
				const oy  = parseFloat(el.dataset.oy)  || 0;
				const rot = parseFloat(el.dataset.rot) || 0;
				const t   = 1 - progress;
				el.style.transition = "none";
				el.style.transform  = `translate(${ox * t}px, ${oy * t}px) rotate(${rot * t}deg)`;
			});

			if (progress >= 1) {
				hasConverged = true;
				window.removeEventListener("scroll", scrollHandler);
				scrollHandler = null;
				upgrades.forEach(fn => fn());
				preloadAdjacentPages();
			}
		};

		window.addEventListener("scroll", scrollHandler, { passive: true });
		scrollHandler();
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

	// direction: 1 = right (next), -1 = left (prev)
	// isNew: true = first time seeing this section (slide + tile convergence)
	//        false = revisiting (clean slide only, tiles already settled)
	const animateFlyIn = (gallery, cols, rows, direction, isNew, thumbReady, upgrades) => {
		const easing = `${ANIM_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;

		// Find the currently visible gallery (not hidden)
		const oldGallery = Array.from(strip.children).find(el => el.style.display !== "none") || strip.firstElementChild;
		if (oldGallery) {
			oldGallery.style.cssText = "position:absolute;top:0;left:0;width:100%;height:100%;overflow:visible;display:grid;transform:translateX(0)";
		}
		gallery.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;overflow:visible;display:grid;transform:translateX(${direction * 100}%);opacity:0`;
		stage.appendChild(gallery);

		if (isNew) {
			const explosionEdge = direction > 0 ? 'left' : 'right';
			applyExplosionOffsets(gallery, cols, rows, explosionEdge);
			gallery.querySelectorAll(".image-container").forEach(el => { el.style.opacity = "0"; });
		}

		gallery.offsetWidth; // force reflow

		const galleryEase = `transform ${easing}, opacity ${easing}`;
		if (oldGallery) {
			oldGallery.style.transition = galleryEase;
			oldGallery.style.transform  = `translateX(${-direction * 100}%)`;
			oldGallery.style.opacity    = "0";
		}
		gallery.style.transition = `transform ${easing}, opacity ${easing}`;
		gallery.style.transform  = "translateX(0)";
		gallery.style.opacity    = "1";

		if (isNew) {
			const tileEase = `transform ${easing}, opacity ${easing}`;
			gallery.querySelectorAll(".image-container").forEach(el => {
				el.style.transition = tileEase;
				el.style.transform  = "translate(0,0) rotate(0deg)";
				el.style.opacity    = "1";
			});
		}

		setTimeout(() => {
			// Hide old gallery but keep it in DOM so images stay in memory
			if (oldGallery && oldGallery !== gallery) {
				oldGallery.removeAttribute("style");
				oldGallery.style.display = "none";
			}
			gallery.removeAttribute("style");
			strip.appendChild(gallery); // move from stage into strip
			transitioning = false;
			if (isNew) allSettledOrTimeout(thumbReady).then(() => upgrades.forEach(fn => fn()));
			preloadAdjacentPages();
		}, ANIM_MS + 50);
	};


	const allSettledOrTimeout = (promises, ms = 4000) =>
		Promise.race([
			Promise.allSettled(promises),
			new Promise(res => setTimeout(res, ms))
		]);

	const makeVideo = (src, cr) => {
		const v = document.createElement("video");
		v.muted = true;
		v.loop  = true;
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
			const thumbUrl = `images/photographs/thumbs/${name}`;
			const fullUrl  = `images/photographs/${name}`;
			const anchor   = container.querySelector("a.gallery-link");
			if (anchor) anchor.href = fullUrl;

			const cr = container.style.borderRadius;

			if (VIDEO_RE.test(name)) {
				const thumb = makeVideo(thumbUrl, cr);
				thumb.autoplay = true;
				anchor ? anchor.prepend(thumb) : container.prepend(thumb);
				thumbReady.push(new Promise(res => {
					thumb.addEventListener("canplay", res, { once: true });
					thumb.addEventListener("error",   res, { once: true });
					thumb.play().catch(() => {});
				}));
				upgrades.push(() => {
					const full = makeVideo(fullUrl, cr);
					full.style.cssText += "opacity:0;transition:opacity 0.4s ease;z-index:1;";
					thumb.after(full);
					full.addEventListener("canplaythrough", () => {
						full.play().catch(() => {});
						full.style.opacity = "1";
						full.addEventListener("transitionend", () => thumb.remove(), { once: true });
					}, { once: true });
				});
			} else {
				const thumb = new Image();
				thumb.alt = "";
				if (cr) thumb.style.borderRadius = cr;
				thumb.src = thumbUrl;
				anchor ? anchor.prepend(thumb) : container.prepend(thumb);
				thumbReady.push(new Promise(res => {
					if (thumb.complete) res();
					else {
						thumb.addEventListener("load",  res, { once: true });
						thumb.addEventListener("error", res, { once: true });
					}
				}));
				upgrades.push(() => {
					const full = new Image();
					full.alt = "";
					full.style.cssText = "opacity:0;transition:opacity 0.4s ease;z-index:1;";
					if (cr) full.style.borderRadius = cr;
					thumb.after(full);
					full.onload = () => {
						full.style.opacity = "1";
						full.addEventListener("transitionend", () => thumb.remove(), { once: true });
					};
					full.src = fullUrl;
				});
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
		if (!allPhotos.length || transitioning) return;
		const numPages = Math.ceil(allPhotos.length / PAGE_SIZE);
		targetIdx = Math.max(0, Math.min(numPages - 1, targetIdx));
		if (targetIdx === currentPage) return;

		const direction = targetIdx > currentPage ? 1 : -1;
		const isNew = !sections[targetIdx];
		currentPage = targetIdx;
		transitioning = true;

		if (isNew) {
			const g = createGallerySection();
			const [cols, rows] = applyLayout(g, true);
			const { thumbReady, upgrades } = populateGallery(g, targetIdx * PAGE_SIZE, cols, rows);
			sections[targetIdx] = { gallery: g, cols, rows, thumbReady, upgrades };
		}
		const { gallery, cols, rows, thumbReady, upgrades } = sections[targetIdx];

		animateFlyIn(gallery, cols, rows, direction, isNew, thumbReady, upgrades);
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
			sections[0] = { gallery: firstGallery, cols, rows, thumbReady, upgrades };
			applyOffsets(firstGallery, cols, rows);
			allSettledOrTimeout(thumbReady).then(() => initScrollConverge(firstGallery, upgrades));
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

	const rebuildLightbox = () => {
		if (typeof GLightbox !== "function") return;
		if (lightbox) { try { lightbox.destroy(); } catch (e) {} lightbox = null; }

		const elements = allPhotos.map(name => ({
			href: `images/photographs/${name}`,
			type: VIDEO_RE.test(name) ? "video" : "image"
		}));

		lightbox = GLightbox({
			elements,
			touchNavigation: true,
			loop: true,
			selector: ".__glightbox_disabled__",
			onOpen:  () => setArrowsHidden(true),
			onClose: () => setArrowsHidden(false),
		});

		if (stage && !stage._galleryClickBound) {
			stage._galleryClickBound = true;
			stage.addEventListener("click", e => {
				const link = e.target.closest("a.gallery-link");
				if (!link || !link.href) return;
				e.preventDefault();
				const href = link.getAttribute("href");
				const idx  = elements.findIndex(el => el.href === href);
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

		// Touch swipe
		let touchStartX = 0, touchStartY = 0;
		stage.addEventListener("touchstart", (e) => {
			touchStartX = e.touches[0].clientX;
			touchStartY = e.touches[0].clientY;
		}, { passive: true });
		stage.addEventListener("touchend", (e) => {
			const dx = e.changedTouches[0].clientX - touchStartX;
			const dy = e.changedTouches[0].clientY - touchStartY;
			if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
				navigateTo(currentPage + (dx < 0 ? 1 : -1));
			}
		}, { passive: true });

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
