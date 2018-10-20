const debug = require('../lib/debug.js');
const WebSocketHandler = require('../lib/WebSocketHandler.js');

const ContentService = require('./ContentService.js');
const ProgressQueueService = require('./ProgressQueueService.js');
const UserRecordService = require('./UserRecordService.js');

const consts = require('../lib/consts.js');
const utils = require('../lib/utils.js');

//really a namespace where all functions are hoisted
class Api {
	constructor() {
		this.wsh = new WebSocketHandler(onConnect.bind(this), onMessage.bind(this), onClose.bind(this), socToUserId.bind(this));

		//where clause:

		function onConnect(soc, id) {
			//save user
			UserRecordService.add(id);
			UserRecordService.setWS(id, soc);

			//notify if banned
			if (UserRecordService.isBanned(id)) this.sendBanned(soc);

			//tell user their nickname
			if (UserRecordService.isUser(id)) this.sendNickname(soc, UserRecordService.getNickname(id));

			//send queue
			this.sendQueue(soc);
			this.sendDlQueue(soc, id);
		}

		function onMessage(soc, id, data, flags) {
			const dataObj = JSON.parse(data);

			if (dataObj.type === 'delete-content') {
				if (!ContentService.remove(this.wsh.socToUserId(soc), dataObj.contentId)) {
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
			UserRecordService.unsetWS(id, soc);
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

	sendNicknameToUser(userId, nickname) {
		const socs = UserRecordService.getSockets(userId);
		for (let soc of socs) this.sendNickname(soc, nickname);
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
		const queue = ProgressQueueService.getQueue(userId);
		api.sendMessage(soc, 'dl-list', queue);
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
			current: ContentService.getCurrentlyPlaying(),
			queue: ContentService.getBucketsForPublic(),
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
ContentService.on('queue-empty', () => {
	if (!lastQueueWasEmpty) {
		api.broadcastEmptyQueue();
		lastQueueWasEmpty = true;
	}
});

ContentService.on('queue-update', utils.throttle(consts.queueUpdateMaxFreq, () => {
	lastQueueWasEmpty = false;
	api.broadcastQueue();
}));

ProgressQueueService.on('prepared', (userId, content) => {
	api.sendMessage(UserRecordService.getSockets(userId), 'dl-prep', content);
});

ProgressQueueService.on('delete', (userId, contentId) => {
	const socs = UserRecordService.getSockets(userId);
	api.sendMessage(socs, 'dl-delete', contentId);
	api.sendQueue(socs); // also update the user's content queue to match
});

//extraInfo is an optional argument
ProgressQueueService.on('error', (userId, contentId, error, extraInfo) => {
	const data = {
		contentId,
		error,
		errorMessage: error.message,
		errorType: error.constructor.name
	};

	api.sendMessage(UserRecordService.getSockets(userId), 'dl-error', data);
});

ProgressQueueService.on('list', (userId, list) => {
	api.sendMessage( UserRecordService.getSockets(userId), 'dl-list', list);
});

module.exports = api;
