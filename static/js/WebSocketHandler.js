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

			var responseMap = {
				"banned":    (function() { return this.handleBanned(data); }.bind(this)),
				"dl-add":    (function() { return this.handleDlAdd(data.message); }.bind(this)),
				"dl-delete": (function() { return this.handleDlDelete(data.message); }.bind(this)),
				"dl-error":  (function() { return this.handleDlError(data); }.bind(this)),
				"dl-list":   (function() { return this.handleDlList(data.message); }.bind(this)),
				"nickname":  (function() { return this.handleNickname(data.message); }.bind(this)),
				"queue":     (function() { return this.handleQueue(data); }.bind(this))
			};

			if (data.type in responseMap) {
				responseMap[data.type]();
			} else {
				main.clippyAgent.speak(data.message);
			}
		}.bind(this);

		this.socket.onclose = function() {
			console.log('WebSocket closed');
			this.reSetUp();
		}.bind(this);
	};

	WebSocketHandler.prototype.handleDlAdd = function(contentData) {
		main.clippyAgent.stop();
		main.clippyAgent.speak('I have queued ' + utils.entitle(contentData.title) + ' successfully.');
		main.clippyAgent.play('Congratulate');

		main.dlMap.insert(contentData.contentId, contentData);

		DlList.add(contentData);

		if (main.dlMap.size() > 0) {
			DlList.showContainer();
		}
	};

	WebSocketHandler.prototype.handleDlDelete = function(contentId) {
		main.dlMap.remove(contentId);

		DlList.remove(contentId);

		if (main.dlMap.size() === 0) {
			DlList.hideContainer();
		}
	};

	WebSocketHandler.prototype.handleDlError = function(responseData) {
		var contentData = responseData.message;
		var contentId = contentData.contentId;

		var localDlData = main.dlMap.get(contentId);
		localDlData.error = true;

		DlList.showError(contentId);

		main.clippyAgent.play('GetAttention');

		var errorType = contentData.errorType;
		var contentType = contentData.error.contentType;
		var title = localDlData.title;

		var isMusic = contentType === 'music';
		var isPic = contentType === 'picture'
		var whatMus = title ? utils.entitle(title) : 'the music you requested';
		var whatPic = contentData.picTitle ? utils.entitle(contentData.picTitle) : 'the picture you requested';

		var clippySays;

		if (errorType === 'CancelError') {	
			if (contentData.picTitle) { // was it given at all?
				clippySays = 'I stopped processing ' + whatMus + ' with ' + whatPic + ' because you cancelled it.';
			} else if (contentType === 'picture') {
				clippySays = 'I stopped processing ' + whatMus + ' because you cancelled it.';
			} else {
				clippySays = 'I stopped processing your upload because you cancelled it.';
			}

		} else if (errorType === 'DownloadTooLargeError') {
			var what;

			if (isMusic || isPic) {
				if (isMusic) {
					what = whatMus;
				} else {
					what = whatPic;
				}
				clippySays = 'I stopped processing ' + what + ' because it was too large (exceeded ' + contentData.error.sizeLimit + ').';

			} else {
				clippySays = 'I stopped processing your upload because it was too large.';
			}

		} else if (errorType === 'DownloadWrongType') {
			var what;

			if (isMusic || isPic) {
				if (isMusic) {
					what = whatMus;
				} else {
					what = whatPic;
				}
				clippySays = 'I didn\'t download ' + what + ' because the file was the wrong type (' + contentData.error.expectedType + ' expected, ' + contentData.error.actualTypeDesc + ' found)';

			} else {
				clippySays = 'I didn\'t download something because a file was of the wrong type.';
			}
			
		} else if (errorType === 'UniqueError') {
			var when = contentData.error.timeWithin.startsWith('Infinity') ? 'already' : 'in the past ' + contentData.error.timeWithin;

			if (isMusic) {
				clippySays = 'I didn\'t queue ' + whatMus + ' because it has been played ' + when + '.';
			} else if (isPic) {
				clippySays = 'I didn\'t queue ' + whatMus + ' because ' + whatPic + ' has been shown ' + when + '.';
			} else {
				clippySays = 'I didn\'t queue what you requested because something wasn\'t unique.';
			}

		} else {
			clippySays = 'An unknown problem occured while trying to queue ' + whatMus + '.';
		}

		main.clippyAgent.speak(clippySays);
	};

	WebSocketHandler.prototype.handleDlList = function(list) {
		// update internal list storage
		this.mergeNewListWithInternal(list);

		// render full list afresh

		var presentList = main.dlMap.getValues();

		DlList.renderDlList(presentList);
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

				//get a random class, but always the same for the same title
				var wordartClass = main.goodWordArt[digestString(data.current.title + data.current.nickname) % main.goodWordArt.length];
				//remove all classes because we don't know which word art it currently is, add back 'wordart' then add the type of wordart
				$currentlyPlaying.find('.wordart').removeClass().addClass('wordart').addClass(wordartClass);
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

	WebSocketHandler.prototype.mergeNewListWithInternal = function(list) {
		for (var i = 0; i < list.length; i++) {
			var item = list[i];
			var cid = item.contentId;

			if (main.dlMap.has(cid)) {
				var itemBefore = main.dlMap.get(cid);
				itemBefore.percent = item.percent;
				itemBefore.title = item.title;
			} else {
				main.dlMap.insert(cid, item);
			}
		}
	};

	return WebSocketHandler;

	function digestString(str) {
		var tot = 0;
		for (var i = 0; i < str.length; i++) {
			tot += str.charCodeAt(i);
		}
		return tot;
	}
})();
