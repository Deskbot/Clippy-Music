var Queue = {
	$sectionWithin: $("#queue-section"),

	bucketToElem: function bucketToElem(bucket, myId, maxBucketTime) {
		var durationUsed = 0;

		for (var i = 0; i < bucket.length; i++) {
			durationUsed += bucket[i].duration;
		}

		var $bucketContainer = templates.makeBucketContainer();
		$bucketContainer.children(".timeAvailable")
			.html(formatSeconds(durationUsed) + " / " + formatSeconds(maxBucketTime));

		var $bucket = $bucketContainer.children(".bucket");

		var isMine = myId === bucket.userId;

		for (var i = 0; i < bucket.length; i++) {
			var item = bucket[i];

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
	var hours = Math.floor(s / 3600);
	var secsInHour = s % 3600;
	var mins = Math.floor(secsInHour / 60);
	var secs = s % 60;

	var str;
	str = hours > 0 ? hours + ":" : "";
	str += mins > 0 ? mins + ":" : "";
	str += secs > 0 ? secs : "";

	return str.trim();
}
