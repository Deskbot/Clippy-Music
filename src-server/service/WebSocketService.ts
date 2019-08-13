import * as debug from '../lib/debug';
import { WebSocketHandler } from '../lib/WebSocketHandler';

import { ContentManagerService as ContentService } from './ContentService';
import { ProgressQueueService } from './ProgressQueueService';
import { UserRecordService } from './UserRecordService';

//really a namespace where all functions are hoisted
class Api {
	private wsh;

	constructor() {
		const onConnect = (soc, id) => {
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

		const onMessage = (soc, id, data, flags) => {
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

		const onClose = (soc, id) => {
			UserRecordService.unsetWS(id, soc);
		}

		const socToUserId = (soc) => {
			return soc._socket.remoteAddress;
		}

		this.wsh = new WebSocketHandler(
			onConnect,
			onMessage,
			onClose,
			socToUserId,
		);
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
		if (queue) WebSocketService.sendMessage(soc, 'dl-list', queue);
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

export const WebSocketService = new Api();

let lastQueueWasEmpty = false;
ContentService.on('queue-empty', () => {
	if (!lastQueueWasEmpty) {
		WebSocketService.broadcastEmptyQueue();
		lastQueueWasEmpty = true;
	}
});

ContentService.on('queue-update', () => {
	lastQueueWasEmpty = false;
	WebSocketService.broadcastQueue();
});

ProgressQueueService.on('prepared', (userId, content) => {
	WebSocketService.sendMessage(UserRecordService.getSockets(userId), 'dl-prep', content);
});

ProgressQueueService.on('delete', (userId, contentId) => {
	const socs = UserRecordService.getSockets(userId);
	WebSocketService.sendMessage(socs, 'dl-delete', contentId);
});

//extraInfo is an optional argument
ProgressQueueService.on('error', (userId, contentId, error, extraInfo) => {
	const data = {
		contentId,
		error,
		errorMessage: error.message,
		errorType: error.constructor.name
	};

	WebSocketService.sendMessage(UserRecordService.getSockets(userId), 'dl-error', data);
});

ProgressQueueService.on('list', (userId, list) => {
	WebSocketService.sendMessage(UserRecordService.getSockets(userId), 'dl-list', list);
});
