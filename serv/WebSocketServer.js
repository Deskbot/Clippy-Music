const debug = require('../lib/debug.js');
const WebSocketHandler = require('../lib/WebSocketHandler.js');

const ContentServer = require('./ContentServer.js');
const UserRecServ = require('./UserRecordServer.js');

const consts = require('../lib/consts.js');

//really a namespace where all functions are hoisted
class Api {
	constructor() {
		this.wsh = new WebSocketHandler(onConnect.bind(this), onMessage.bind(this), onClose.bind(this), socToUserId.bind(this));

		//where clause:

		function onConnect(soc, id) {
			//send queue
			this.sendQueue(soc);

			//save user
			UserRecServ.add(id);
			UserRecServ.setWS(id, soc);

			//notify if banned
			if (UserRecServ.isBanned(id)) this.sendBanned(soc);

			//tell user their nickname
			if (UserRecServ.isUser(id)) this.sendNickname(soc, UserRecServ.getNickname(id));
		}

		function onMessage(soc, id, data, flags) {
			const dataObj = JSON.parse(data);

			if (dataObj.type === 'delete-content') {
				if (!ContentServer.remove(this.wsh.socToUserId(soc), dataObj.contentId)) {
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

		function socToUserId(soc) {
			return soc._socket.remoteAddress;
		}
	}

	//message related

	sendMessage(socs, type, mes) {
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

		this.wsh.sendToMany(socs, message);
	}

	sendNickname(soc, nickname) {
		this.sendMessage(soc, 'nickname', nickname);
	}

	sendBanned(socs) {
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

		this.wsh.sendToMany(socs, message);
	}
		
	sendError(socs, type, reason) {
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

		this.wsh.sendToMany(socs, message);
	}

	broadcastMessage(type, mes) {
		const message = JSON.stringify({
			type: type,
			message: mes,
		});

		this.wsh.broadcast(message);
	}

	//queue related

	makeQueueMessage() {
		return {
			type: 'queue',
			current: ContentServer.getCurrentlyPlaying(),
			queue: ContentServer.getBucketsForPublic(),
		};
	}

	sendQueue(socs) {
		if (!socs) {
			debug.log('no socs given');
			debug.trace();
			return;
		}

		const message = JSON.stringify(this.makeQueueMessage());

		this.wsh.sendToMany(socs, message);
	}

	broadcastEmptyQueue() {
		this.wsh.broadcast(JSON.stringify({
			type: 'queue',
			current: null,
			queue: [],
		}));
	}

	broadcastQueue() {
		this.wsh.broadcast(JSON.stringify(this.makeQueueMessage()));
	}
}

const api = new Api();

let lastQueueWasEmpty = false;
ContentServer.on('queue-empty', () => {
	if (!lastQueueWasEmpty) {
		api.broadcastEmptyQueue();
		lastQueueWasEmpty = true;
	}
});

ContentServer.on('queue-update', () => {
	api.broadcastQueue();
});

ContentServer.on('queued', (contentInfo) => {
	api.sendMessage(UserRecServ.getSockets(contentInfo.userId), 'upload', {
		title: contentInfo.music.title,
	});

	api.sendQueue(UserRecServ.getSockets(contentInfo.userId));
});

ContentServer.on('not-queued', (contentInfo, reason, content, message) => {
	api.sendError(UserRecServ.getSockets(contentInfo.userId), 'upload', {
		title: contentInfo.music.title,
		content: content,
		message: message,
		reason: reason,
		uniqueCoolOffStr: consts.uniqueCoolOffStr,
	});
});

module.exports = api;
