var $section = $('section');
var $uploadForm = $('#upload-form');

$section.draggable({
	handle: '.handle',
	start: function() {
		$(this).css('z-index', main.maxZ++);
	}
});


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

	//check start / end time
	var startTime = $this.find('[name=start-time]').val();
	var endTime = $this.find('[name=end-time]').val();
	var format = /^[0-9]+(:[0-9]+)?(:[0-9]+)?$/;

	if (startTime !== '' && !format.test(startTime) || endTime !== '' && !format.test(endTime)) {
		main.clippyAgent.stop();
		main.clippyAgent.speak('Bad format given for start or end time. It should satisfy the following regular expression: ' + format.toString());
		return false;
	}
	
	//ajax upload

	var fd = new FormData(this);
	fd.append('ajax', true);

	main.clippyAgent.stop();
	main.clippyAgent.play('Save');

	$.ajax({
		url: '/api/content/upload',
		type: 'POST',
		data: fd,
		contentType: false,
		processData: false

	}).done(function(data, status, jqxhr) {
		main.clippyAgent.stop();
		main.clippyAgent.speak('I am downloading your music. It should appear in the queue soon.');
		//main.clippyAgent.play('Save');

	}).fail(function(jqxhr, textStatus, err) {
		main.clippyAgent.stop();
		main.clippyAgent.speak(jqxhr.responseText);
		main.clippyAgent.play('GetArtsy');
	
	}).always(function() {
		$uploadForm.find('.file-name').text('No File Chosen');
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

$('#queue').on('click', '.bucket-container > .bucket button.delete', function(e) {
	console.log(this);
	var $this = $(this);

	$this.attr('disabled', true);

	main.clippyAgent.stop();
	main.clippyAgent.play('EmptyTrash');
	
	var contentName = $this.siblings('.title').text();

	//ajax

	$.ajax({
		url: '/api/content/remove',
		type: 'POST',
		data: {
			ajax: true,
			"content-id": $this.attr('data-id'),
		}
	}).done(function() {
		main.clippyAgent.speak(contentName + ' was deleted succesfully.');
		$this.parentsUntil('.bucket').first().remove();

	}).fail(function(jqXHR, textStatus, err) {
		if (jqXHR.status === 500) {
			main.clippyAgent.speak('You didn\'t queue "' + contentName + '", so you can\'t delete it.');
		} else {
			main.clippyAgent.speak(jqXHR.responseText);
		}

		$this.attr('disabled', false);
		
	});
});

$uploadForm.find('#music-file-input-button input[type=file]').change(function() {
	var $this = $(this);
	var fileName = 'C:\\My Music\\' + $this.val().replace('C:\\fakepath\\', '');
	$this.siblings('.file-name').text(fileName ? fileName : 'No File Chosen');
});

$uploadForm.find('#picture-file-input-button input[type=file]').change(function() {
	var $this = $(this);
	var fileName = 'C:\\My Pictures\\' + $this.val().replace('C:\\fakepath\\', '');
	$this.siblings('.file-name').text(fileName ? fileName : 'No File Chosen');
});

window.onbeforeunload = function() {
	main.clippyAgent.stop();
	main.clippyAgent.play('GoodBye');
};
