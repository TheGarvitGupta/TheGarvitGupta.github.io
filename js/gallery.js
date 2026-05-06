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
		"photograph-13.jpeg"
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

	function populate(filenames) {
		var imgs = document.querySelectorAll(".gallery .image-container img");
		var pool = shuffle(filenames.slice());
		for (var i = 0; i < imgs.length && i < pool.length; i++) {
			imgs[i].src = "images/photographs/" + pool[i];
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
