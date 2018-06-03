var $banUserFields = $('#ban-form').add('#un-ban-form');
var $fileInput = $('input[type=file]');
var $section = $('section');
var $uploadForm = $('#upload-form');

$('html').mouseup(function() {
	$('.active').removeClass('active');
});

$section.draggable({
	handle: '.handle',
	start: function() {
		$(this).css('z-index', main.maxZ++);
	},
	end: function() {
		positionSections();
	}
});

$section.click(function() {
	$(this).css('z-index', main.maxZ++);
});

$section.find('.handle > .x-button').click(function(e) {
	positionSections();
	$(this).parentsUntil('main').remove();
});

$uploadForm.find('[name=music-file]').change(function(e) {
	var $musicUrl = $uploadForm.find('[name=music-url]');

	if (utils.inputHasFile(this)) $musicUrl.attr('disabled', true);
	else                          $musicUrl.attr('disabled', false);
});

$uploadForm.find('[name=image-file]').change(function(e) {
	var $musicUrl = $uploadForm.find('[name=image-url]');

	if (utils.inputHasFile(this)) $musicUrl.attr('disabled', true);
	else                          $musicUrl.attr('disabled', false);
});

$uploadForm.find('#music-file-input-button input[type=file]').change(function() {
	var $this = $(this);

	var title = $this.val().replace('C:\\fakepath\\', '');
	var fileName = title === '' ? 'No File Chosen' : 'C:\\My Music\\' + title;
	$this.siblings('.file-name').text(fileName ? fileName : 'No File Chosen');
});

$uploadForm.find('#picture-file-input-button input[type=file]').change(function() {
	var $this = $(this);

	var title = $this.val().replace('C:\\fakepath\\', '');
	var fileName = title === '' ? 'No File Chosen' : 'C:\\My Pictures\\' + title;
	$this.siblings('.file-name').text(fileName ? fileName : 'No File Chosen');
});

$uploadForm.submit(function(e) {
	e.preventDefault();

	var $this = $(this);
	var $inputs = $this.find('input');
	var $fields = $inputs.filter(':not([type=submit])');
	
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
		url: '/api/queue/add',
		type: 'POST',
		data: fd,
		contentType: false,
		processData: false

	}).done(function(data, status, jqxhr) {
		main.clippyAgent.stop();
		main.clippyAgent.speak('I am downloading your music. It should appear in the queue soon.');

	}).fail(function(jqxhr, textStatus, err) {
		main.clippyAgent.stop();
		main.clippyAgent.speak(jqxhr.responseText);
		main.clippyAgent.play('GetArtsy');
	
	}).always(function() {
		$uploadForm.find('.file-name').text('No File Chosen');
		$fields.val(null);
		$inputs.attr('disabled', false);
		$('html').removeClass('progress');
	});

	$inputs.attr('disabled', true);
	$('html').addClass('progress');

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

$fileInput.mousedown(function() {
	$(this).siblings('button.file').addClass('active').focus();
});

$fileInput.focus(function() {
	$(this).siblings('button.file').focus();
});

$('#queue').on('click', '.bucket-container .bucket button.delete', function(e) {
	var $this = $(this);

	$this.attr('disabled', true);

	main.clippyAgent.stop();
	main.clippyAgent.play('EmptyTrash');
	
	var contentName = $this.siblings('.title').text();

	//ajax

	$.ajax({
		url: '/api/queue/remove',
		type: 'POST',
		data: {
			ajax: true,
			'content-id': $this.attr('data-id'),
		}

	}).done(function() {
		main.clippyAgent.speak(utils.entitle(contentName) + ' was deleted succesfully.');

		var $buttonAncestors = $this.parentsUntil('.bucket');
		var $bucket = $buttonAncestors.first().parent();

		$buttonAncestors.first().remove();

		if ($bucket.children().length === 0) $bucket.parentsUntil('.bucket-container').parent().remove();

	}).fail(function(jqXHR, textStatus, err) {
		if (jqXHR.status === 500) {
			main.clippyAgent.speak('You didn\'t queue ' + utils.entitle(contentName) + ', so you can\'t delete it.');
		} else {
			main.clippyAgent.speak(jqXHR.responseText);
		}

		$this.attr('disabled', false);
	});
});

