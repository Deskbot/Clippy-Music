var $uploadForm = $('#upload-form');

$uploadForm.find('[name=music-file]').change(function(e) {
	var $this = $(this);

	var $musicUrl = $uploadForm.find('[name=music-url]');

	if (utils.inputHasFile(this)) $musicUrl.attr('disabled', true);
	else                          $musicUrl.attr('disabled', false);
});

$uploadForm.find('[name=image-file]').change(function(e) {
	var $this = $(this);
	var $musicUrl = $uploadForm.find('[name=image-url]');

	if (utils.inputHasFile(this)) $musicUrl.attr('disabled', true);
	else                          $musicUrl.attr('disabled', false);
});

$uploadForm.submit(function(e) {
	e.preventDefault();

	var $this = $(this);
	var $inputs = $this.find('input:not([type=submit])')
	
	//validate before submit

	var musicInputElem = $this.find('[name=music-file]')[0];
	var musicUrl = $this.find('[name=music-url]').val();

	//no music file
	if (!utils.inputHasFile(musicInputElem)) {
		if (musicUrl) { 
			if (!utils.isYouTubeUrl(musicUrl)) {
				main.clippyAgent.stop();
				main.clippyAgent.speak('Music URL given is not a YouTube link.');
				main.clippyAgent.play('CheckingSomething');
				return false;
			}
		}
		//no music
		else {
			main.clippyAgent.stop();
			main.clippyAgent.speak('No music chosen for upload.');
			main.clippyAgent.play('Searching');
			return false;
		}
	}
	
	//ajax upload

	var fd = new FormData(this);
	fd.append('ajax', true);

	main.clippyAgent.stop();
	main.clippyAgent.play('SendMail');

	$.ajax({
		url: '/api/content/upload',
		type: 'POST',
		data: fd,
		contentType: false,
		processData: false

	}).done(function(data, status, jqxhr) {
		main.clippyAgent.stop();
		main.clippyAgent.speak('Your music has been queued for download. Unless there\'s a problem it will appear in the play queue soon.');
		main.clippyAgent.play('Save');

	}).fail(function(jqxhr, textStatus, err) {
		main.clippyAgent.stop();
		main.clippyAgent.speak(jqxhr.responseText);
		main.clippyAgent.play('GetArtsy');
	
	}).always(function() {
		$inputs.val(null);
		$inputs.attr('disabled', false);
	});

	$inputs.attr('disabled', true);

	return false;

});

$('#nickname-form').submit(function(e) {
	e.preventDefault();

	var $this = $(this);
	var $nicknameField = $this.find('[name=nickname]');
	$nicknameField.attr('disabled', true);

	main.clippyAgent.stop();
	main.clippyAgent.play('SendMail');

	//ajax upload

	$.ajax({
		url: '/api/nickname/set',
		type: 'POST',
		data: {
			ajax: true,
			nickname: $nicknameField.val()
		}

	}).done(function(data, status, jqxhr) {
		utils.displayNickname($nicknameField.val());
		main.clippyAgent.stop();
		main.clippyAgent.play('Congratulate');
		main.clippyAgent.speak('Your nickname has been changed.');

	}).fail(function(jqxhr, textStatus, err) {
		console.log(jqxhr.responseText);
		main.clippyAgent.stop();
		main.clippyAgent.play('CheckingSomething');
		main.clippyAgent.speak('There was some kind of error with your nickname request. Check the console for details and tell the dev.');
	
	}).always(function() {
		$nicknameField.val('').attr('disabled', false);
	});

	return false;
});

window.onbeforeunload = function() {
	main.clippyAgent.stop();
	main.clippyAgent.play('GoodBye');
};
