function showResponse() {     
	$("#response-parent").html('<div class="animated zoomInUp" id="message-received-parent"><div class="message-received-child">Awesome! Your message has been sent.</div></div>');
}

/* Intent Select */

$(".checkimage-app" ).click(function toggleApp() {

	if (intentApp == 0)
	{
		intentApp = 1;
		$(".checkimage-app" ).css("background-color","#E1F5FE");
		$(".checkimage-app" ).css("border-color","#2196F3");
	}
	else
	{
		intentApp = 0;
		$(".checkimage-app" ).css("background-color","#ffffff");
		$(".checkimage-app" ).css("border-color","#000000");
	}

});

$(".checkimage-web" ).click(function toggleApp() {

	if (intentWeb == 0)
	{
		intentWeb = 1;
		$(".checkimage-web" ).css("background-color","#E1F5FE");
		$(".checkimage-web" ).css("border-color","#2196F3");
	}
	else
	{
		intentWeb = 0;
		$(".checkimage-web" ).css("background-color","#ffffff");
		$(".checkimage-web" ).css("border-color","#000000");
	}

});

$(".checkimage-job" ).click(function toggleApp() {

	if (intentJob == 0)
	{
		intentJob = 1;
		$(".checkimage-job" ).css("background-color","#E1F5FE");
		$(".checkimage-job" ).css("border-color","#2196F3");
	}
	else
	{
		intentJob = 0;
		$(".checkimage-job" ).css("background-color","#ffffff");
		$(".checkimage-job" ).css("border-color","#000000");
	}

});

$(".checkimage-feedback" ).click(function toggleApp() {

	if (intentFeedback == 0)
	{
		intentFeedback = 1;
		$(".checkimage-feedback" ).css("background-color","#E1F5FE");
		$(".checkimage-feedback" ).css("border-color","#2196F3");
	}
	else
	{
		intentFeedback = 0;
		$(".checkimage-feedback" ).css("background-color","#ffffff");
		$(".checkimage-feedback" ).css("border-color","#000000");
	}

});

/* Send Button */

$(".submit-parent").click(function() {
	var name    = $('#contactName').val();
	var message = $('#contactMessage').val();
	var subject = encodeURIComponent(name ? "Hey from " + name : "Hey");
	var body    = encodeURIComponent(message || "");
	window.location.href = "mailto:garvitgupta@icloud.com?subject=" + subject + "&body=" + body;
});