var WebSocketHandler = (function() {

	function WebSocketHandler() {
		$.get({
			url: "/api/wsport"
		}).done(function(data) {
			this.port = data;
			this.setUp();
		}.bind(this));
	}

	WebSocketHandler.prototype.setUp = function() {
		try {
			this.socket = new WebSocket("ws://" + window.location.hostname + ":" + this.port);
		} catch(err) {
			this.reSetUp();
			return;
		}

		this.socket.onopen = function() {
			console.log("WebSocket opened");
		};

		this.socket.onmessage = function(event) {
			const data = JSON.parse(event.data);

			console.log("WebSocket data received", data);

			var responseMap = {
				"banned":    (function() { return this.handleBanned(data); }.bind(this)),
				"dl-delete": (function() { return this.handleDlDelete(data.message); }.bind(this)),
				"dl-error":  (function() { return this.handleDlError(data); }.bind(this)),
				"dl-list":   (function() { return this.handleDlList(data.message); }.bind(this)),
				"dl-prep":   (function() { return this.handleDlPrepared(data.message); }.bind(this)),
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
			console.log("WebSocket closed");
			this.reSetUp();
		}.bind(this);
	};

	WebSocketHandler.prototype.handleDlDelete = function(contentId) {
		main.dlMap.delete(contentId.toString());

		utils.counterShiftResize(DlList.$sectionWithin, function() {
			DlList.remove(contentId);

			if (main.dlMap.size === 0) {
				DlList.hideContainer(main.dlMap);
			}
		});
	};

	WebSocketHandler.prototype.handleDlError = function(responseData) {
		var contentData = responseData.message;
		var contentId = contentData.contentId;

		var localDlData = main.dlMap.get(contentId.toString());

		if (!localDlData) return; // if we don't have the item that has errored, don't do anything

		localDlData.error = true;

		utils.counterShiftResize(DlList.$sectionWithin, function() {
			DlList.showError(DlList.findDlItemElem(contentId));
		});

		var errorType = contentData.errorType;
		var contentType = contentData.error.contentType;
		var title = localDlData.title;

		var isMusic = contentType === "music";
		var isPic = contentType === "picture"
		var whatMus = title ? utils.entitle(title) : "the music you requested";
		var whatPic = contentData.picTitle ? utils.entitle(contentData.picTitle) : "the picture you requested";

		var clippySays;
		var clippyAnimation;

		if (errorType === "BadUrlError") {
			clippySays = "I could not find anything at the " + contentType + " URL given. Is the url correct?";

		} else if (errorType === "DownloadTooLargeError") {
			var what;

			if (isMusic || isPic) {
				if (isMusic) {
					what = whatMus;
				} else {
					what = whatPic;
				}
				clippySays = "I stopped processing " + what + " because it was too large (exceeded the limit of " + contentData.error.sizeLimit + ").";

			} else {
				clippySays = "I stopped processing your upload because it was too large.";
			}

		} else if (errorType === "DownloadWrongTypeError") {
			var what;

			if (isMusic || isPic) {
				if (isMusic) {
					what = whatMus;
				} else {
					what = whatPic;
				}
				clippySays = "I didn't download " + what + " because the file was the wrong type; "" + contentData.error.actualTypeDesc + "" was received instead.";

			} else {
				clippySays = "I didn't download one of your files because it was of the wrong type.";
			}

		} else if (errorType === "FileUploadError") {
			clippySays = contentData.errorMessage;
			clippyAnimation = "GetArtsy";

		} else if (errorType === "UniqueError") {
			clippyAnimation = "Print";

			if (isMusic) {
				clippySays = "I didn't queue " + whatMus + " because it has been played " + contentData.error.playedWithin + ".";
			} else if (isPic) {
				clippySays = "I didn't queue " + whatMus + " because " + whatPic + " has been shown " + contentData.error.playedWithin + ".";
			} else {
				clippySays = "I didn't queue what you requested because something wasn't unique.";
			}

		} else if (errorType === "YTError") {
			clippySays = contentData.errorMessage;

		} else {
			var what;
			if (isMusic) {
				what = whatMus;
			} else if (isPic) {
				what = whatPic;
			} else {
				what = "your content";
			}

			clippySays = "An unknown problem occured while trying to queue " + what + ".";
			clippyAnimation = "GetArtsy";
		}

		main.clippyAgent.play("GetAttention");
		main.clippyAgent.stop();
		main.clippyAgent.speak(clippySays);
		localDlData.errorMessage = clippySays;
		if (clippyAnimation) main.clippyAgent.play(clippyAnimation);
	};

	WebSocketHandler.prototype.handleDlList = function(list) {
		main.dlMapOld = main.dlMap;
		main.dlMap = new Map(main.dlMap); // make a copy so that non-dismissed errors are kept

		// replace entries with up to date version
		for (var i = 0; i < list.length; i++) {
			var item = list[i];
			var cid = item.contentId.toString();
			main.dlMap.set(cid.toString(), item);
		}

		// render full list afresh
		utils.counterShiftResize(DlList.$sectionWithin, function() {
			DlList.updateDlList(main.dlMap, main.dlMapOld);
		});
	};

	WebSocketHandler.prototype.handleDlPrepared = function(contentData) {
		main.clippyAgent.stop();
		main.clippyAgent.speak("I am now downloading " + utils.entitle(contentData.title) + ".");
	};

	WebSocketHandler.prototype.handleNickname = function(name) {
		main.nickname = name;
		utils.displayNickname(name);
	};

	WebSocketHandler.prototype.reSetUp = function() {
		setTimeout(function() {
			this.setUp();
		}.bind(this), 5000);
	};

	WebSocketHandler.prototype.handleBanned = function(data) {
		if (data.banned) {
			main.clippyAgent.stop();
			main.clippyAgent.play("GetAttention");
			main.clippyAgent.speak("You have been banned!");
			main.clippyAgent.play("EmptyTrash");
		}
	};

	WebSocketHandler.prototype.handleQueue = function(data) {
		var myId = utils.myId();

		utils.counterShiftResize($("#current-section"), function() {
			//current

			var $currentlyPlaying = $("#currently-playing");
			var $currentNickname = $currentlyPlaying.find(".nickname");
			var isMine = !data.current ? false : myId === data.current.userId;

			if (isMine) {
				$currentNickname.addClass("my-nickname");
			} else {
				$currentNickname.removeClass("my-nickname");
			}

			var $title = $currentlyPlaying.find(".title");

			if (data.current) {
				$title.html(data.current.title);
				$title.attr("data-text", utils.htmlEntityDecode(data.current.title));
				$currentNickname.html(data.current.nickname);

				//get a random class, but always the same for the same title
				var wordartClass = main.goodWordArt[digestString(data.current.title + data.current.nickname) % main.goodWordArt.length];
				//remove all classes because we don't know which word art it currently is, add back "wordart" then add the type of wordart
				$currentlyPlaying.find(".wordart").removeClass().addClass("wordart").addClass(wordartClass);
			} else {
				$title.html("");
				$title.attr("data-text", "");
				$currentNickname.html("");
			}
		});

		var $queue = $("#queue");

		utils.counterShiftResize($("#queue-section"), function () {
			//rest of queue
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
			var cid = item.contentId.toString();

			if (main.dlMap.has(cid)) {
				var itemBefore = main.dlMap.get(cid);
				itemBefore.cancellable = item.cancellable;
				itemBefore.percent = item.percent;
				itemBefore.title = item.title;
			} else {
				main.dlMap.set(cid, item);
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
