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
		this.queues = {};
		this.totalContents = 0;
		this.transmitIntervalId = null;
	}

	add(userId, contentId, title) {
		if (!this.queues[userId]) {
			this.queues[userId] = [];
		}

		const newItem = {
			contentId,
			percent: 0,
			title: title || '',
			unprepared: true,
		};

		this.queues[userId].push(newItem);
		this.totalContents++;

		this.maybeItemIsPrepared(userId, newItem);
	}

	addAutoUpdate(userId, contentId, func) {
		const item = this.findQueueItem(userId, contentId);

		item.autoUpdate = func;
	}

	autoUpdateQueue(queue) {
		for (let item of queue) {
			if (item.autoUpdate) item.autoUpdate();
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

	deleteQueueItem(userId, contentId) {
		const queue = this.queues[userId];
		
		for (let i = 0; i < queue.length; i++) {
			let item = queue[i];

			if (item.contentId === contentId) {
				queue.splice(i, 1);
				this.totalContents--;
				break;
			}
		}
	}

	findQueueItem(userId, contentId) {
		const queue = this.queues[userId];

		if (!queue) return;

		let targetItem;

		for (let item of queue) {
			if (item.contentId === contentId) {
				targetItem = item;
			}
		}

		return targetItem;
	}

	finished(userId, contentId) {
		this.deleteQueueItem(userId, contentId);
		this.emit('delete', userId, contentId);
	}

	finishedWithError(userId, contentId, error) {
		this.deleteQueueItem(userId, contentId);
		this.emit('error', userId, contentId, error);
	}

	getQueue(userId) {
		const queue = this.queues[userId];

		return this.queues[userId] || [];
	}

	/* emits a 'prepared' event when the item has all the data needed
	 * for Clippy to talk to the user about the item by name
	 */
	maybeItemIsPrepared(userId, item) {
		if (item.unprepared && item.title && !item.titleIsTemp) {
			delete item.unprepared;
			delete item.titleIsTemp;
			this.emit('prepared', userId, item);
		}
	}

	removeAutoUpdate(userId, contentId) {
		const item = this.findQueueItem(userId, contentId);
		delete item.autoUpdate;
	}

	setTitle(userId, contentId, title, temporary=false) {
		const item = this.findQueueItem(userId, contentId);
		item.title = title;
		item.titleIsTemp = temporary;

		this.maybeItemIsPrepared(userId, item); // might have just gained all the data needed

		this.transmitToUser(userId);
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
			this.transmitToUser(userId);
		}
	}

	transmitToUser(userId) {
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