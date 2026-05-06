$(window).on("load", function () {
	$(".cover").css("opacity", "0");
	$(".name").css("text-shadow", "5px 5px 25px rgba(0,0,0,0.35)");

	[500, 700, 900, 1100, 1300].forEach(function (delay, i) {
		setTimeout(function () {
			$(".nav-dot").eq(i).addClass("animated fadeInRight");
		}, delay);
	});

	setTimeout(function () {
		$(".cover").css("display", "none");
		$(".down-arrow").css("cursor", "pointer");
		$(".down-button").css("cursor", "pointer");
	}, 1500);
});

/* prefetch blue icon variants */
["app", "job", "mail", "web"].forEach(function (name) {
	var img = new Image(48, 50);
	img.src = "images/icons/contact/" + name + "-blue.png";
});
