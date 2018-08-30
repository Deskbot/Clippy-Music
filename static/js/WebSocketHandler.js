var WebSocketHandler = (function() {
	
	function WebSocketHandler() {
		$.get({
			url: '/api/wsport'
		}).done(function(data) {
			this.port = data;
			this.setUp();
		}.bind(this));

		this.dlMap = new OrderedMap();
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

			var responseMap = {
				"banned":     function() { return this.handleBanned(data); }
				"dl-add":     function() { return this.handleDlAdd(data.message); }
				"dl-delete":  function() { return this.handleDlDelete(data.message); }
				"dl-error":   function() { return this.handleDlError(data.message); }
				"dl-list":    function() { return this.handleDlList(data.message); }
				"nickname":   function() { return this.handleNickname(data.message); }
				"queue":      function() { return this.handleQueue(data); }
				"upload":     function() { return this.handleUploadStatus(data); }
			};

			if (data.type in responseMap) {
				responseMap[data.type]();
			} else {
				return main.clippyAgent.speak(data.message);
			}

		}.bind(this);

		this.socket.onclose = function() {
			console.log('WebSocket closed');
			this.reSetUp();
		}.bind(this);
	};

	WebSocketHandler.prototype.handleDlAdd = function(data) {
		this.dlMap.insert(data.contentId, data);

		// insert new item into the DOM
	};

	WebSocketHandler.prototype.handleDlDelete = function(contentId) {
		this.dlMap.remove(contentId);

		// remove the item from the DOM
	};

	WebSocketHandler.prototype.handleDlError = function(contentId) {
		var dlItem = this.dlMap.get(contentId);
		dlItem.error = true;

		// display existing item as an error
	};

	WebSocketHandler.prototype.handleDlList = function(list) {
		// update internal list storage

		mergeNewListWithInternal(list);

		// render full list afresh

		var presentList = this.dlMap.getValues();

		DlList.renderDlList(presentList);
	};

	WebSocketHandler.prototype.handleUploadStatus = function(data) {
		main.clippyAgent.stop();

		if (data.success) {
			main.clippyAgent.speak('I have queued ' + utils.entitle(data.message.title) + ' successfully.');
			main.clippyAgent.play('Congratulate');

		} else {
			main.clippyAgent.play('GetAttention');

			const reason = data.message.reason;
			const contentType = data.message.contentType;

			if (reason === 'dl') {
				if (contentType === 'music') {
					let what = data.message.title ? utils.entitle(data.message.title) : 'the music you requested';
					main.clippyAgent.speak('I was unable to download ' + what + ' due to an upload error.');
				
				} else if (contentType === 'pic') {
					let whatMus = data.message.title ? utils.entitle(data.message.title) : 'the music you requested';
					let whatPic = data.message.picTitle ? utils.entitle(data.message.picTitle) : 'the picture you requested';
					main.clippyAgent.speak('I was unable to download ' + whatPic + ' with ' + whatMus + ' due to an upload error.');
				
				} else {
					main.clippyAgent.speak('I didn\'t queue what you requested because something wasn\'t uploaded successfully, and for some reason I don\'t know what it was.');
				}

			} else if (reason === 'unique') {
				if (contentType === 'music') {
					let what = data.message.title ? utils.entitle(data.message.title) : 'the music you requested';
					let when = data.message.uniqueCoolOffStr.startsWith('Infinity') ? 'already' : 'in the past ' + data.message.uniqueCoolOffStr;
					main.clippyAgent.speak('I didn\'t queue ' + what + ' because it has been played ' + when + '.');
				
				} else if (contentType === 'pic') {
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

	WebSocketHandler.prototype.handleNickname = function(name) {
		main.nickname = name;
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
		var $queueWindow = $('#queue-section');
		
		utils.counterShiftResize($queueWindow, function() {
			var myId = utils.myId();

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
				$title.html(data.current.title);
				$title.attr('data-text', utils.htmlEntityDecode(data.current.title));
				$currentNickname.html(data.current.nickname);

				var wordartClass = main.goodWordArt[digestString(data.current.title + data.current.nickname) % main.goodWordArt.length]; //get a random class, but always the same for the same title
				$currentlyPlaying.find('.wordart').removeClass().addClass('wordart').addClass(wordartClass); //remove all classes because we don't know which word art it currently is, add back 'wordart' then add the type of wordart

			} else {
				$title.html('');
				$title.attr('data-text', '');
				$currentNickname.html('');
			}
			
			//rest of queue

			var $queue = $('#queue');
			$queue.empty();

			for (var i = 0; i < data.queue.length; i++) {
				var item = data.queue[i]; //item contains a nickname and bucket
				$queue.append(Queue.contentToBucketElem(item, myId));
			}
		});
	};

	return WebSocketHandler;

	function digestString(str) {
		var tot = 0;
		for (var i = 0; i < str.length; i++) {
			tot += str.charCodeAt(i);
		}
		return tot;
	}

	function mergeNewListWithInternal(list) {
		for (var i = 0; i < list.length; i++) {
			var item = list[i];
			var cid = item.contentId;

			if (this.dlMap.has(cid)) {
				var itemBefore = this.dlMap.get(cid);
				itemBefore.percent = item.percent;
			} else {
				this.dlMap.insert(cid, item);
			}
		}
	}
})();
