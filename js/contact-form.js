function showResponse() {
	$("#response-parent").html('<div class="animated zoomInUp" id="message-received-parent"><div class="message-received-child">Awesome! Your message has been sent.</div></div>');
}

/* Send Button: the message goes into a new mail, ready to send */

$(".submit-parent").click(function() {
	window.location.href = "mailto:hey@garvitgupta.com"
		+ "?subject=" + encodeURIComponent("Hey")
		+ "&body="    + encodeURIComponent($('#contactMessage').val());
});
