var templates = (function() {

	function toTempl($e) {
		return $($e.html());
	}

	var $templates = $('#templates');
	
	var bucketContainerTemplate = toTempl($templates.children('#bucket-container-template'));
	var bucketItemTemplate = toTempl($templates.children('#bucket-item-template'));

	return {
		makeBucketContainer: function() {
			return bucketContainerTemplate.clone();
		},
		makeBucketItem: function() {
			return bucketItemTemplate.clone();
		}
	};
})();