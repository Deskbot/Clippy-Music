var DlList = (function() {
	var $dlListContainer = $('#dl-list-container');
	var $dlQueueBucket = $dlListContainer.children('.bucket');

	var DlList = {
		add: function add(content) {
			$dlQueueBucket.append(this.contentToDlItemElem(content));
		},

		contentToDlItemElem: function contentToDlItemElem(content) {
			var $dlItem = templates.makeDlItem();

			$dlItem.find('.title').html(content.title);
			$dlItem.attr('data-cid', content.cid);
			if (content.percent) this.fillDlBar($dlItem.find('.dl-bar'), content.percent);
			if (content.error) $dlItem.addClass('error');

			return $dlItem;
		},

		fillDlBar: function fillDlBar($bar, percent) {
			var fullWidth = 444; //based on css; can't evaluate at run time due to width being unknown if $bar is not in DOM
			var blockWidth = 10; //based on css; they're all the same width
			var blockPercent = blockWidth / fullWidth;
			var blocksAlready = $bar.find('.dl-block').length;
			
			var targetBlockCount = Math.ceil(percent / blockPercent);

			for (var i = blocksAlready; i < targetBlockCount; i++) {
				$bar.append(templates.makeDlBlock());
			}
		},

		findDlItemElem: function findDlItemElem(contentId) {
			return $dlQueueBucket.find('[data-cid=' + contentId + ']');
		},

		hideContainer: function showContainer() {
			$dlListContainer.addClass('hidden')
		},

		remove: function remove(contentId) {
			this.findDlItemElem(contentId).remove();
		},

		renderDlList: function renderDlList(list) {
			if (list.length !== 0) {
				$dlQueueBucket.removeClass('hidden');
			} else {
				$dlQueueBucket.addClass('hidden');
			}

			var $dlQueue = $dlQueueBucket.find('.bucket');

			//replace old list from DOM
			$dlQueue.empty();

			//put items in the dlQueue
			for (let i = 0; i < list.length; i++) {
				$dlQueue.append(this.contentToDlItemElem(list[i]));
			}
		},

		showContainer: function showContainer() {
			$dlListContainer.removeClass('hidden')
		},

		showError: function showError(contentId) {
			this.findDlItemElem(contentId).addClass('error');
		}
	};

	return DlList;
})();