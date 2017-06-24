var templates = (function() {

	function toTempl($e) {
		return $($e.html());
	}

	var $templates = $('#templates');

	var currentItemTemplate = toTempl($templates.children('#current-item-template'));
	var bucketContainerTemplate = toTempl($templates.children('#bucket-container-template'));
	var bucketItemTemplate = toTempl($templates.children('#bucket-item-template'));

	return {
		makeCurrentItem: function() {
			return currentItemTemplate.clone();
		},

		makeBucketContainer: function() {
			return bucketContainerTemplate.clone();
		},
		makeBucketItem: function() {
			return bucketItemTemplate.clone();
		}
	};
})();