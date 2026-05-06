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
		if (typeof GLightbox === "function") {
			GLightbox({ selector: ".gallery .glightbox", touchNavigation: true, loop: true });
		}
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
