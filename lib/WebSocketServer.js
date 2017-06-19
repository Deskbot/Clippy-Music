const main = require('../main.js');
const opt = require('../options.js');

const ws = require('ws');

function startSync(environmentData) {
	const wss = new ws.Server({ port: opt.websocketPort });

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
		main.userRecord.add(id);
		main.userRecord.setWS(id, soc);

		//notify if banned
		if (main.userRecord.isBanned(id)) sendBanned(soc);
	});

	wss.on('closedconnection', (soc) => {
		const id = socToUserId(soc);
		main.userRecord.unsetWS(id, soc);
	})

	return wss;
}

//function utils

function socToUserId(soc) {
	return soc._socket.remoteAddress;
}

//procedure utils

function onMessage(soc, data, flags) { 
	console.log(flags);

	if (!flag.binary) {
		const dataObj = JSON.parse(data);

		if (dataObj.type === 'set-nickname') {
			main.userRecord.setNickname(dataObj.nickname);

		} else if (dataObj.type === 'get-queue') {
			sendQueue(soc);

		} else if (dataObj.type === 'remove-item') {
			if (main.contentManager.itemChosenByUser(dataObj.queueId, userId)) {
				main.contentManager.removeItem();
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
		console.log('mysterious binary flag occured');
		console.log(data,flags);
	}
}

//funcs
module.exports = {
	startSync: startSync,

	sendBanned: function sendBanned(soc) {
		soc.send(JSON.stringify({
			type: 'banned',
			success: true,
			banned: true,
		}));
	},

	sendQueue: function sendQueue(soc) {
		const dataOut = {
			type: 'queue',
			success: true,
			queue: main.contentManager.getBucketsForPublic(),
		};
		soc.send(JSON.stringify(dataOut));
	},
	
	sendMessage: (soc, message) => { //not sure whether this needs to exist
		soc.send(message);
	},
	
	sendError: (soc, type, reason) => { //not sure whether this needs to exist
		soc.send(JSON.stringify({
			type: type,
			success: false,
			reason: JSON.stringify(reason),
		}));
	},
};
