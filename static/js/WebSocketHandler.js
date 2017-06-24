var WebSocketHandler = (function() {
	
	function WebSocketHandler() {
		this.setUp();

		window.onbeforeunload = function() {
			this.socket.close();
		};
	}

	WebSocketHandler.prototype.setUp = function() {
		try {
			this.socket = new WebSocket('ws://' + window.location.hostname + ':3000');
		} catch(err) {
			this.reSetUp();
			return;
		}

		this.socket.onopen = () => {
			console.log('WebSocket opened');
		};

		this.socket.onmessage = (event) => {
			const data = JSON.parse(event.data);

			console.log('WebSocket message received', data);

			if (data.type === 'upload')   return this.handleUploadStatus(data);
			if (data.type === 'nickname') return this.displayNickname(data.message);
			if (data.type === 'banned')   return this.handleBanned(data);
			if (data.type === 'queue')    return this.handleQueue(data);
			else                          return main.clippyAgent.speak(data.message);
		};

		this.socket.onclose = () => {
			console.log('WebSocket closed');
			this.reSetUp();
		};
	};

	WebSocketHandler.prototype.handleUploadStatus = function(data) {
		main.clippyAgent.stop();

		if (data.success) {
			main.clippyAgent.speak('I have queued your content successfully.');
			main.clippyAgent.play('Congratulate');

		} else {
			main.clippyAgent.play('GetAttention');

			var problems = data.message.problems;

			if (problems.musicDlProblem) {
				main.clippyAgent.speak('I was unable to download the music you requested.');
			}

			if (problems.musicUniqueProblem) {
				main.clippyAgent.speak('I was unable to play the music you requested because it has been played in the past ' + data.message.uniquenessCooloff + '.');
			}

			if (problems.picDlProblem) {
				main.clippyAgent.speak('I was unable to download the picture you requested.');
			}
			
			if (problems.picUniqueProblem) {
				main.clippyAgent.speak('I didn\'t queue the picture you requested because it has been shown in the past ' + data.message.uniquenessCoolOff + '.');
			}
		}
	};

	WebSocketHandler.prototype.displayNickname = function(name) {
		utils.displayNickname(name);
	};

	WebSocketHandler.prototype.reSetUp = function() {
		setTimeout(function() {
			this.setUp();
		}.bind(this), 30000);
	};

	WebSocketHandler.prototype.handleBanned = function(data) {
		if (data.banned) {
			main.clippyAgent.stop();
			main.clippyAgent.play('GetAttention');
			main.clippyAgent.speak('You have been banned!');
			main.clippyAgent.play('EmptyTrash');
		}
	};

	WebSocketHandler.prototype.handleQueue = function(data) {
		//current

		var $currentlyPlaying = $('#currently-playing');

		if (data.current) {
			$currentlyPlaying.find('.nickname').html(data.current.nickname);
			$currentlyPlaying.find('.title').html(data.current.title);	

		} else {
			$currentlyPlaying.find('.nickname').html('');
			$currentlyPlaying.find('.title').html('');
		}
		
		//rest of queue

		var $queue = $('#queue');
		$queue.empty();

		var d;
		for (d of data.queue) { //d contains a nickname and bucket
			$queue.append(contentToBucketElem(d));
		}
	};

	return WebSocketHandler;

	function contentToBucketElem(c) {
		var $bucketCont = templates.makeBucketContainer();
		var $bucketNickname = $bucketCont.find('.nickname');
		var $bucket = $bucketCont.find('.bucket');

		$bucketNickname.html(c.nickname);

		var isMine = cookie.read('id') === c.userId;

		console.log(cookie.read('id'), c.userId);

		if (isMine) $bucketNickname.addClass('my-nickname');
		
		var item, $bucketItem;
		for (item of c.bucket) {
			$bucketItem = templates.makeBucketItem();
			$bucketItem.find('.title').html(item.title);

			if (isMine) {
				$bucketItem.find('.delete').attr('data-id', item.id).removeClass('hidden');
			}
			
			$bucket.append($bucketItem);
		}

		return $bucketCont;
	}
})();