const debug = require('../lib/debug.js');
const WebSocketHandler = require('../lib/WebSocketHandler.js');

const ContentServer = require('./ContentServer.js');
const ProgressQueueServer = require('./ProgressQueueServer.js');
const UserRecServ = require('./UserRecordServer.js');

const consts = require('../lib/consts.js');
const utils = require('../lib/utils.js');

//really a namespace where all functions are hoisted
class Api {
	constructor() {
		this.wsh = new WebSocketHandler(onConnect.bind(this), onMessage.bind(this), onClose.bind(this), socToUserId.bind(this));

		//where clause:

		function onConnect(soc, id) {
			//save user
			UserRecServ.add(id);
			UserRecServ.setWS(id, soc);

			//notify if banned
			if (UserRecServ.isBanned(id)) this.sendBanned(soc);

			//tell user their nickname
			if (UserRecServ.isUser(id)) this.sendNickname(soc, UserRecServ.getNickname(id));

			//send queue
			this.sendQueue(soc);
			this.sendDlQueue(soc, id);
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

	sendDlQueue(soc, userId) {
		const queue = ProgressQueueServer.getQueue(userId);
		api.sendMessage(soc, 'dl-queue', queue);
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

ContentServer.on('queue-update', utils.throttle(consts.queueUpdateMaxFreq, () => {
	lastQueueWasEmpty = false;
	api.broadcastQueue();
}));

ContentServer.on('queued', (contentInfo) => {
	api.sendMessage(UserRecServ.getSockets(contentInfo.userId), 'upload', {
		title: contentInfo.music.title,
	});

	api.sendQueue(UserRecServ.getSockets(contentInfo.userId));
});

ContentServer.on('not-queued', (contentInfo, reason, contentType) => {
	api.sendError(UserRecServ.getSockets(contentInfo.userId), 'upload', {
		title: contentInfo.music.title,
		picTitle: contentInfo.pic.title,
		contentType: contentType,
		reason: reason,
		uniqueCoolOffStr: consts.uniqueCoolOffStr,
	});
});

ProgressQueueServer.on('add', (userId, content) => {
	api.sendMessage(UserRecServ.getSockets(userId), 'dl-add', content);
});

ProgressQueueServer.on('delete', (userId, contentId) => {
	api.sendMessage(UserRecServ.getSockets(userId), 'dl-delete', contentId);
});

ProgressQueueServer.on('error', (userId, contentId) => {
	api.sendMessage(UserRecServ.getSockets(userId), 'dl-error', contentId);
});

ProgressQueueServer.on('list', (userId, list) => {
	api.sendMessage(UserRecServ.getSockets(userId), 'dl-list', list);
});

module.exports = api;
