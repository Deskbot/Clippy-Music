var handlers = {
	set: function set() {
		$('#upload-form').submit(function(e) {
			e.preventDefault();

			var $this = $(this);
			
			//validate before submit

			var musicInputElem = $this.find('[name=music-file]')[0];
			var musicUrl = $this.find('[name=music-url]').val();

			//no music file
			if (!utils.inputHasFile(musicInputElem)) {
				if (musicUrl) { 
					if (!utils.isYouTubeUrl(musicUrl)) {
						main.clippyAgent.speak('Music URL given is not a YouTube link.');
						return false;
					}
				}
				//no music
				else {
					main.clippyAgent.speak('No music chosen for upload.');
					return false;
				}
			}
			
			//ajax upload

			var fd = new FormData(this);
			fd.append('ajax', true);

			$.ajax({
				url: '/api/content/upload',
				type: 'POST',
				data: fd,
				contentType: false,
				processData: false

			}).done(function(data, status, jqxhr) {
				console.log(data, status, jqxhr);
				main.clippyAgent.speak(data);

			}).fail(function(jqxhr, textStatus, err) {
				console.log(jqxhr, textStatus, err);
				main.clippyAgent.speak(jqxhr.responseText);
			});

			return false;

		});

		$('#nickname-form').submit(function(e) {
			e.preventDefault();

			main.clippyAgent.stop();
			main.clippyAgent.play('SendMail');

			var $this = $(this);

			//ajax upload

			$.ajax({
				url: '/api/nickname/set',
				type: 'POST',
				data: {
					ajax: true,
					nickname: $this.find('[name=nickname]').val()
				}

			}).done(function(data, status, jqxhr) {
				main.clippyAgent.stop();
				main.clippyAgent.play('Congratulate');
				main.clippyAgent.speak('Your nickname has been changed.');

			}).fail(function(jqxhr, textStatus, err) {
				console.log(jqxhr.responseText);
				main.clippyAgent.stop();
				main.clippyAgent.play('CheckingSomething');
				main.clippyAgent.speak('There was some kind of error with your nickname request. Check the console for details and tell the dev.');
			});

			return false;
		});
	}
}
