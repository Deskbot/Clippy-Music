var templates = (function() {

	function toTempl($e) {
		return $($e.html());
	}

	var $templates = $("#templates");

	var bucketContainerTemplate = toTempl($templates.children("#bucket-container-template"));
	var bucketItemTemplate = toTempl($templates.children("#bucket-item-template"));
	var dlBlockTemplate = toTempl($templates.children("#dl-block-template"));
	var dlQueueTemplate = toTempl($templates.children("#dl-queue-template"));
	var dlItemTemplate = toTempl($templates.children("#dl-item-template"));
	var linkToMusicTemplate = toTempl($templates.children("#link-to-music-template"));
	var linkToImageTemplate = toTempl($templates.children("#link-to-image-template"));
	var linkToVideoTemplate = toTempl($templates.children("#link-to-video-template"));

	return {
		makeBucketContainer: function() {
			return bucketContainerTemplate.clone();
		},
		makeBucketItem: function() {
			return bucketItemTemplate.clone();
		},
		makeDlBlock: function() {
			return dlBlockTemplate.clone();
		},
		makeDlItem: function() {
			return dlItemTemplate.clone();
		},
		makeDlQueue: function() {
			return dlQueueTemplate.clone();
		},
		makeMusicDownloadLink: function(name, id) {
			var anchor = linkToMusicTemplate.clone();
			anchor.html(name);
			anchor.attr("href", "/api/download/music?id=" + id);
			return anchor;
		},
		makeLinkToMusic: function(text, url) {
			var anchor = linkToMusicTemplate.clone();
			anchor.html(text);
			anchor.attr("href", url);
			return anchor;
		},
		makeOverlayDownloadLink: function(name, id) {
			var anchor = linkToImageTemplate.clone();
			anchor.attr("href", "/api/download/overlay?id=" + id);
			anchor.attr("title", name);
			return anchor;
		},
		makeLinkToImage: function(name, url) {
			var anchor = linkToImageTemplate.clone();
			anchor.attr("href", url);
			anchor.attr("title", name);
			return anchor;
		},
		makeLinkToVideo: function(name, url) {
			var anchor = linkToVideoTemplate.clone();
			anchor.attr("href", url);
			anchor.attr("title", name);
			return anchor;
		}
	};
})();