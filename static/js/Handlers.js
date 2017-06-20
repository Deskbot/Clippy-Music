const Handlers = {
	set: function set() {
		$('#upload-form').submit(function() {
			console.log("Handling upload form.");

			var $this = $(this);
			
			//validate before submit
			var itemTitle;
			var musicUrl = $this.find('[name=music-url]').val();
			var musicFiles = $this.find('[name=music-file]')[0].files;

			if (musicUrl && !isYouTubeUrl(musicUrl)) {
				clippyAgent.speak('Music URL given is not a YouTube link.');
				return false;
			}

			if (!musicFiles || musicFiles.length === 0) {
				clippyAgent.speak('No music chosen for upload.'); //assumes check for url has happened
				return false;

			}
		});
	},
}
