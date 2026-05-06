function showResponse() {
	$("#response-parent").html('<div class="animated zoomInUp" id="message-received-parent"><div class="message-received-child">Awesome! Your message has been sent.</div></div>');
}

/* Intent Select */

$(".checkimage-app").click(function() {
	intentApp = intentApp ? 0 : 1;
	$(".checkimage-app").toggleClass("selected", intentApp === 1);
});

$(".checkimage-web").click(function() {
	intentWeb = intentWeb ? 0 : 1;
	$(".checkimage-web").toggleClass("selected", intentWeb === 1);
});

$(".checkimage-job").click(function() {
	intentJob = intentJob ? 0 : 1;
	$(".checkimage-job").toggleClass("selected", intentJob === 1);
});

$(".checkimage-feedback").click(function() {
	intentFeedback = intentFeedback ? 0 : 1;
	$(".checkimage-feedback").toggleClass("selected", intentFeedback === 1);
});

/* Send Button */

$(".submit-parent").click(function() {
	var name    = $('#contactName').val();
	var message = $('#contactMessage').val();

	var selected = [];
	if (intentApp)      selected.push("Mobile App");
	if (intentWeb)      selected.push("Website");
	if (intentJob)      selected.push("Work");
	if (intentFeedback) selected.push("Feedback");

	var body = "";
	if (selected.length) body += "Interested in: " + selected.join(", ") + "\n\n";
	if (message)         body += message;

	window.location.href = "mailto:hey@garvitgupta.com"
		+ "?subject=" + encodeURIComponent(name ? "Hey from " + name : "Hey")
		+ "&body="    + encodeURIComponent(body);
});
