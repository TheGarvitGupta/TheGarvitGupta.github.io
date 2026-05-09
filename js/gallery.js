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
	const CONVERGE_PX = 40;
	const CONVERGE_JITTER_ANGLE = 20 * (Math.PI / 180); // ±20° in radians
	const CONVERGE_JITTER_DIST  = 10; // ±10px
	const CONVERGE_ROTATION_MAX = 12; // ±12° rotation

	let allPhotos = [];
	let currentPage = 0;
	let lightbox = null;
	let hasConverged = false;

	const shuffle = (arr) => {
		for (let i = arr.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
		return arr;
	};

	let lastBp = null;
	let featuredPos = null;
	const applyLayout = () => {
		const gallery = document.querySelector(".gallery");
		const featured = gallery?.querySelector(".image-container.featured");
		if (!featured) return;
		const others = gallery.querySelectorAll(".image-container:not(.featured)");

		const isMobile = matchMedia("(max-width: 1180px)").matches;
		const [cols, rows] = isMobile ? [3, 5] : [5, 3];
		const bp = isMobile ? "m" : "d";
		if (bp !== lastBp) {
			lastBp = bp;
			featuredPos = {
				fc: 1 + Math.floor(Math.random() * (cols - 1)),
				fr: 1 + Math.floor(Math.random() * 2)
			};
		}
		const { fc, fr } = featuredPos;
		featured.style.gridColumn = `${fc} / span 2`;
		featured.style.gridRow = `${fr} / span 2`;

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

		// corner border-radius — applied to container + media so transform doesn't break clipping
		gallery.querySelectorAll(".image-container").forEach(el => {
			const rStart  = parseInt(el.style.gridRow)    || 1;
			const cStart  = parseInt(el.style.gridColumn) || 1;
			const rowSpan = el.classList.contains("featured") ? 2 : 1;
			const colSpan = el.classList.contains("featured") ? 2 : 1;
			const rEnd = rStart + rowSpan - 1;
			const cEnd = cStart + colSpan - 1;
			const tl = rStart === 1    && cStart === 1;
			const tr = rStart === 1    && cEnd   === cols;
			const bl = rEnd   === rows && cStart === 1;
			const br = rEnd   === rows && cEnd   === cols;
			const radius = `${tl ? 12 : 0}px ${tr ? 12 : 0}px ${br ? 12 : 0}px ${bl ? 12 : 0}px`;
			if (tl || tr || bl || br) {
				el.style.borderRadius = radius;
				el.querySelectorAll("img, video").forEach(m => m.style.borderRadius = radius);
			} else {
				el.style.borderRadius = "";
				el.querySelectorAll("img, video").forEach(m => m.style.borderRadius = "");
			}
		});

		return [cols, rows];
	};

	const applyConvergeOffsets = (cols, rows) => {
		const cx = (cols + 1) / 2;
		const cy = (rows + 1) / 2;

		document.querySelectorAll(".gallery .image-container").forEach(el => {
			const col = parseFloat(el.style.gridColumn) || cx;
			const row = parseFloat(el.style.gridRow)    || cy;
			const dx = col - cx;
			const dy = row - cy;
			const baseAngle = Math.atan2(dy, dx);
			const jitteredAngle = baseAngle + (Math.random() * 2 - 1) * CONVERGE_JITTER_ANGLE;
			const dist = CONVERGE_PX + (Math.random() * 2 - 1) * CONVERGE_JITTER_DIST;
			el.dataset.ox  = Math.cos(jitteredAngle) * dist;
			el.dataset.oy  = Math.sin(jitteredAngle) * dist;
			el.dataset.rot = (Math.random() * 2 - 1) * CONVERGE_ROTATION_MAX;
			el.style.transition = "none";
			el.style.transform  = `translate(${el.dataset.ox}px, ${el.dataset.oy}px) rotate(${el.dataset.rot}deg)`;
		});
	};

	let scrollHandler = null;

	const initScrollConverge = (upgrades) => {
		if (scrollHandler) window.removeEventListener("scroll", scrollHandler);
		const gallery = document.querySelector(".gallery");
		if (!gallery) return;

		scrollHandler = () => {
			const { top, height } = gallery.getBoundingClientRect();
			const vh = window.innerHeight;
			// 0 when gallery top hits bottom of screen, 1 when gallery bottom hits bottom of screen
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
			}
		};

		window.addEventListener("scroll", scrollHandler, { passive: true });
		scrollHandler(); // apply immediately in case gallery is already (partially) visible
	};

	// resolves after all promises settle OR after a timeout, so the animation
	// always fires even if a thumbnail hangs (e.g. network stall)
	const allSettledOrTimeout = (promises, ms = 4000) =>
		Promise.race([
			Promise.allSettled(promises),
			new Promise(res => setTimeout(res, ms))
		]);

	addEventListener("resize", applyLayout);

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

	const updateDots = (numPages) => {
		const container = document.querySelector(".gallery-dots");
		if (!container) return;
		container.innerHTML = "";
		for (let i = 0; i < numPages; i++) {
			const dot = document.createElement("div");
			dot.className = "gallery-dot" + (i === currentPage ? " selected" : "");
			dot.addEventListener("click", () => showPage(i));
			container.appendChild(dot);
		}
		document.querySelector(".gallery-prev")?.classList.toggle("disabled", currentPage === 0);
		document.querySelector(".gallery-next")?.classList.toggle("disabled", currentPage === numPages - 1);
	};

	const showPage = (page) => {
		if (!allPhotos.length) return;
		const numPages = Math.ceil(allPhotos.length / PAGE_SIZE);
		page = Math.max(0, Math.min(numPages - 1, page)); // no wrapping
		currentPage = page;
		const start  = currentPage * PAGE_SIZE;

		const [cols, rows] = applyLayout();

		// assign photos in visual reading order (row → col) so the featured
		// cell gets whichever photo falls at its grid position, not always #1
		const containers = Array.from(document.querySelectorAll(".gallery .image-container"));
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
			// start fresh — avoids re-fetching thumbs on stale survivor elements
			container.querySelectorAll("video, img").forEach(el => el.remove());

			if (start + i >= allPhotos.length) {
				// last page may have fewer than PAGE_SIZE photos — leave cell empty
				const anchor = container.querySelector("a.gallery-link");
				if (anchor) anchor.href = "";
				thumbReady.push(Promise.resolve());
				upgrades.push(() => {});
				return;
			}

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

		if (!hasConverged) {
			applyConvergeOffsets(cols, rows);
			allSettledOrTimeout(thumbReady).then(() => initScrollConverge(upgrades));
		} else {
			allSettledOrTimeout(thumbReady).then(() => upgrades.forEach(fn => fn()));
		}

		updateDots(numPages);
		rebuildLightbox();
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

		// delegated listener attached once to the gallery element
		if (!document.querySelector(".gallery")?._galleryClickBound) {
			const gallery = document.querySelector(".gallery");
			if (gallery) {
				gallery._galleryClickBound = true;
				gallery.addEventListener("click", e => {
					const link = e.target.closest("a.gallery-link");
					if (!link) return;
					e.preventDefault();
					const href = link.getAttribute("href");
					const idx  = elements.findIndex(el => el.href === href);
					lightbox?.openAt(idx >= 0 ? idx : 0);
				});
			}
		}
	};

	const onReady = (cb) => document.readyState === "loading"
		? document.addEventListener("DOMContentLoaded", cb)
		: cb();

	const init = (photos) => {
		allPhotos = shuffle(photos.slice());
		document.querySelector(".gallery-prev")?.addEventListener("click", (e) => { if (!e.currentTarget.classList.contains("disabled")) showPage(currentPage - 1); });
		document.querySelector(".gallery-next")?.addEventListener("click", (e) => { if (!e.currentTarget.classList.contains("disabled")) showPage(currentPage + 1); });
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
