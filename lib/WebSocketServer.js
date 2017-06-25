const opt = require('../options.js');

const ws = require('ws');

function startSync(environmentData) {

	const wss = new ws.Server({ port: 3000 });

	wss.broadcast = function broadcast(data) {
		wss.clients.forEach(function each(client) {
			if (client.readyState === ws.OPEN) {
				client.send(data);
			}
		});
	};

	//websocket server handlers

	wss.on('connection', (soc) => { //when a client connects
		const id = socToUserId(soc);

		//add handler to do something when the client sends a message
		soc.on('message', (data, flags) => {
			onMessage(soc, data, flags);
		});

		soc.on('close', () => {
			environmentData.userRecord.unsetWS(id, soc);
			delete soc;
		});

		//send queue
		sendQueue(soc);

		//save user
		environmentData.userRecord.add(id);
		environmentData.userRecord.setWS(id, soc);

		//notify if banned
		if (environmentData.userRecord.isBanned(id)) sendBanned(soc);

		//tell user their nickname
		if (environmentData.userRecord.isUser(id)) sendNickname(soc, environmentData.userRecord.getNickname(id)); 
	});

	//exports

	module.exports = {
		wss: wss,

		startSync: startSync,

		broadcast: function broadcast(type, mes) {
			const message = JSON.stringify({
				type: type,
				message: mes,
			});

			wss.broadcast(message);
		},

		broadcastQueue: function broadcastQueue() {
			wss.broadcast(JSON.stringify(getQueueData()));
		},

		sendQueue: sendQueue,

		sendBanned: function sendBanned(socs) {
			if (!socs) return;

			const message = JSON.stringify({
				type: 'banned',
				success: true,
				banned: true,
			});

			if (Array.isArray(socs)) {
				let soc;
				for (soc of socs) soc.send(message);
			} else {
				socs.send(message);
			}
		},
		
		sendMessage: sendMessage,

		sendNickname: sendNickname,
		
		sendError: function (socs, type, reason) {
			if (!socs) return;

			const message = JSON.stringify({
				type: type,
				success: false,
				message: reason,
			});

			if (Array.isArray(socs)) {
				let soc;
				for (soc of socs) soc.send(message);	
			} else {
				socs.send(message);
			}
		},
	};
	
	//function utils

	function onMessage(soc, data, flags) { 
		console.log('ws flags', flags);

		if (!flag.binary) {
			const dataObj = JSON.parse(data);

			if (dataObj.type === 'delete-content') {
				if (!environmentData.contentManager.remove(socToUserId(soc), dataObj.contentId)) {
					soc.send(JSON.stringify({
						type: dataObj.type,
						success: false,
						reason: 'The queue item you tried to remove was not chosen by you.',
					}));
				}

			} else {
				soc.send(JSON.stringify({
					type: dataObj.type,
					success: false,
					reason: 'The server did not recognise the type of message you were trying to send.',
				}));
			}
		} else {
			//think about sending error back if this isn't needed for anything
			console.error('mysterious binary flag occured');
			console.error(data,flags);
		}
	}

	function getQueueData() {
		return {
			type: 'queue',
			current: environmentData.contentManager.getCurrentlyPlaying(),
			queue: environmentData.contentManager.getBucketsForPublic(),
		};
	}

	function sendMessage(socs, type, mes) {
		if (!socs) return;

		const message = JSON.stringify({
			type: type,
			success: true,
			message: mes,
		});

		if (Array.isArray(socs)) {
			let soc;
			for (soc of socs) soc.send(message);
		} else {
			socs.send(message);
		}
	}

	function socToUserId(soc) {
		return soc._socket.remoteAddress;
	}

	function sendQueue(socs) {
		if (!socs) return;

		const message = JSON.stringify(getQueueData());

		if (Array.isArray(socs)) {
			let soc;
			for (soc of socs) soc.send(message);
		} else {
			socs.send(message);
		}
	}

	function sendNickname(soc, nickname) {
		sendMessage(soc, 'nickname', nickname);
	}

	return module.exports;
}

module.exports = {
	startSync: startSync,
};
