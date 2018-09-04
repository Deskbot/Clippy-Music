/*
 * percentages are 0 to 1
 */
 
const debug = require('./debug.js');

const EventEmitter = require('events');

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
			title,
			percent: 0,
			contentId,
		};

		this.queues[userId].push(newItem);
		this.totalContents++;

		this.emit('add', userId, newItem);
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
				targetItem.percent = percent;
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

	finishedWithError(userId, contentId) {
		this.deleteQueueItem(userId, contentId);
		this.emit('error', userId, contentId);
	}

	getQueue(userId) {
		const queue = this.queues[userId];

		return this.queues[userId] || [];
	}

	removeAutoUpdate(userId, contentId) {
		const item = this.findQueueItem(userId, contentId);
		delete item.autoUpdate;
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
			const queue = this.queues[userId];
			const queueLength = queue.length;

			if (queueLength > 0 || this.lastQueueLength[userId] > 0) {
				this.autoUpdateQueue(queue);
				this.emit('list', userId, queue);
				this.lastQueueLength[userId] = queueLength;
			}
		}
	}
}

module.exports = ProgressQueue;