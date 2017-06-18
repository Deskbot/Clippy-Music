Handlers = {};

Handlers.set = function() {
	$('#upload-form').submit(function() {
		return true;
		console.log("Handling upload form.");

		var $this = $(this);
		
		//validate before submit
		var itemTitle;
		var musicUrl = $this.find('[name=music-url]').val();
		var musicFiles = $this.find('[name=music-file]')[0].files;

		if (musicUrl && !isYouTubeUrl(musicUrl)) {
			clippyAgent.speak('Music URL given is not a YouTube link.');
			return false;
		} else {
			itemTitle = musicUrl;
		}

		if (!musicFiles || musicFiles.length === 0) {
			clippyAgent.speak('No music chosen for upload.'); //assumes check for url has happened
			return false;

		} else {
			itemTitle = musicFiles[0].name;
		}

		var promise = submitForm($this);

		promise.done(function(d, status, xhr) {
			console.log(d, status, xhr);

			clippyAgent.speak('Your item (\n' + stringWrap(itemTitle, 8, '\n') + ') has been added to the download queue.');
			
		}).fail(function(d, status, xhr){
			console.log(d, status, xhr);
		});

		return false; //don't submit the form normally
	});
}
