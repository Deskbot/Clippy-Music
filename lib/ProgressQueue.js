/*
 * percentages are 0 to 1
 */

const debug = require('./debug.js');

const EventEmitter = require('events');

const consts = require('./consts.js');
const opt = require('../options.js');
const utils = require('./utils.js');

class ProgressQueue extends EventEmitter {

	constructor(idFactory) {
		super();

		this.idFactory = idFactory;
		this.lastQueueLength = {};
		this.queues = {}; // userId -> Map<contentId, progress item>
		this.totalContents = 0;
		this.transmitIntervalId = null;
	}

	add(userId, contentId, title) {
		if (!this.queues[userId]) {
			this.queues[userId] = new Map();
		}

		const newItem = {
			contentId,
			percent: 0,
			title: title || '',
			unprepared: true,
			userId
		};

		this.queues[userId].set(contentId, newItem);
		this.totalContents++;

		this.maybeItemIsPrepared(newItem);
	}

	addAutoUpdate(userId, contentId, func) {
		const item = this.findQueueItem(userId, contentId);
		if (item) item.autoUpdate = func;
	}

	addCancelFunc(userId, contentId, func) {
		const item = this.findQueueItem(userId, contentId);
		if (item) {
			item.cancellable = true;
			item.cancelFunc = func;
		}
	}

	autoUpdateQueue(queue) {
		for (let item of queue) {
			if (item.autoUpdate) item.autoUpdate();
		}
	}

	cancel(userId, contentId) {
		const item = this.findQueueItem(userId, contentId);
		if (item && item.cancelFunc) {
			const success = item.cancelFunc();
			if (success) this.finished(userId, contentId);
			return success;
		}
	}

	createUpdater(userId, contentId) {
		//find the target queue item
		const targetItem = this.findQueueItem(userId, contentId);

		if (targetItem) {
			//hold on to the reference
			return (percent) => {
				targetItem.percent = percent * consts.maxPercentBeforeFinished;
			};
		} else {
			return utils.doNothing;
		}
	}

	// internal
	deleteQueueItem(item) {
		const queueMap = this.queues[item.userId];

		queueMap.delete(item.contentId);
		this.totalContents--;
	}

	// internal
	findQueueItem(userId, contentId) {
		const queueMap = this.queues[userId];

		if (!queueMap) return;

		return queueMap.get(contentId);
	}

	finished(userId, contentId) {
		this.deleteQueueItem(this.findQueueItem(userId, contentId));
		this.emit('delete', userId, contentId);
	}

	finishedWithError(userId, contentId, error) {
		this.deleteQueueItem(this.findQueueItem(userId, contentId));
		this.emit('error', userId, contentId, error);
	}

	getQueue(userId) {
		const queue = this.queues[userId];

		if (queue) return [...queue.values()];
		return;
	}

	/* emits a 'prepared' event when the item has all the data needed
	 * for Clippy to talk to the user about the item by name
	 */
	maybeItemIsPrepared(item) {
		if (item.unprepared && item.title && !item.titleIsTemp) {
			delete item.unprepared;
			delete item.titleIsTemp;
			this.emit('prepared', item.userId, item);
		}
	}

	setTitle(userId, contentId, title, temporary=false) {
		const item = this.findQueueItem(userId, contentId);
		item.title = title;
		item.titleIsTemp = temporary;

		this.maybeItemIsPrepared(item); // might have just gained all the data needed

		this.transmitToUserMaybe(userId);
	}

	startTransmitting() {
		this.transmitIntervalId = setInterval(this.transmit.bind(this), opt.dlPercentUpdateFreq);
	}

	stopTransmitting() {
		clearInterval(this.transmitIntervalId);
		this.transmitIntervalId = null;
	}

	transmit() {
		if (this.totalContents === 0) return;

		for (let userId in this.queues) {
			this.transmitToUserMaybe(userId);
		}
	}

	transmitToUserMaybe(userId) {
		const queue = this.queues[userId];
		const queueLength = queue.length;

		if (queueLength > 0 || this.lastQueueLength[userId] > 0) {
			this.autoUpdateQueue(queue);
			this.emit('list', userId, queue);
			this.lastQueueLength[userId] = queueLength;
		}
	}
}

module.exports = ProgressQueue;