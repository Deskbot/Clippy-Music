var WebSocketHandler = (function() {
	
	function WebSocketHandler() {
		this.setUp();
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

			console.log('WebSocket data received', data);

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
			main.clippyAgent.speak('I have queued ' + utils.entitle(data.message.title) + ' successfully.');
			main.clippyAgent.play('Congratulate');

		} else {
			main.clippyAgent.play('GetAttention');

			const reason = data.message.reason;
			const content = data.message.content;

			if (reason === 'dl') {
				if (content === 'music') {
					let what = data.message.title ? utils.entitle(data.message.title) : 'the music you requested';
					main.clippyAgent.speak('I was unable to download ' + what + '.');
				
				} else if (content === 'pic') {
					let what = data.message.title ? utils.entitle(data.message.title) : 'the music you requested';
					main.clippyAgent.speak('I was unable to download the picture you requested with ' + what + '.');
				
				} else {
					main.clippyAgent.speak('I didn\'t queue what you requested because something wasn\'t downloaded successfully, and for some reason I don\'t know what it was.');
				}

			} else if (reason === 'unique') {
				if (content === 'music') {
					let what = data.message.title ? utils.entitle(data.message.title) : 'the music you requested';
					main.clippyAgent.speak('I didn\'t queue ' + what + ' because it has been played in the past ' + data.message.uniqueCoolOffStr + '.');
				
				} else if (content === 'pic') {
					let what = utils.entitle(data.message.title);
					main.clippyAgent.speak('I didn\'t queue ' + what + ' because the picture you gave has been shown in the past ' + data.message.uniqueCoolOffStr + '.');
				
				} else {
					main.clippyAgent.speak('I didn\'t queue what you requested because something wasn\'t unique, and for some reason I don\'t know what it was.');
				}

			} else if (reason === 'unknown') {
				main.clippyAgent.speak('An unknown problem occured while trying to queue ' + utils.entitle(data.message.title) + '.');
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
		var myId = cookie.read('id');

		//current

		var $currentlyPlaying = $('#currently-playing');
		var $currentNickname = $currentlyPlaying.find('.nickname');
		var isMine = !data.current ? false : myId === data.current.userId;

		if (isMine) $currentNickname.addClass('my-nickname');

		if (data.current) {
			$currentlyPlaying.find('.title').html(data.current.title);	
			$currentNickname.html(data.current.nickname);

		} else {
			$currentlyPlaying.find('.title').html('');
			$currentNickname.html('');
		}
		
		//rest of queue

		var $queue = $('#queue');
		$queue.empty();

		for (var d of data.queue) { //d contains a nickname and bucket
			$queue.append(contentToBucketElem(d, myId));
		}
	};

	return WebSocketHandler;

	function contentToBucketElem(c, myId) {
		var $bucketCont = templates.makeBucketContainer();
		var $bucketNickname = $bucketCont.find('.nickname');
		var $bucket = $bucketCont.find('.bucket');

		$bucketNickname.html(c.nickname);

		var isMine = myId === c.userId;

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