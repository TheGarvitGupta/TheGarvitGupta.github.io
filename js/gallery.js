/* Gallery: auto-discover photos in images/photographs/ via GitHub's contents
   API, shuffle, and assign one to each tile (no repeats). Drop a new photo
   into the folder on master and it shows up next page load. If the API call
   fails (rate limit, offline), fall back to the snapshot list below. */

(function () {
	var REPO_API = "https://api.github.com/repos/TheGarvitGupta/TheGarvitGupta.github.io/contents/images/photographs";
	var IMAGE_RE = /\.(jpe?g|png|webp|gif)$/i;
	var FALLBACK = [
		"photograph-1.jpeg",
		"photograph-2.jpeg",
		"photograph-3.jpeg",
		"photograph-4.jpeg",
		"photograph-5.jpeg",
		"photograph-6.jpeg",
		"photograph-7.jpeg",
		"photograph-8.jpeg",
		"photograph-9.jpeg",
		"photograph-10.jpeg",
		"photograph-11.jpeg",
		"photograph-12.jpeg",
		"photograph-13.jpeg",
		"photograph-14.jpeg",
		"photograph-15.jpeg",
		"photograph-16.jpeg",
		"photograph-17.jpeg",
		"photograph-18.jpeg",
		"photograph-19.jpeg",
		"photograph-20.jpeg",
		"photograph-21.jpeg"
	];

	function shuffle(arr) {
		for (var i = arr.length - 1; i > 0; i--) {
			var j = Math.floor(Math.random() * (i + 1));
			var tmp = arr[i];
			arr[i] = arr[j];
			arr[j] = tmp;
		}
		return arr;
	}

	// Browser auto-placement (Chrome + WebKit) skips one cell when items mix
	// explicit and auto placement, so we place every cell explicitly via JS.
	// The featured (2x2) lands at a random valid position; the 11 others fill
	// the remaining cells in row-major order.
	var lastBreakpoint = null;
	function applyLayout() {
		var gallery = document.querySelector(".gallery");
		if (!gallery) return;
		var featured = gallery.querySelector(".image-container.featured");
		var others = Array.prototype.slice.call(
			gallery.querySelectorAll(".image-container:not(.featured)")
		);
		if (!featured) return;

		var isMobile = window.matchMedia("(max-width: 1180px)").matches;
		var cols = isMobile ? 3 : 5;
		var rows = isMobile ? 5 : 3;

		// Re-randomize only when crossing the breakpoint (or first run),
		// so random resizes within a breakpoint don't reshuffle.
		var bp = isMobile ? "m" : "d";
		if (bp !== lastBreakpoint) {
			lastBreakpoint = bp;
			// Featured starts at col 1..(cols-1), row 1..2.
			var fc = 1 + Math.floor(Math.random() * (cols - 1));
			var fr = 1 + Math.floor(Math.random() * 2);
			gallery.dataset.fc = fc;
			gallery.dataset.fr = fr;
		}
		var fc = parseInt(gallery.dataset.fc, 10);
		var fr = parseInt(gallery.dataset.fr, 10);

		featured.style.gridColumn = fc + " / span 2";
		featured.style.gridRow = fr + " / span 2";

		var cells = [];
		for (var r = 1; r <= rows; r++) {
			for (var c = 1; c <= cols; c++) {
				var inFeat = r >= fr && r < fr + 2 && c >= fc && c < fc + 2;
				if (!inFeat) cells.push([r, c]);
			}
		}
		for (var i = 0; i < others.length && i < cells.length; i++) {
			others[i].style.gridRow = cells[i][0];
			others[i].style.gridColumn = cells[i][1];
		}
	}

	window.addEventListener("resize", applyLayout);

	function populate(filenames) {
		applyLayout();
		var imgs = document.querySelectorAll(".gallery .image-container img");
		var pool = shuffle(filenames.slice());
		for (var i = 0; i < imgs.length && i < pool.length; i++) {
			var url = "images/photographs/" + pool[i];
			imgs[i].src = url;
			var link = imgs[i].parentElement;
			if (link && link.tagName === "A") {
				link.href = url;
			}
		}
		setupLightbox(filenames);
	}

	function setupLightbox(allPhotos) {
		if (typeof GLightbox !== "function") return;
		// Lightbox slide order: displayed tiles first (sorted by visual grid
		// position so the top-left tile is index 0), then any photos in the
		// folder that aren't shown on the page. Looping wraps the last photo
		// back to the top-left tile.
		var containers = Array.prototype.slice.call(
			document.querySelectorAll(".gallery .image-container")
		);
		// Sort by actual rendered position so the top-left tile is always
		// index 0, regardless of which tile (featured or small) ended up there.
		containers.sort(function (a, b) {
			var ar = a.getBoundingClientRect();
			var br = b.getBoundingClientRect();
			if (Math.abs(ar.top - br.top) > 1) return ar.top - br.top;
			return ar.left - br.left;
		});
		var displayed = [];
		var displayedSet = {};
		containers.forEach(function (c) {
			var img = c.querySelector("img");
			if (img && img.src) {
				var name = img.src.split("/").pop();
				displayed.push(name);
				displayedSet[name] = true;
			}
		});
		var rest = allPhotos.filter(function (n) { return !displayedSet[n]; });
		var orderedNames = displayed.concat(rest);
		var elements = orderedNames.map(function (name) {
			return { href: "images/photographs/" + name, type: "image" };
		});
		var lightbox = GLightbox({
			elements: elements,
			// Disable selector-based auto-binding; we handle clicks manually
			// below so the lightbox uses the full `elements` list (all photos
			// in the folder) instead of just the 12 visible tiles' data-gallery.
			selector: ".__glightbox_disabled__",
			touchNavigation: true,
			loop: true
		});
		var links = document.querySelectorAll(".gallery a.glightbox");
		links.forEach(function (link) {
			link.addEventListener("click", function (e) {
				e.preventDefault();
				var href = link.getAttribute("href");
				for (var i = 0; i < elements.length; i++) {
					if (elements[i].href === href) {
						lightbox.openAt(i);
						return;
					}
				}
				lightbox.openAt(0);
			});
		});
	}

	function whenReady(cb) {
		if (document.readyState === "loading") {
			document.addEventListener("DOMContentLoaded", cb);
		} else {
			cb();
		}
	}

	fetch(REPO_API)
		.then(function (r) {
			if (!r.ok) throw new Error("API " + r.status);
			return r.json();
		})
		.then(function (items) {
			var photos = items
				.filter(function (it) { return it.type === "file" && IMAGE_RE.test(it.name); })
				.map(function (it) { return it.name; });
			whenReady(function () { populate(photos); });
		})
		.catch(function (err) {
			console.warn("Gallery: GitHub API failed, using fallback list", err);
			whenReady(function () { populate(FALLBACK); });
		});
})();