var $currentlyPlaying = $('#currently-playing');

$currentlyPlaying.on('dblclick', '.wordart', function() {
	$(this).removeClass('wordart').addClass('no-wordart');
});

$currentlyPlaying.on('dblclick', '.no-wordart', function() {
	$(this).removeClass('no-wordart').addClass('wordart');
});

$('#skip-button').click(function() {
	$.ajax({
		url: '/api/skip',
		type: 'POST',
		data: {
			ajax: true,
			password: $('#admin-password-input').val()
		}

	}).done(function() {
		main.clippyAgent.play('Congratulate');

	}).fail(function(jqXHR, textStatus, err) {
		main.clippyAgent.speak(jqXHR.responseText);
	});
});

$('#skip-penalise-button').click(function() {
	$.ajax({
		url: '/api/skipAndPenalise',
		type: 'POST',
		data: {
			ajax: true,
			password: $('#admin-password-input').val()
		}

	}).done(function() {
		main.clippyAgent.play('Congratulate');

	}).fail(function(jqXHR, textStatus, err) {
		main.clippyAgent.speak(jqXHR.responseText);
	});
});

$('#skip-ban-button').click(function() {
	$.ajax({
		url: '/api/skipAndBan',
		type: 'POST',
		data: {
			ajax: true,
			password: $('#admin-password-input').val()
		}

	}).done(function() {
		main.clippyAgent.play('Congratulate');

	}).fail(function(jqXHR, textStatus, err) {
		main.clippyAgent.speak(jqXHR.responseText);
	});
});

$('#ban-form').submit(function(e) {
	e.preventDefault();

	var $this = $(this);

	var id = $this.find('input[name=id]').val();
	var nickname = $this.find('input[name=nickname]').val();

	$.ajax({
		url: '/api/ban/add',
		type: 'POST',
		data: {
			ajax: true,
			id: id,
			password: $('#admin-password-input').val(),
			nickname: nickname
		}

	}).done(function() {
		$this.find('input').attr('disabled', false);
		$this.find('input[type=text]').val(null);
		main.clippyAgent.play('Congratulate');

		var bannedName = id == '' ? nickname : id;
		main.clippyAgent.speak(bannedName + ' is now banned.');

	}).fail(function(jqXHR, textStatus, err) {
		main.clippyAgent.speak(jqXHR.responseText);
	});
});

$('#un-ban-form').submit(function(e) {
	e.preventDefault();

	var $this = $(this);

	var id = $this.find('input[name=id]').val();
	var nickname = $this.find('input[name=nickname]').val();

	$.ajax({
		url: '/api/ban/remove',
		type: 'POST',
		data: {
			ajax: true,
			id: id,
			password: $('#admin-password-input').val(),
			nickname: nickname
		}

	}).done(function() {
		$this.find('input').attr('disabled', false);
		$this.find('input[type=text]').val(null);
		main.clippyAgent.play('Congratulate');

		var bannedName = id == '' ? nickname : id;
		main.clippyAgent.speak(bannedName + ' is no longer banned.');

	}).fail(function(jqXHR, textStatus, err) {
		main.clippyAgent.speak(jqXHR.responseText);
	});
});

$banUserFields.find('[name=id]').keyup(function() {
	var $this = $(this);
	var $pairedField = $this.siblings('[name=nickname]');
	if ($this.val() != '') {
		$pairedField.attr('disabled', true);
	} else {
		$pairedField.attr('disabled', false);
	}
});

$banUserFields.find('[name=nickname]').keyup(function() {
	var $this = $(this);
	var $pairedField = $this.siblings('[name=id]');
	if ($this.val() != '') {
		$pairedField.attr('disabled', true);
	} else {
		$pairedField.attr('disabled', false);
	}
});

$('button').click(function(e) {
	e.preventDefault();
});

window.onbeforeunload = function() {
	main.clippyAgent.stop();
	main.clippyAgent.play('GoodBye');
};
