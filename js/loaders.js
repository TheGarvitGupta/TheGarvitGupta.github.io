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

	/* Animate lede sections as they enter view */
	$(".lede-parent").each(function (i) {
		if (($(this).offset().top - scroll - window.innerHeight) <= -300) {
			$(".lede-image").eq(i).addClass("animated fadeIn");
			$(".text-3-ed").eq(i).addClass("animated fadeInDown");
			$(".text-2-ed").eq(i).addClass("animated fadeInDown");
			$(".text-1-ed").eq(i).addClass("animated fadeInDown");
			$(this).find(".lede-button").addClass("animated fadeInLeft");
		}
	});

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

/* Path column: a sport's details show when its icon is hovered or tapped, and stay until another's are */
(function () {
	var sports = document.querySelectorAll(".path-play > li");
	function pick(li) {
		if (!li.querySelector(".path-fig:not([hidden]), .path-medals, .path-loop, .path-map")) return;   // nothing to say about this one
		for (var i = 0; i < sports.length; i++) sports[i].classList.toggle("on", sports[i] === li);
	}
	for (var i = 0; i < sports.length; i++) {
		sports[i].addEventListener("mouseenter", function () { pick(this); });
		sports[i].addEventListener("click", function () { pick(this); });
	}
})();
