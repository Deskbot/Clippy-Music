var Queue = {
	$sectionWithin: $("#queue-section"),

	bucketToElem: function bucketToElem(bucket, bucketIsTopBucket, myId, maxBucketTime) {
		var durationUsed = 0;

		for (var i = 0; i < bucket.length; i++) {
			if (bucket[i].userId === myId) {
				durationUsed += bucket[i].duration;
			}
		}

		var $bucketContainer = templates.makeBucketContainer();

		// no need to give time remaining for the top bucket, which you can't add to
		if (bucketIsTopBucket) {
			$bucketContainer.children(".timeAvailable").remove();
		} else {
			$bucketContainer.children(".timeAvailable")
				.html(utils.formatSeconds(maxBucketTime - durationUsed) + " available");
		}

		var $bucket = $bucketContainer.children(".bucket");

		for (var i = 0; i < bucket.length; i++) {
			var item = bucket[i];
			var isMine = myId === item.userId;

			var $bucketItem = templates.makeBucketItem();
			var $bucketNickname = $bucketItem.children(".nickname");
			var title = item.musicDownloadUrl
				? templates.makeLinkToMusic(item.title, item.musicDownloadUrl)
				: templates.makeMusicDownloadLink(item.title, item.id);

			$bucketNickname.append(item.nickname);
			$bucketItem.children(".duration").html("[" + utils.formatSeconds(item.duration) + "]");
			$bucketItem.children(".title").html(title);

			if (item.image) {
				var imageLink = item.image.url
					? templates.makeLinkToImage(item.image.title, item.image.url)
					: templates.makeOverlayDownloadLink(item.image.title, item.id)

				$bucketItem.children(".image").append(imageLink);
			}

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
