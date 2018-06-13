var templates = (function() {

	function toTempl($e) {
		return $($e.html());
	}

	var $templates = $('#templates');
	
	var bucketContainerTemplate = toTempl($templates.children('#bucket-container-template'));
	var bucketItemTemplate = toTempl($templates.children('#bucket-item-template'));
	var dlQueueTemplate = toTempl($templates.children('#dl-queue-template'));
	var dlItemTemplate = toTempl($templates.children('#dl-item-template'));

	return {
		makeBucketContainer: function() {
			return bucketContainerTemplate.clone();
		},
		makeBucketItem: function() {
			return bucketItemTemplate.clone();
		},
		makeDlQueue: function() {
			return dlQueueTemplate.clone();
		},
		makeDlItem: function() {
			return dlItemTemplate.clone();
		}
	};
})();