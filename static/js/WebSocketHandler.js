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
			console.log('WebSocket connection opened');
		};

		this.socket.onmessage = (event) => {
			const data = JSON.parse(event.data);

			console.log('WebSocket message received', data);

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

	WebSocketHandler.prototype.displayNickname = function(name) {
		utils.displayNickname(name);
	};

	WebSocketHandler.prototype.reSetUp = function() {
		setTimeout(() => this.setUp(), 30000);
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

	}

	return WebSocketHandler
})();