var WebSocketHandler = (function() {
	
	function WebSocketHandler() {
		$.get({
			url: '/api/wsport'
		}).done(function(data) {
			this.port = data;
			this.setUp();
		}.bind(this));
	}

	WebSocketHandler.prototype.setUp = function() {
		try {
			this.socket = new WebSocket('ws://' + window.location.hostname + ':' + this.port);
		} catch(err) {
			this.reSetUp();
			return;
		}

		this.socket.onopen = function() {
			console.log('WebSocket opened');
		};

		this.socket.onmessage = function(event) {
			const data = JSON.parse(event.data);

			console.log('WebSocket data received', data);

			if (data.type === 'upload')   return this.handleUploadStatus(data);
			if (data.type === 'nickname') return this.displayNickname(data.message);
			if (data.type === 'banned')   return this.handleBanned(data);
			if (data.type === 'queue')    return this.handleQueue(data);
			else                          return main.clippyAgent.speak(data.message);
		}.bind(this);

		this.socket.onclose = function() {
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
					main.clippyAgent.speak('I was unable to download ' + what + ' due to an upload error.');
				
				} else if (content === 'pic') {
					let whatMus = data.message.title ? utils.entitle(data.message.title) : 'the music you requested';
					let whatPic = data.message.picTitle ? utils.entitle(data.message.picTitle) : 'the picture you requested';
					main.clippyAgent.speak('I was unable to download ' + whatPic + ' with ' + whatMus + ' due to an upload error.');
				
				} else {
					main.clippyAgent.speak('I didn\'t queue what you requested because something wasn\'t uploaded successfully, and for some reason I don\'t know what it was.');
				}

			} else if (reason === 'unique') {
				if (content === 'music') {
					let what = data.message.title ? utils.entitle(data.message.title) : 'the music you requested';
					let when = data.message.uniqueCoolOffStr.startsWith('Infinity') ? 'already' : 'in the past ' + data.message.uniqueCoolOffStr;
					main.clippyAgent.speak('I didn\'t queue ' + what + ' because it has been played ' + when + '.');
				
				} else if (content === 'pic') {
					let whatMus = data.message.title ? utils.entitle(data.message.title) : 'the music you requested';
					let whatPic = data.message.picTitle ? utils.entitle(data.message.picTitle) : 'the picture you requested';
					let when = data.message.uniqueCoolOffStr.startsWith('Infinity') ? 'already' : 'in the past ' + data.message.uniqueCoolOffStr;
					main.clippyAgent.speak('I didn\'t queue ' + whatMus + ' because ' + whatPic + ' has been shown ' + when + '.');
				
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

		if (isMine) {
			$currentNickname.addClass('my-nickname');
		} else {
			$currentNickname.removeClass('my-nickname');
		}

		var $title = $currentlyPlaying.find('.title');

		if (data.current) {
			$title.text(data.current.title);
			$title.attr('data-text', utils.htmlEntityDecode(data.current.title));
			$currentNickname.text(data.current.nickname);

			var wordartClass = main.goodWordArt[digestString(data.current.title + data.current.nickname) % main.goodWordArt.length]; //get a random class, but always the same for the same title
			$currentlyPlaying.find('.wordart').removeClass().addClass('wordart').addClass(wordartClass); //remove all classes because we don't know which word art it currently is, add back 'wordart' then add the type of wordart

		} else {
			$title.text('');
			$title.attr('data-text', '');
			$currentNickname.text('');
		}
		
		//rest of queue

		var $queue = $('#queue');
		$queue.empty();

		for (var i = 0; i < data.queue.length; i++) {
			var item = data.queue[i]; //item contains a nickname and bucket
			$queue.append(contentToBucketElem(item, myId));
		}
	};

	return WebSocketHandler;

	function contentToBucketElem(c, myId) {
		var $bucketCont = templates.makeBucketContainer();
		var $bucketNickname = $bucketCont.find('.nickname');
		var $bucket = $bucketCont.find('.bucket');

		$bucketNickname.text(c.nickname);

		var isMine = myId === c.userId;

		if (isMine) $bucketNickname.addClass('my-nickname');
		
		for (var i = 0; i < c.bucket.length; i++) {
			var item = c.bucket[i];
			var $bucketItem = templates.makeBucketItem();
			$bucketItem.find('.title').text(item.title);

			if (isMine) {
				$bucketItem.find('.delete').attr('data-id', item.id).removeClass('hidden');
			}
			
			$bucket.append($bucketItem);
		}

		return $bucketCont;
	}
})();

function digestString(str) {
	var tot = 0;
	for (var i = 0; i < str.length; i++) {
		tot += str.charCodeAt(i);
	}
	return tot;
}
