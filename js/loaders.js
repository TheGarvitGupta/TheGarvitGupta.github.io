var navFlashTimeout;
function flashNav(idx) {
	if (navFlashTimeout) clearTimeout(navFlashTimeout);
	$(".nav-dot").removeClass("nav-flash");
	var $dot = $(".nav-dot:eq(" + idx + ")");
	$dot.addClass("nav-flash");
	navFlashTimeout = setTimeout(function () {
		$dot.removeClass("nav-flash");
		navFlashTimeout = null;
	}, 1500);
}

var particlesHidden = false;
$(window).scroll(function () {
	var scroll = $(window).scrollTop();

	/* Hide particles when out of viewport (visibility keeps canvas dimensions intact) */
	var shouldHide = scroll > window.innerHeight;
	if (shouldHide !== particlesHidden) {
		$("#particles-js").css("visibility", shouldHide ? "hidden" : "visible");
		particlesHidden = shouldHide;
	}

	/* Garvit Gupta image */
	if (($(".garvit-gupta").offset().top - scroll - window.innerHeight) <= -300) {
		$(".garvit-gupta").addClass("animated fadeIn");
	}

	/* Nav dot: select the section currently in view */
	var anchors = ["#aboutAnchor", "#lifeAnchor", "#workAnchor", "#contactAnchor"];
	var newPage = 1;
	for (var i = 0; i < anchors.length; i++) {
		if (scroll + 1 >= $(anchors[i]).offset().top) newPage = i + 2;
	}
	if (page !== newPage) {
		$(".nav-dot").removeClass("nav-dot-selected");
		$(".nav-dot:eq(" + (newPage - 1) + ")").addClass("nav-dot-selected");
		flashNav(newPage - 1);
		page = newPage;
	}

	/* Trigger polylion animation once when the element enters view */
	if (polygonLoaded === 0 && isElementInViewport($("#garvit-polymer"))) {
		polygonLoaded = 1;
		tmax_tl.staggerFromTo(polylion_shapes, polylion_duration, polylion_staggerFrom, polylion_staggerTo, polylion_stagger, 0);

		[0, 100, 200, 300].forEach(function (delay, i) {
			setTimeout(function () {
				$(".social-icon").eq(3 - i).addClass("animated fadeInRight");
			}, delay);
		});
	}
});

function isElementInViewport(el) {
	if (typeof jQuery === "function" && el instanceof jQuery) el = el[0];
	var rect = el.getBoundingClientRect();
	return (
		rect.top >= 0 &&
		rect.left >= 0 &&
		rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
		rect.right <= (window.innerWidth || document.documentElement.clientWidth)
	);
}

/* Smooth scroll for anchor links */
$(function () {
	$("a[href*=#]:not([href=#])").click(function () {
		if (location.pathname.replace(/^\//, "") === this.pathname.replace(/^\//, "") && location.hostname === this.hostname) {
			var target = $(this.hash);
			target = target.length ? target : $("[name=" + this.hash.slice(1) + "]");
			if (target.length) {
				$("html,body").animate({ scrollTop: target.offset().top }, 750);
				return false;
			}
		}
	});
});

/* Path column: its pieces rise in, one after another, the first time it scrolls into view */
(function () {
	var path = document.getElementById("path");
	if (!path || !("IntersectionObserver" in window)) return;
	path.classList.add("path-wait");
	new IntersectionObserver(function (entries, io) {
		if (!entries[0].isIntersecting) return;
		path.classList.remove("path-wait");
		path.classList.add("path-in");
		io.disconnect();
	}, { threshold: 0.12 }).observe(path);
})();

/* The navigation's unseen labels reach in over the Path column and over the photos and their
   arrows. While the pointer is on one of those the labels are told to let it through, so they
   do not show for it being there. */
(function () {
	var nav = document.querySelector(".navigation");
	var under = document.querySelectorAll("#path, .gallery-wrapper, .gallery-arrow");
	if (!nav || !under.length) return;
	function quiet(e) {
		var on = false;
		for (var i = 0; i < under.length && !on; i++) {
			if (under[i].classList.contains("hidden")) continue;
			var r = under[i].getBoundingClientRect();
			on = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
		}
		nav.classList.toggle("nav-quiet", on);
	}
	document.addEventListener("pointermove", quiet, { passive: true });
	document.addEventListener("pointerdown", quiet, { passive: true, capture: true });   // a tap has no move before it
})();

/* Path column: a sport's details show when its icon is hovered or tapped, and stay until another's are.
   On a phone the details are a row of pages (css/responsive.css): a tap on an icon slides to its page,
   and a swipe to a page lights its icon. */
(function () {
	var sports = document.querySelectorAll(".path-play > li");
	var reel = document.querySelector(".path-reel");
	if (!reel) return;
	var pages = reel.children;
	function swiped() { return getComputedStyle(reel).overflowX !== "visible"; }
	// a sport with nothing to say (its figures not in yet) has no page and no hand over its icon
	function full(i) { return !!pages[i].querySelector(".path-fig:not([hidden]), .path-medals, .path-loop, .path-map"); }
	function mark() {
		for (var i = 0; i < sports.length; i++) {
			sports[i].classList.toggle("has-detail", full(i));
			pages[i].classList.toggle("empty", !full(i));
		}
	}
	function pick(n) {
		for (var i = 0; i < sports.length; i++) {
			sports[i].classList.toggle("on", i === n);
			pages[i].classList.toggle("on", i === n);
		}
	}
	function go(n) {
		if (!full(n)) return;
		if (swiped()) reel.scrollTo({ left: pages[n].offsetLeft, behavior: "smooth" });
		else pick(n);
	}
	for (var i = 0; i < sports.length; i++) (function (n) {
		sports[n].addEventListener("mouseenter", function () { if (!swiped()) go(n); });
		sports[n].addEventListener("click", function () { go(n); });
	})(i);
	// the page nearest the reel's resting place is the one being looked at
	reel.addEventListener("scroll", function () {
		if (!swiped()) return;
		var best = -1, gap = Infinity;
		for (var i = 0; i < pages.length; i++) {
			if (!pages[i].offsetWidth) continue;
			var d = Math.abs(pages[i].offsetLeft - reel.scrollLeft);
			if (d < gap) { gap = d; best = i; }
		}
		if (best >= 0 && !pages[best].classList.contains("on")) pick(best);
	}, { passive: true });
	mark();
	new MutationObserver(mark).observe(reel, { subtree: true, attributes: true, attributeFilter: ["hidden"] });   // the figures arrive later (js/strava.js)
})();
