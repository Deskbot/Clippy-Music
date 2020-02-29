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
	var linkToContentTemplate = toTempl($templates.children("#link-to-content-template"));

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
		makeDownloadLink: function(text, id) {
			var anchor = linkToContentTemplate.clone();
			anchor.html(text);
			anchor.attr("href", "/api/download/" + id);
			return anchor;
		},
		makeLinkToContent: function(text, url) {
			var anchor = linkToContentTemplate.clone();
			anchor.html(text);
			anchor.attr("href", url);
			return anchor;
		}
	};
})();