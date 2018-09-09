var $adminPasswordInput = $('#admin-password-input');
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
		var $this = $(this);
		$this.css('z-index', main.maxZ++);
		$this.attr('data-moved', true);
	}
});

$section.click(function() {
	$(this).css('z-index', main.maxZ++);
});

$section.find('.handle > .x-button').click(function(e) {
	var $window = $(this).parentsUntil('main').last();

	//offset is caused by both height and margins
	var distance = fullHeight($window);
	
	shiftDownElemsBelow($window, distance);

	$window.remove();
});

$uploadForm.find('input[name=music-file]').change(function(e) {
	var $musicUrl = $uploadForm.find('[name=music-url]');

	if (utils.inputHasFile(this)) $musicUrl.attr('disabled', true);
	else                          $musicUrl.attr('disabled', false);

	var $this = $(this);

	var title = $this.val().replace('C:\\fakepath\\', '');
	var fileName = title === '' ? 'No File Chosen' : 'C:\\My Music\\' + title;
	$this.siblings('.file-name').text(fileName ? fileName : 'No File Chosen');
});

$uploadForm.find('input[name=image-file]').change(function(e) {
	var $musicUrl = $uploadForm.find('[name=image-url]');

	if (utils.inputHasFile(this)) $musicUrl.attr('disabled', true);
	else                          $musicUrl.attr('disabled', false);

	var $this = $(this);

	var title = $this.val().replace('C:\\fakepath\\', '');
	var fileName = title === '' ? 'No File Chosen' : 'C:\\My Pictures\\' + title;
	$this.siblings('.file-name').text(fileName ? fileName : 'No File Chosen');
});

$uploadForm.find('input[type=url]').keyup(function(e) {
	var $this = $(this);
	var $disabledTargets = $this.siblings('.file-upload').find('input, button');

	if ($this.val().length === 0) {
		$disabledTargets.attr('disabled', false);
	} else {
		$disabledTargets.attr('disabled', true);
	}
});

$uploadForm.submit(function(e) {
	e.preventDefault();

	var $this = $(this);
	var $buttons = $this.find('button');
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

		if (jqxhr.status >= 500 && jqxhr.status < 600) {
			main.clippyAgent.speak('The server encountered an error trying to queue your media. Check the console and contact the developer.');
			console.error(jqxhr.responseText);
		} else {
			main.clippyAgent.speak(jqxhr.responseText);
		}

		main.clippyAgent.play('GetArtsy');
	
	}).always(function() {
		$uploadForm.find('.file-name').text('No File Chosen');
		$fields.val(null);
		$buttons.attr('disabled', false);
		$inputs.attr('disabled', false);
		$('html').removeClass('progress');
	});

	$buttons.attr('disabled', true);
	$inputs.attr('disabled', true);
	$('html').addClass('progress');

	return false;
});

$uploadForm.find('input[type=url]').keypress(function(e) {
	if (e.keyCode == 13) {
		$uploadForm.submit();
	}
});

$('#nickname-form').submit(function(e) {
	e.preventDefault();

	var $this = $(this);
	var $nicknameField = $this.find('[name=nickname]');

	//no empty nicknames
	if ($nicknameField.val().length === 0) {
		main.clippyAgent.stop();
		main.clippyAgent.speak('Your nickname can not be an empty string.');
		main.clippyAgent.play('CheckingSomething');
		return;
	}

	var $submitButton = $this.find('[input=submit]');
	$nicknameField.attr('disabled', true);
	$submitButton.attr('disabled', true);

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
		main.clippyAgent.stop();

		if (jqxhr.status >= 500 && jqxhr.status < 600) {
			main.clippyAgent.speak('The server encountered an error trying to change your nickname. Check the console and contact the developer.');
			console.error(jqxhr.responseText);
		} else {
			main.clippyAgent.speak(jqxhr.responseText);
		}

		main.clippyAgent.play('CheckingSomething');
	
	}).always(function() {
		$nicknameField.val('').attr('disabled', false);
		$submitButton.attr('disabled', false);
	});

	return false;
});

$('button.file').click(function(e) {
	var $this = $(this);
	$this.siblings('[type=file]').click();
});

$fileInput.mousedown(function() {
	$(this).siblings('button.file').addClass('active').focus();
});

$fileInput.focus(function() {
	$(this).siblings('button.file').focus();
});

var $dlListContainer = $('#dl-list-container');
$dlListContainer.on('click', 'button.dismiss', function(e) {
	var $this = $(this);
	var $li = $this.parent();

	var contentId = $li.attr('data-cid');
	main.dlMap.remove(contentId);
	
	if (main.dlMap.size() == 0) {
		$dlListContainer.addClass('hidden');
	}

	$li.remove();
});

