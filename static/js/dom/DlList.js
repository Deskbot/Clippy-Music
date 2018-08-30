var DlList = {
	contentToDlItemElem: function contentToDlItemElem(content) {
		var $dlItem = templates.makeDlItem();

		$dlItem.find('.title').html(content.title);
		$dlItem.find('.cancel').attr('data-cid', content.cid);
		if (content.percent) fillDlBar($dlItem.find('.dl-bar'), content.percent);
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

	renderDlList: function renderDlList(list) {
		var $dlQueueContainer = $('#dl-list-container');

		if (list.length === 0) {
			$dlQueueContainer.addClass('hidden');
			return;
		} else {
			$dlQueueContainer.removeClass('hidden');
		}

		var $dlQueue = $dlQueueContainer.find('.bucket');

		//replace old list from DOM
		$dlQueue.empty();

		//put items in the dlQueue
		for (let i = 0; i < list.length; i++) {
			$dlQueue.append(contentToDlItemElem(list[i]));
		}
	},

	showError: function showError(contentId) {

	}
}