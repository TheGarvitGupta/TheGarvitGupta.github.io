var navFlashTimeout;
function flashNav(idx) {
	if (navFlashTimeout) {
		clearTimeout(navFlashTimeout);
	}
	$(".nav-dot").removeClass("nav-flash");
	var $dot = $(".nav-dot:eq(" + idx + ")");
	$dot.addClass("nav-flash");
	navFlashTimeout = setTimeout(function () {
		$dot.removeClass("nav-flash");
		navFlashTimeout = null;
	}, 1500);
}

var particlesHidden = false;
$(window).scroll(function (event) {

	var scroll = $(window).scrollTop();

	/* Hide Particle JS if out of viewport.
	   Use visibility (not display) so the parent keeps its dimensions —
	   otherwise a window resize while hidden makes particles.js shrink
	   the canvas to 0x0 and it never recovers when shown again. */
	var shouldHide = scroll > window.innerHeight;
	if (shouldHide !== particlesHidden) {
		$('#particles-js').css("visibility", shouldHide ? "hidden" : "visible");
		particlesHidden = shouldHide;
	}

	/* Float lede up on sroll */
	if (($('.lede-parent').eq(0).offset().top - scroll - window.innerHeight) <= -300)
	{
		$('.lede-image').eq(0).addClass("animated fadeIn");
		$('.text-3-ed').eq(0).addClass("animated fadeInDown");
		$('.text-2-ed').eq(0).addClass("animated fadeInDown");
		$('.text-1-ed').eq(0).addClass("animated fadeInDown");
		$('.lede-button').eq(0).addClass("animated fadeInLeft");				
	}
	if (($('.lede-parent').eq(1).offset().top - scroll - window.innerHeight) <= -300)
	{
		$('.lede-image').eq(1).addClass("animated fadeIn");
		$('.text-3-ed').eq(1).addClass("animated fadeInDown");
		$('.text-2-ed').eq(1).addClass("animated fadeInDown");
		$('.text-1-ed').eq(1).addClass("animated fadeInDown");
		$('.lede-button').eq(1).addClass("animated fadeInLeft");				
	}
	if (($('.lede-parent').eq(2).offset().top - scroll - window.innerHeight) <= -300)
	{
		$('.lede-image').eq(2).addClass("animated fadeIn");
		$('.text-3-ed').eq(2).addClass("animated fadeInDown");
		$('.text-2-ed').eq(2).addClass("animated fadeInDown");
		$('.text-1-ed').eq(2).addClass("animated fadeInDown");
		$('.lede-button').eq(2).addClass("animated fadeInLeft");
	}
	if (($('.lede-parent').eq(3).offset().top - scroll - window.innerHeight) <= -300)
	{
		$('.lede-image').eq(3).addClass("animated fadeIn");
		$('.text-3-ed').eq(3).addClass("animated fadeInDown");
		$('.text-2-ed').eq(3).addClass("animated fadeInDown");
		$('.text-1-ed').eq(3).addClass("animated fadeInDown");
		$('.lede-button').eq(3).addClass("animated fadeInLeft");				
	}
	if (($('.lede-parent').eq(4).offset().top - scroll - window.innerHeight) <= -300)
	{
		$('.lede-image').eq(4).addClass("animated fadeIn");
		$('.text-3-ed').eq(4).addClass("animated fadeInDown");
		$('.text-2-ed').eq(4).addClass("animated fadeInDown");
		$('.text-1-ed').eq(4).addClass("animated fadeInDown");
		$('.lede-button').eq(4).addClass("animated fadeInLeft");				
	}

	/* Garvit Gupta image loader */
	if (($('.garvit-gupta').offset().top - scroll - window.innerHeight) <= -300)
	{
		$(".garvit-gupta").addClass("animated fadeIn");
	}

	/* Assign dot */

	if (page!=1)
	{
		if ($(window).scrollTop() + 1 < $('#aboutAnchor').offset().top)
		{
			$(".nav-dot:eq(0)").addClass("nav-dot-selected");
			$(".nav-dot:eq(1)").removeClass("nav-dot-selected");
			$(".nav-dot:eq(2)").removeClass("nav-dot-selected");
			$(".nav-dot:eq(3)").removeClass("nav-dot-selected");
			$(".nav-dot:eq(4)").removeClass("nav-dot-selected");
			flashNav(0);
			page = 1;
		}
	}

	if (page!=2)
	{
		if (($(window).scrollTop() + 1 >= $('#aboutAnchor').offset().top) && ($(window).scrollTop() < $('#lifeAnchor').offset().top))
		{
			$(".nav-dot:eq(1)").addClass("nav-dot-selected");
			$(".nav-dot:eq(0)").removeClass("nav-dot-selected");
			$(".nav-dot:eq(2)").removeClass("nav-dot-selected");
			$(".nav-dot:eq(3)").removeClass("nav-dot-selected");
			$(".nav-dot:eq(4)").removeClass("nav-dot-selected");
			flashNav(1);
			page = 2;
		}
	}

	if (page!=3)
	{
		if (($(window).scrollTop() + 1 >= $('#lifeAnchor').offset().top) && ($(window).scrollTop() < $('#workAnchor').offset().top))
		{
			$(".nav-dot:eq(2)").addClass("nav-dot-selected");
			$(".nav-dot:eq(0)").removeClass("nav-dot-selected");
			$(".nav-dot:eq(1)").removeClass("nav-dot-selected");
			$(".nav-dot:eq(3)").removeClass("nav-dot-selected");
			$(".nav-dot:eq(4)").removeClass("nav-dot-selected");
			flashNav(2);
			page = 3;
		}
	}

	if (page!=4)
	{
		if (($(window).scrollTop() + 1 >= $('#workAnchor').offset().top) && ($(window).scrollTop() < $('#contactAnchor').offset().top))
		{
			$(".nav-dot:eq(3)").addClass("nav-dot-selected");
			$(".nav-dot:eq(0)").removeClass("nav-dot-selected");
			$(".nav-dot:eq(1)").removeClass("nav-dot-selected");
			$(".nav-dot:eq(2)").removeClass("nav-dot-selected");
			$(".nav-dot:eq(4)").removeClass("nav-dot-selected");
			flashNav(3);
			page = 4;
		}
	}

	if (page!=5)
	{
		if ($(window).scrollTop() + 1 >= $('#contactAnchor').offset().top)
		{
			$(".nav-dot:eq(4)").addClass("nav-dot-selected");
			$(".nav-dot:eq(0)").removeClass("nav-dot-selected");
			$(".nav-dot:eq(1)").removeClass("nav-dot-selected");
			$(".nav-dot:eq(2)").removeClass("nav-dot-selected");
			$(".nav-dot:eq(3)").removeClass("nav-dot-selected");
			flashNav(4);
			page = 5;
		}
	}

	/* Load polygons */
	if (polygonLoaded == 0)
	{
		if (isElementInViewport($("#garvit-polymer")))
		{
			/* Low Poly */
			polygonLoaded = 1;
			setTimeout(
				function(){
					tmax_tl.staggerFromTo(polylion_shapes, polylion_duration, polylion_staggerFrom, polylion_staggerTo, polylion_stagger, 0);
				}, 450
			);

			/* Animate social icons */
			setTimeout(
				function(){
					$(".social-icon").eq(3).addClass("animated fadeInRight");
				}, 300
			);
			setTimeout(
				function(){
					$(".social-icon").eq(2).addClass("animated fadeInRight");
				}, 200
			);
			setTimeout(
				function(){
					$(".social-icon").eq(1).addClass("animated fadeInRight");
				}, 100
			);
			setTimeout(
				function(){
					$(".social-icon").eq(0).addClass("animated fadeInRight");
				}, 0
			);
		}
	}
});

/* Checks if an element is in viewport */
function isElementInViewport (el) {

	if (typeof jQuery === "function" && el instanceof jQuery) {
		el = el[0];
	}

	var rect = el.getBoundingClientRect();

	return (
		rect.top >= 0 &&
		rect.left >= 0 &&
		rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
		rect.right <= (window.innerWidth || document.documentElement.clientWidth)
	);
}

/* Smooth Scroll for Anchors */
$(function() {
  $('a[href*=#]:not([href=#])').click(function() {
    if (location.pathname.replace(/^\//,'') == this.pathname.replace(/^\//,'') && location.hostname == this.hostname) {
      var target = $(this.hash);
      target = target.length ? target : $('[name=' + this.hash.slice(1) +']');
      if (target.length) {
        $('html,body').animate({
          scrollTop: target.offset().top
        }, 750);
        return false;
      }
    }
  });
});