$('#queue').on('click', '.bucket-container .bucket button.delete', function(e) {
	var $this = $(this);

	$this.attr('disabled', true);

	main.clippyAgent.stop();
	main.clippyAgent.play('EmptyTrash');
	
	var contentName = $this.siblings('.title').text();

	$.ajax({
		url: '/api/queue/remove',
		type: 'POST',
		data: {
			ajax: true,
			'content-id': $this.attr('data-id'),
		}

	}).done(function() {
		var $queueSection = $('#queue-section');

		utils.counterShiftResize($queueSection, function() {
			main.clippyAgent.speak(utils.entitle(contentName) + ' was deleted succesfully.');

			var $buttonAncestors = $this.parentsUntil('.bucket');
			var $bucket = $buttonAncestors.first().parent();

			$buttonAncestors.first().remove(); //remove li

			//remove bucket container for user if the bucket list contains nothing
			if ($bucket.children().length === 0) $bucket.parent().remove();
		});

	}).fail(function(jqxhr, textStatus, err) {
		if (jqxhr.status >= 500 && jqxhr.status < 600) {
			main.clippyAgent.speak('The server encountered an error trying to queue your media. Check the console and contact the developer.');
			console.error(jqxhr.responseText);
			return;
		}

		if (jqxhr.responseText === 'OwnershipError') {
			main.clippyAgent.speak('You didn\'t queue ' + utils.entitle(contentName) + ', so you can\'t delete it.');
		} else {
			main.clippyAgent.speak(jqxhr.responseText);
		}

		$this.attr('disabled', false);
	});
});

$('#queue').on('click', '#dl-list-container .bucket button.cancel', function(e) {
	var $this = $(this);

	$this.attr('disabled', true);

	main.clippyAgent.stop();
	main.clippyAgent.play('EmptyTrash');
	
	var contentName = $this.siblings('.title').text();

	$.ajax({
		url: '/api/download/cancel',
		type: 'POST',
		data: {
			ajax: true,
			'dl-index': $this.attr('data-index'),
		}

	}).done(function() {
		var $queueSection = $('#queue-section');

		utils.counterShiftResize($queueSection, function() {
			main.clippyAgent.speak('The download of ' + utils.entitle(contentName) + ' was cancelled.');

			var $buttonAncestors = $this.parentsUntil('.bucket');
			var $bucket = $buttonAncestors.first().parent();

			$buttonAncestors.first().remove(); //remove li

			var $personalQueue = $bucket.parentsUntil('.bucket-container').parent();

			//remove download queue if empty
			if ($bucket.children().length === 0) $('#dl-list-container').remove();

			//if the media queue is now empty, remove it
			if ($personalQueue.children().length === 0) $personalQueue.remove();
		});

	}).fail(function(jqxhr, textStatus, err) {
		if (jqxhr.status >= 500 && jqxhr.status < 600) {
			main.clippyAgent.speak('The server encountered an error trying to cancel that download. Check the console and contact the developer.');
			console.error(jqxhr.responseText);
			return;
		}

		main.clippyAgent.speak(jqxhr.responseText);

		$this.attr('disabled', false);
	});
});

var $currentlyPlaying = $('#currently-playing');

$currentlyPlaying.on('dblclick', '.wordart', function() {
	utils.counterShiftResize($('#current-section'), function() {
		$(this).removeClass('wordart').addClass('no-wordart');
	}.bind(this));
});

$currentlyPlaying.on('dblclick', '.no-wordart', function() {
	utils.counterShiftResize($('#current-section'), function() {
		$(this).removeClass('no-wordart').addClass('wordart');
	}.bind(this));
});

$('#skip-button').click(function() {
	var adminPassword = $adminPasswordInput.val();

	//no empty password
	if (!adminPassword) {
		main.clippyAgent.stop();
		main.clippyAgent.speak('You need to give the admin password.');
		main.clippyAgent.play('Searching');
		return;
	}

	$.ajax({
		url: '/api/skip',
		type: 'POST',
		data: {
			ajax: true,
			password: adminPassword
		}

	}).done(function() {
		main.clippyAgent.play('Congratulate');

	}).fail(function(jqxhr, textStatus, err) {
		main.clippyAgent.stop();

		if (jqxhr.status >= 500 && jqxhr.status < 600) {
			main.clippyAgent.speak('The server encountered an error trying to skip the current music. Check the console and contact the developer.');
			console.error(jqxhr.responseText);
		} else {
			main.clippyAgent.speak(jqxhr.responseText);
		}
	});
});

