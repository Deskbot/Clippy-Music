var Queue = {
	$sectionWithin: $("#queue-section"),

	bucketToElem: function bucketToElem(bucket, myId, maxBucketTime) {
		var durationUsed = 0;

		for (var i = 0; i < bucket.length; i++) {
			if (bucket[i].userId === myId) {
				durationUsed += bucket[i].duration;
			}
		}

		var $bucketContainer = templates.makeBucketContainer();
		$bucketContainer.children(".timeAvailable")
			.html(utils.formatSeconds(maxBucketTime - durationUsed) + " available");

		var $bucket = $bucketContainer.children(".bucket");

		for (var i = 0; i < bucket.length; i++) {
			var item = bucket[i];
			var isMine = myId === item.userId;

			var $bucketItem = templates.makeBucketItem();
			var $bucketNickname = $bucketItem.children(".nickname");
			var title = item.downloadLink
				? templates.makeLinkToContent(item.title, item.downloadLink)
				: item.title;

			$bucketNickname.html(item.nickname);
			$bucketItem.children(".duration").html("[" + utils.formatSeconds(item.duration) + "]");
			$bucketItem.children(".title").html(title);

			if (isMine) {
				$bucketNickname.addClass("my-nickname");

				$bucketItem.children(".delete")
					.attr("data-id", item.id)
					.removeClass("hidden");
			}

			$bucket.append($bucketItem);
		}

		return $bucketContainer;
	}
};
