var Queue = {
	contentToBucketElem: function contentToBucketElem(c, myId) {
		var $bucketCont = templates.makeBucketContainer();
		var $bucketNickname = $bucketCont.find('.nickname');
		var $bucket = $bucketCont.find('.bucket');

		$bucketNickname.html(c.nickname);

		var isMine = myId === c.userId;

		if (isMine) {
			$bucketCont.attr('id', 'my-bucket-container');
			$bucketNickname.addClass('my-nickname');
		}
		
		for (var i = 0; i < c.bucket.length; i++) {
			var item = c.bucket[i];
			var $bucketItem = templates.makeBucketItem();
			$bucketItem.find('.title').html(item.title);

			if (isMine) {
				$bucketItem.find('.delete').attr('data-id', item.id).removeClass('hidden');
			}
			
			$bucket.append($bucketItem);
		}

		return $bucketCont;
	}
};