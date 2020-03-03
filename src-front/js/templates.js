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
		makeDownloadMusicLink: function(text, id) {
			var anchor = linkToMusicTemplate.clone();
			anchor.html(text);
			anchor.attr("href", "/api/download/music?id=" + id);
			return anchor;
		},
		makeLinkToMusic: function(text, url) {
			var anchor = linkToMusicTemplate.clone();
			anchor.html(text);
			anchor.attr("href", url);
			return anchor;
		}
	};
})();