$('#skip-penalise-button').click(function(e) {
	var adminPassword = $('#admin-password-input').val();

	//no empty password
	if (adminPassword) {
		main.clippyAgent.stop();
		main.clippyAgent.speak('You need to give the admin password.');
		main.clippyAgent.play('Searching');
		return;
	}

	$.ajax({
		url: '/api/skipAndPenalise',
		type: 'POST',
		data: {
			ajax: true,
			password: adminPassword
		}

	}).done(function() {
		main.clippyAgent.play('Congratulate');

	}).fail(function(jqxhr, textStatus, err) {
		main.clippyAgent.stop();

		if (jqxhr.status >= 500 && jqxhr.status < 600) {
			main.clippyAgent.speak('The server encountered an error trying to skip the current music. Check the console and contact the developer.');
			console.error(jqxhr.responseText);
		} else {
			main.clippyAgent.speak(jqxhr.responseText);
		}
	});
});

$('#skip-ban-button').click(function() {
	var adminPassword = $adminPasswordInput.val();

	//no empty password
	if (!adminPassword) {
		main.clippyAgent.stop();
		main.clippyAgent.speak('You need to give the admin password.');
		main.clippyAgent.play('Searching');
		return;
	}

	$.ajax({
		url: '/api/skipAndBan',
		type: 'POST',
		data: {
			ajax: true,
			password: adminPassword
		}

	}).done(function() {
		main.clippyAgent.play('Congratulate');

	}).fail(function(jqxhr, textStatus, err) {
		main.clippyAgent.stop();

		if (jqxhr.status >= 500 && jqxhr.status < 600) {
			main.clippyAgent.speak('The server encountered an error trying to skip the current music. Check the console and contact the developer.');
			console.error(jqxhr.responseText);
		} else {
			main.clippyAgent.speak(jqxhr.responseText);
		}
	});
});

$('#ban-form').submit(function(e) {
	e.preventDefault();

	var adminPassword = $adminPasswordInput.val();

	//no empty password
	if (!adminPassword) {
		main.clippyAgent.stop();
		main.clippyAgent.speak('You need to give the admin password.');
		main.clippyAgent.play('Searching');
		return;
	}

	var $this = $(this);

	var id = $this.find('input[name=id]').val();
	var nickname = $this.find('input[name=nickname]').val();

	$.ajax({
		url: '/api/ban/add',
		type: 'POST',
		data: {
			ajax: true,
			id: id,
			password: adminPassword,
			nickname: nickname
		}

	}).done(function() {
		$this.find('input').attr('disabled', false);
		$this.find('input[type=text]').val(null);
		main.clippyAgent.play('Congratulate');

		var bannedName = id == '' ? nickname : id;
		main.clippyAgent.speak(bannedName + ' is now banned.');

	}).fail(function(jqxhr, textStatus, err) {
		main.clippyAgent.stop();

		if (jqxhr.status >= 500 && jqxhr.status < 600) {
			main.clippyAgent.speak('The server encountered an error trying to ban ' + bannedName + '. Check the console and contact the developer.');
			console.error(jqxhr.responseText);
		} else {
			main.clippyAgent.speak(jqxhr.responseText);
		}
	});
});

$('#un-ban-form').submit(function(e) {
	e.preventDefault();

	var adminPassword = $adminPasswordInput.val();

	//no empty password
	if (!adminPassword) {
		main.clippyAgent.stop();
		main.clippyAgent.speak('You need to give the admin password.');
		main.clippyAgent.play('Searching');
		return;
	}

	var $this = $(this);

	var id = $this.find('input[name=id]').val();
	var nickname = $this.find('input[name=nickname]').val();

	$.ajax({
		url: '/api/ban/remove',
		type: 'POST',
		data: {
			ajax: true,
			id: id,
			password: adminPassword,
			nickname: nickname
		}

	}).done(function() {
		$this.find('input').attr('disabled', false);
		$this.find('input[type=text]').val(null);
		main.clippyAgent.play('Congratulate');

		var bannedName = id == '' ? nickname : id;
		main.clippyAgent.speak(bannedName + ' is no longer banned.');

	}).fail(function(jqxhr, textStatus, err) {
		main.clippyAgent.stop();

		if (jqxhr.status >= 500 && jqxhr.status < 600) {
			main.clippyAgent.speak('The server encountered an error trying to un-ban ' + bannedName + '. Check the console and contact the developer.');
			console.error(jqxhr.responseText);
		} else {
			main.clippyAgent.speak(jqxhr.responseText);
		}
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
