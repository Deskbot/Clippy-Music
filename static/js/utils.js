var utils = {
	inputHasFile: function(dom) {
		dom = dom instanceof $ ? dom[0] : dom;
		return dom.files && dom.files.length > 0;
	},

	isYouTubeUrl: function isYouTubeUrl(url) {
		return url.includes('youtube.com/watch')
			|| url.includes('youtu.be');
	},

	getUrlStart: function getUrlStart() {
		return window.location.protocol + '//' + window.location.hostname;
	}
};
