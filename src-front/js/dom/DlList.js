var DlList = (function() {
	var $dlListContainer = $("#dl-list-container");
	var $dlQueueBucket = $dlListContainer.children(".bucket");

	var fullWidth = 444; //based on css; can't evaluate at run time due to width being unknown if $bar is not in DOM
	var blockWidth = 10; //based on css; they're all the same width
	var blockPercent = blockWidth / fullWidth;
	var maxBlocks = Math.ceil(fullWidth / blockWidth);

	var DlList = {
		$sectionWithin: $("#upload-section"),

		add: function add(content) {
			$dlQueueBucket.append(this.contentToDlItemElem(content));
		},

		contentToDlItemElem: function contentToDlItemElem(content) {
			var $dlItem = templates.makeDlItem();

			$dlItem.find(".title").html(content.title);
			$dlItem.attr("data-cid", content.contentId);
			if (content.cancellable) $dlItem.find(".cancel").removeClass("hidden");
			if (content.percent) this.fillDlBar($dlItem.find(".dl-bar"), content.percent);
			if (content.error) this.showError($dlItem);

			return $dlItem;
		},

		fillDlBar: function fillDlBar($bar, percent) {
			var blocksAlready = $bar.find(".dl-block").length;
			var targetBlockCount = Math.floor(percent / blockPercent);

			for (var i = blocksAlready; i < targetBlockCount; i++) {
				$bar.append(templates.makeDlBlock());
			}
		},

		findDlItemElem: function findDlItemElem(contentId) {
			return $dlQueueBucket.find("[data-cid=" + contentId + "]");
		},

		hideContainer: function hideContainer() {
			$dlListContainer.addClass("hidden");
		},

		remove: function remove(contentId) {
			var $targetElem = this.findDlItemElem(contentId)
			$targetElem.remove();

			this.showHideContainer(main.dlMap);
		},

		showContainer: function showContainer() {
			$dlListContainer.removeClass("hidden");
		},

		showError: function showError($li) {
			$li.children(".cancel").addClass("hidden");
			$li.children(".dismiss").removeClass("hidden");

			// change block colour; it's the main error indicator
			$li.addClass("error");

			// don't let an error show an empty bar or a full bar
			var $bar = $li.find(".dl-bar");
			var $blocks = $bar.find(".dl-block");

			if ($blocks.length == 0) {
				$bar.append(templates.makeDlBlock());
			} else {
				// 1 block less than full might look full if only a fraction of the final block is displayed
				// so 2 blocks less than full is the target quantity
				for (var newBlockCount = $blocks.length; newBlockCount >= maxBlocks - 2; newBlockCount--) {
					$blocks.first().remove();
				}
			}
		},

		showHideContainer: function showHideContainer(map) {
			if (map.size !== 0) {
				this.showContainer();
			} else {
				this.hideContainer();
			}
		},

		updateDlList: function updateDlList(map, oldMap) {
			this.showHideContainer(map);

			// put items in the dlQueue
			for (let key of map.keys()) {
				var item = map.get(key);

				// alter existing dom if item is already on record
				if (oldMap.has(key)) {
					var itemOld = oldMap.get(key);
					var $elem = this.findDlItemElem(item.contentId);

					if (item.percent !== itemOld.percent) {
						var $bar = $elem.find(".dl-bar");
						this.fillDlBar($bar, item.percent);
					}

					if (item.title !== itemOld.title) {
						$elem.find(".title").html(item.title);
					}

					if (item.cancellable) {
						this.showCancelButton($elem);
					}
				} else { // create dom fresh if not on record
					$dlQueueBucket.append(this.contentToDlItemElem(item));
				}
			}
		}
	};

	return DlList;
})();