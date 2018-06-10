var utils = {
	displayNickname: function(name) {
		$('.my-nickname').text(name);
	},

	entitle: function(title) {
		return '"' + utils.htmlEntityDecode(title) + '"';
	},

	htmlEntityDecode: function(str) {
		return $('<div/>').html(str).text()
	},

	inputHasFile: function(dom) {
		dom = dom instanceof $ ? dom[0] : dom;
		return dom.files && dom.files.length > 0;
	},

	isYouTubeUrl: function(url) {
		return url.includes('youtube.com/watch')
			|| url.includes('youtu.be');
	},

	getUrlStart: function getUrlStart() {
		return window.location.protocol + '//' + window.location.hostname;
	}
};
