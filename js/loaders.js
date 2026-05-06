$(window).scroll(function (event) {

	var scroll = $(window).scrollTop();
	WorkFrameTopDistance = $('#work-frame').offset().top;
	distanceOfStaticBoxFromTop = (WorkFrameTopDistance - scroll);

	/* Hide Particle JS if out of viewport */
	if (scroll > window.innerHeight)
	{
		$('#particles-js').css("display","none");
	}
	else
	{
		$('#particles-js').css("display","initial");	
	}


	/* Fix and release from Top */

	if(distanceOfStaticBoxFromTop <= 50)
	{
		$('#dev-profile').css("position","fixed");
		$('#dev-profile').css("top","50px");
		$('#dev-profile').css("bottom","auto");
		$('#dev-profile').css("transform","translateX(1010px)");
	}

	else
	{
		$('#dev-profile').css("position","static");
		$('#dev-profile').css("top","auto");
		$('#dev-profile').css("right","auto");
		$('#dev-profile').css("transform","none");
	}

	/* Fix and release from Bottom */

	if ((WorkFrameTopDistance + $('#work-frame').height()) <= ($('#dev-profile').offset().top + $('#dev-profile').height()))
	{
		$('#dev-profile').css("position","absolute");
		$('#dev-profile').css("display","block");
		$('#dev-profile').css("bottom","0px");
		$('#dev-profile').css("top","auto");
		$('#dev-profile').css("right","none");
		$('#dev-profile').css("transform","translateX(1010px)");
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