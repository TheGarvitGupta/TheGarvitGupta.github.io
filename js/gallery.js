/* Gallery: auto-discover photos in images/photographs/ via GitHub's contents
   API, shuffle, and page through them 12 at a time with prev/next arrows.
   Worker source: github contents API */

(() => {
	const REPO_API = "https://api.github.com/repos/TheGarvitGupta/TheGarvitGupta.github.io/contents/images/photographs";
	const IMAGE_RE = /\.(jpe?g|png|webp|gif|mp4)$/i;
	const VIDEO_RE = /\.mp4$/i;
	const FALLBACK = [
		"photograph-1.jpg", "photograph-2.jpg", "photograph-3.jpg",
		"photograph-4.jpg", "photograph-5.jpg", "photograph-6.jpg",
		"photograph-7.jpg", "photograph-8.jpg", "photograph-9.jpg",
		"photograph-10.jpg", "photograph-11.jpg", "photograph-12.jpg",
		"photograph-13.jpg", "photograph-14.jpg", "photograph-15.jpg",
		"photograph-16.jpg", "photograph-17.jpg", "photograph-18.jpg",
		"photograph-19.jpg", "photograph-20.jpg", "photograph-21.jpg"
	];
	const pageSize = () => matchMedia("(max-width: 1180px)").matches ? 11 : 12;

	let allPhotos = [];
	let currentPage = 0;
	let lightbox = null;

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
		const [cols, rows] = isMobile ? [2, 7] : [5, 3];
		const bp = isMobile ? "m" : "d";
		if (bp !== lastBp) {
			lastBp = bp;
			featuredPos = {
				fc: cols === 2 ? 1 : 1 + Math.floor(Math.random() * (cols - 1)),
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
		// Hide any containers beyond the available non-featured cells
		Array.from(others).forEach((el, i) => {
			const cell = cells[i];
			if (cell) {
				el.style.display = "";
				el.style.gridRow = cell[0];
				el.style.gridColumn = cell[1];
			} else {
				el.style.display = "none";
			}
		});
	};

	addEventListener("resize", () => showPage(currentPage));

	const showPage = (page) => {
		if (!allPhotos.length) return;
		const PAGE_SIZE = pageSize();
		const numPages = Math.ceil(allPhotos.length / PAGE_SIZE);
		currentPage = ((page % numPages) + numPages) % numPages;
		const start = currentPage * PAGE_SIZE;

		applyLayout();

		// assign photos in visual reading order (row → col) so the featured
		// cell gets whichever photo falls at its grid position, not always #1
		const containers = Array.from(document.querySelectorAll(".gallery .image-container"));
		containers.sort((a, b) => {
			const aRow = parseInt(a.style.gridRow) || 1;
			const aCol = parseInt(a.style.gridColumn) || 1;
			const bRow = parseInt(b.style.gridRow) || 1;
			const bCol = parseInt(b.style.gridColumn) || 1;
			return aRow !== bRow ? aRow - bRow : aCol - bCol;
		});

		containers.filter(c => c.style.display !== "none").forEach((container, i) => {
			const idx = (start + i) % allPhotos.length;
			const name = allPhotos[idx];
			const thumbUrl = `images/photographs/thumbs/${name}`;
			const fullUrl  = `images/photographs/${name}`;
			const link = container.querySelector("a.gallery-link");
			if (link) link.href = fullUrl;

			const isVideo = VIDEO_RE.test(name);
			let existing = container.querySelector("video, img");

			if (isVideo) {
				if (!existing || existing.tagName !== "VIDEO") {
					const vid = document.createElement("video");
					vid.autoplay = true;
					vid.muted = true;
					vid.loop = true;
					vid.playsInline = true;
					vid.setAttribute("playsinline", "");
					existing?.replaceWith(vid);
					existing = vid;
				}
				existing.src = thumbUrl;
				existing.load();
				existing.play().catch(() => {});
			} else {
				if (!existing || existing.tagName !== "IMG") {
					const img = document.createElement("img");
					img.alt = "";
					existing?.replaceWith(img);
					existing = img;
				}
				existing.src = thumbUrl;
			}
		});

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
			onOpen: () => setArrowsHidden(true),
			onClose: () => setArrowsHidden(false),
		});

		document.querySelectorAll(".gallery a.gallery-link").forEach(link => {
			link.addEventListener("click", e => {
				e.preventDefault();
				const href = link.getAttribute("href");
				const idx = elements.findIndex(el => el.href === href);
				lightbox.openAt(idx >= 0 ? idx : 0);
			});
		});
	};

	const onReady = (cb) => document.readyState === "loading"
		? document.addEventListener("DOMContentLoaded", cb)
		: cb();

	const init = (photos) => {
		allPhotos = shuffle(photos.slice());
		document.querySelector(".gallery-prev")?.addEventListener("click", () => showPage(currentPage - 1));
		document.querySelector(".gallery-next")?.addEventListener("click", () => showPage(currentPage + 1));
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
