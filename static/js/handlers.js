var handlers = {
	set: function set() {
		$('#upload-form').submit(function(e) {
			e.preventDefault();

			var $this = $(this);
			
			//validate before submit
			
			var musicTitle, musicFile, musicUrl, imageFile, imageUrl;

			var musicInputElem = $this.find('[name=music-file]')[0];
			musicUrl = $this.find('[name=music-url]').val();
			var imageInputElem = $this.find('[name=image-file]')[0];
			imageUrl = $this.find('[name=image-url]').val();

			//music
			//is by file
			if (utils.inputHasFile(musicInputElem)) {
				musicFile = musicInputElem.files[0];
				musicTitle = musicFile.name;
			}
			//no file
			else if (musicUrl) { 
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

			//image
			//is by file
			if (utils.inputHasFile(imageInputElem)) {
				imageFile = imageInputElem.files[0];
			}

			//ajax upload

			var fd = new FormData(this);

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
	},
}
