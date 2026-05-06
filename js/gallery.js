/* Gallery: auto-discover photos in images/photographs/ via GitHub's contents
   API, shuffle, and assign one to each tile (no repeats). Drop a new photo
   into the folder on master and it shows up next page load. If the API call
   fails (rate limit, offline), fall back to the snapshot list below. */

(() => {
	const REPO_API = "https://api.github.com/repos/TheGarvitGupta/TheGarvitGupta.github.io/contents/images/photographs";
	const IMAGE_RE = /\.(jpe?g|png|webp|gif)$/i;
	const FALLBACK = [
		"photograph-1.jpeg", "photograph-2.jpeg", "photograph-3.jpeg",
		"photograph-4.jpeg", "photograph-5.jpeg", "photograph-6.jpeg",
		"photograph-7.jpeg", "photograph-8.jpeg", "photograph-9.jpeg",
		"photograph-10.jpeg", "photograph-11.jpeg", "photograph-12.jpeg",
		"photograph-13.jpeg", "photograph-14.jpeg", "photograph-15.jpeg",
		"photograph-16.jpeg", "photograph-17.jpeg", "photograph-18.jpeg",
		"photograph-19.jpeg", "photograph-20.jpeg", "photograph-21.jpeg"
	];

	const shuffle = (arr) => {
		for (let i = arr.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
		return arr;
	};

	// Browser auto-placement (Chrome + WebKit) skips one cell when items mix
	// explicit and auto placement, so we place every cell explicitly via JS.
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
				el.style.gridRow = cells[i][0];
				el.style.gridColumn = cells[i][1];
			}
		});
	};

	addEventListener("resize", applyLayout);

	const populate = (filenames) => {
		applyLayout();
		const imgs = document.querySelectorAll(".gallery .image-container img");
		const pool = shuffle(filenames.slice());
		imgs.forEach((img, i) => {
			if (i >= pool.length) return;
			const url = `images/photographs/${pool[i]}`;
			img.src = url;
			if (img.parentElement?.tagName === "A") img.parentElement.href = url;
		});
		setupLightbox(filenames);
	};

	const setupLightbox = (allPhotos) => {
		if (typeof GLightbox !== "function") return;
		// Sort tiles by rendered position so the visual top-left is index 0.
		const containers = [...document.querySelectorAll(".gallery .image-container")];
		containers.sort((a, b) => {
			const ar = a.getBoundingClientRect();
			const br = b.getBoundingClientRect();
			return Math.abs(ar.top - br.top) > 1 ? ar.top - br.top : ar.left - br.left;
		});
		const displayed = containers
			.map(c => c.querySelector("img")?.src.split("/").pop())
			.filter(Boolean);
		const seen = new Set(displayed);
		const ordered = [...displayed, ...allPhotos.filter(n => !seen.has(n))];
		const elements = ordered.map(name => ({
			href: `images/photographs/${name}`,
			type: "image"
		}));
		const lightbox = GLightbox({ elements, touchNavigation: true, loop: true });
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

	fetch(REPO_API)
		.then(r => r.ok ? r.json() : Promise.reject(`API ${r.status}`))
		.then(items => items
			.filter(it => it.type === "file" && IMAGE_RE.test(it.name))
			.map(it => it.name))
		.then(photos => onReady(() => populate(photos)))
		.catch(err => {
			console.warn("Gallery: GitHub API failed, using fallback list", err);
			onReady(() => populate(FALLBACK));
		});
})();
