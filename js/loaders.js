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
		syncParticles();
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

/* A hidden canvas is still drawn every frame unless its loop is stopped, so the
   particles stop being drawn while they are scrolled out of sight. */
function syncParticles() {
	var pJS = window.pJSDom && window.pJSDom[0] && window.pJSDom[0].pJS;
	if (!pJS || !!pJS.paused === particlesHidden) return;
	pJS.paused = particlesHidden;
	if (window.cancelRequestAnimFrame) window.cancelRequestAnimFrame(pJS.fn.drawAnimFrame);
	if (!particlesHidden) pJS.fn.vendors.draw();
}

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
		if (sports.length) sports[0].parentNode.style.setProperty("--on", n);   // the phone's sliding pill
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

/* Race medals: a hover over a disc (or a focus on it) opens its result in a card over the row, and a tap
   does on a phone; a tap anywhere else, Escape, or a swipe to another sport puts it away. The arrow at the
   card's corner opens the result itself. Paces and distances are kept in miles and shown in the chosen units.
   A mouse is followed from one place: at each move, what is under it says which card is open, if any,
   so cards that overlap the row above never fight over it. */
(function () {
	var medals = document.querySelectorAll(".path-medal");
	if (!medals.length) return;
	var openOne = null, shutTimer = null, openedAt = 0;

	function metric() { return window.GG && window.GG.units === "metric"; }
	function units(tip) {
		var m = metric();
		tip.querySelectorAll(".path-pace").forEach(function (el) {
			var s = Math.round(m ? el.dataset.s / 1.609344 : +el.dataset.s);
			el.textContent = Math.floor(s / 60) + ":" + ("0" + s % 60).slice(-2) + (m ? "/km" : "/mi");
		});
		tip.querySelectorAll(".path-dist").forEach(function (el) {
			el.textContent = m ? (el.dataset.m / 1000).toFixed(1) + " km" : (el.dataset.m / 1609.344).toFixed(1) + " mi";
		});
	}
	function open(medal) {
		clearTimeout(shutTimer);
		shutTimer = null;
		if (openOne === medal) return;
		shut();
		units(medal.querySelector(".path-tip"));
		openedAt = Date.now();
		medal.classList.add("open");
		medal.querySelector("button").setAttribute("aria-expanded", "true");
		openOne = medal;
	}
	function shut() {
		hold();
		clearTimeout(shutTimer);
		shutTimer = null;
		if (!openOne) return;
		openOne.classList.remove("open");
		openOne.querySelector("button").setAttribute("aria-expanded", "false");
		openOne = null;
	}
	// a pointer that leaves gets a moment to reach the card before it goes
	function shutSoon() { if (openOne && !shutTimer) shutTimer = setTimeout(shut, 220); }

	// The mouse. A disc under it opens its card at once, unless a card is open and the pointer is
	// heading up into it (on its way to the arrow, it may cross a neighbouring disc), when the neighbour
	// takes over only if the pointer stays on it a moment. Where the card lies over a disc of the row
	// above, a pause there hands over to that disc. The card, and the gap down to its disc, keep it open.
	var wait = null, waitFor = null;
	function hold() { clearTimeout(wait); wait = null; waitFor = null; }
	function after(ms, medal) {
		if (waitFor === medal) return;
		hold();
		waitFor = medal;
		wait = setTimeout(function () { wait = null; waitFor = null; open(medal); }, ms);
	}
	function discAt(x, y, except) {
		var stack = document.elementsFromPoint(x, y);
		for (var i = 0; i < stack.length; i++) {
			var b = stack[i].closest && stack[i].closest(".path-medal > button");
			if (b && b.parentNode !== except) return b.parentNode;
		}
		return null;
	}
	document.addEventListener("pointermove", function (e) {
		if (e.pointerType !== "mouse") return;
		var t = e.target instanceof Element ? e.target : null;
		var disc = t && t.closest(".path-medal > button");
		if (disc) {
			var medal = disc.parentNode;
			clearTimeout(shutTimer); shutTimer = null;
			if (!openOne) { hold(); return open(medal); }
			if (medal === openOne) return hold();
			var dx = e.movementX || 0, dy = e.movementY || 0;
			if (dy < 0 && Math.abs(dx) <= 3 * -dy) return after(120, medal);
			hold();
			return open(medal);
		}
		if (openOne && t && openOne.querySelector(".path-tip").contains(t)) {
			clearTimeout(shutTimer); shutTimer = null;
			if (t.closest(".path-go")) return hold();
			hold();   // moving: wait for a pause before looking under the card
			var under = discAt(e.clientX, e.clientY, openOne);
			if (under) after(150, under);
			return;
		}
		hold();
		shutSoon();
	}, { passive: true });
	document.documentElement.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") { hold(); shutSoon(); } });

	medals.forEach(function (medal) {
		var button = medal.querySelector("button");
		var by = "";
		button.setAttribute("aria-expanded", "false");
		button.addEventListener("pointerdown", function (e) { by = e.pointerType; });
		// a tap opens it, and a second tap on the same disc puts it away (but not the click that follows
		// the focus that has just opened it); a mouse click leaves it open
		button.addEventListener("click", function () {
			if (openOne === medal && by !== "mouse" && Date.now() - openedAt > 400) shut(); else open(medal);
			by = "";
		});
		// the keyboard: a focus opens it, and a focus elsewhere puts it away
		button.addEventListener("focus", function () { if (!by) open(medal); });
		medal.addEventListener("focusout", function (e) {
			if (openOne === medal && !medal.contains(e.relatedTarget) && !medal.matches(":hover")) shutSoon();
		});
	});
	document.addEventListener("click", function (e) {
		if (openOne && !openOne.contains(e.target)) shut();
	});
	document.addEventListener("keydown", function (e) {
		if (e.key === "Escape" && openOne) { var b = openOne.querySelector("button"); shut(); b.blur(); }
	});
	var reel = document.querySelector(".path-reel");
	if (reel) reel.addEventListener("scroll", shut, { passive: true });
	window.addEventListener("scroll", function () { if (openOne && !openOne.matches(":hover")) shut(); }, { passive: true });
	document.querySelectorAll(".path-play > li").forEach(function (li) {
		li.addEventListener("mouseenter", shut);
		li.addEventListener("click", shut);
	});
})();
