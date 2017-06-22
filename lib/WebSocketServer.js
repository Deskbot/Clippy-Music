const opt = require('../options.js');

const ws = require('ws');

function startSync(environmentData) {
	function sendQueue(soc) {
		const dataOut = {
			type: 'queue',
			success: true,
			current: environmentData.contentManager.getCurrentlyPlaying(),
			queue: environmentData.contentManager.getBucketsForPublic(),
		};
		soc.send(JSON.stringify(dataOut));
	}

	//function utils

	function socToUserId(soc) {
		return soc._socket.remoteAddress;
	}

	//procedure utils

	function onMessage(soc, data, flags) { 
		console.log('ws flags', flags);

		if (!flag.binary) {
			const dataObj = JSON.parse(data);

			if (dataObj.type === 'set-nickname') {
				environmentData.userRecord.setNickname(dataObj.nickname);

			} else if (dataObj.type === 'get-queue') {
				sendQueue(soc);

			} else if (dataObj.type === 'remove-item') {
				if (environmentData.contentManager.itemChosenByUser(dataObj.queueId, userId)) {
					environmentData.contentManager.removeItem();
				} else {
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

	const wss = new ws.Server({ port: 3000 });

	//websocket server handlers

	wss.on('connection', (soc) => { //when a client connects
		//add handler to do something when the client sends a message
		soc.on('message', (data, flags) => {
			onMessage(soc, data, flags);
		});

		//send queue
		sendQueue(soc);

		//save user
		const id = socToUserId(soc);
		environmentData.userRecord.add(id);
		environmentData.userRecord.setWS(id, soc);

		//notify if banned
		if (environmentData.userRecord.isBanned(id)) sendBanned(soc);
	});

	wss.on('closedconnection', (soc) => {
		const id = socToUserId(soc);
		environmentData.userRecord.unsetWS(id, soc);
	})

	return wss;
}

function sendBanned(socs) {
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
}

//funcs
module.exports = {
	startSync: startSync,

	sendBanned: sendBanned,
	
	sendMessage: (socs, type, mes) => {
		const message = JSON.stringify({
			type: type,
			message: mes,
		});

		if (Array.isArray(socs)) {
			let soc;
			for (soc of socs) soc.send(message);
		} else {
			socs.send(message);
		}
	},
	
	sendError: (socs, type, reason) => {
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
