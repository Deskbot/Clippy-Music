const debug = require('../lib/debug.js');
const WebSocketHandler = require('../lib/WebSocketHandler.js');

const ContentServer = require('./ContentServer.js');
const UserRecServ = require('./UserRecordServer.js');


const wsHandler = new WebSocketHandler(onConnect, onMessage, onClose);

function onConnect(soc) {
	const id = WebSocketHandler.socToUserId(soc);

	//send queue
	Api.sendQueue(soc);

	//save user
	UserRecServ.add(id);
	UserRecServ.setWS(id, soc);

	//notify if banned
	if (UserRecServ.isBanned(id)) Api.sendBanned(soc);

	//tell user their nickname
	if (UserRecServ.isUser(id)) Api.sendNickname(soc, UserRecServ.getNickname(id));
}

function onMessage(soc, data) {
	const dataObj = JSON.parse(data);

	if (dataObj.type === 'delete-content') {
		if (!ContentServer.remove(wsHandler.socToUserId(soc), dataObj.contentId)) {
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
}

function onClose(soc, id) {
	UserRecServ.unsetWS(id, soc);
}

//really a namespace where all functions are hoisted
class Api {

	//message related

	static sendMessage(socs, type, mes) {
		if (!socs) {
			debug.log('no socs given');
			debug.trace();
			return;
		}

		const message = JSON.stringify({
			type: type,
			success: true,
			message: mes,
		});

		wsHandler.sendToMany(socs, message);
	}

	static sendNickname(soc, nickname) {
		this.sendMessage(soc, 'nickname', nickname);
	}

	static sendBanned(socs) {
		if (!socs) {
			debug.log('no socs given');
			debug.trace();
			return;
		}

		const message = JSON.stringify({
			type: 'banned',
			success: true,
			banned: true,
		});

		wsHandler.sendToMany(socs, message);
	}
		
	static sendError(socs, type, reason) {
		if (!socs) {
			debug.log('no socs given');
			debug.trace();
			return;
		}

		const message = JSON.stringify({
			type: type,
			success: false,
			message: reason,
		});

		wsHandler.sendToMany(socs, message);
	}

	static broadcastMessage(type, mes) {
		const message = JSON.stringify({
			type: type,
			message: mes,
		});

		wsHandler.broadcast(message);
	}

	//queue related

	static makeQueueMessage() {
		return {
			type: 'queue',
			current: ContentServer.getCurrentlyPlaying(),
			queue: ContentServer.getBucketsForPublic(),
		};
	}

	static sendQueue(socs) {
		if (!socs) {
			debug.log('no socs given');
			debug.trace();
			return;
		}

		const message = JSON.stringify(this.makeQueueMessage());

		wsHandler.sendToMany(socs, message);
	}

	static broadcastQueue() {
		this.broadcast(JSON.stringify(this.makeQueueMessage()));
	}
}

module.exports = Api;