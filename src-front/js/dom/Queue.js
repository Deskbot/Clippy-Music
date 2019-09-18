var Queue = {
	$sectionWithin: $("#queue-section"),

	contentToBucketElem: function contentToBucketElem(c, myId, maxBucketTime) {
		var durationUsed = 0;

		for (var i = 0; i < c.bucket.length; i++) {
			durationUsed += c.bucket[i].duration;
		}

		var $bucketContainer = templates.makeBucketContainer();
		$bucketContainer.children(".timeAvailable")
			.html(formatSeconds(durationUsed) + " / " + formatSeconds(maxBucketTime));

		var $bucket = $bucketContainer.children(".bucket");

		var isMine = myId === c.userId;

		for (var i = 0; i < c.bucket.length; i++) {
			var item = c.bucket[i];

			var $bucketItem = templates.makeBucketItem();
			var $bucketNickname = $bucketItem.find(".nickname");
			$bucketNickname.html(item.nickname);
			$bucketItem.find(".title").html(item.title);

			if (isMine) {
				$bucketContainer.attr("id", "my-bucket-container");
				$bucketNickname.addClass("my-nickname");

				$bucketItem.find(".delete")
					.attr("data-id", item.id)
					.removeClass("hidden");
			}

			$bucket.append($bucketItem);
		}

		return $bucketContainer;
	}
};

function formatSeconds(s) {
	var mins = Math.floor(s / 60);
	var secs = s % 60;
	return `${mins}:${secs}`;
}
