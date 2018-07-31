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

		this.autoUpdateFuncs = [];
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

		const newProgressId = this.idFactory.new();

		const newItem = {
			title,
			percent: 0,
			contentId,
		};

		this.queues[userId].push(newItem);
		this.totalContents++;
	}

	addAutoUpdate(userId, contentId, func) {
		const item = this.findQueueItem(userId, contentId);

		item.autoUpdate = func;
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

	delete(userId, contentId) {
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
	
	emitQueue(userId) {
		this.emit('progress-update', userId);
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

	//more idiomatic for the outside world, emitQueue would be private ideally
	forceEmit(userId) {
		this.emitQueue(userId);
	}

	getQueue(userId) {
		const queue = this.queues[userId];

		for (let item of queue) {
			if (item.autoUpdate) item.autoUpdate();
		}

		return this.queues[userId];
	}

	removeAutoUpdate(userId, contentId) {
		const item = this.findQueueItem(userId, contentId);
		delete item.autoUpdate;
	}

	startTransmitting() {
		this.transmitIntervalId = setInterval(() => {
			if (this.totalContents === 0) return;
			
			for (let userId in this.queues) {
				let queueLength = this.queues[userId].length;
				if (queueLength > 0 || this.lastQueueLength[userId] > 0) {
					this.emitQueue(userId);
					this.lastQueueLength[userId] = queueLength;
				}
			}

		}, opt.dlPercentUpdateFreq);
	}

	stopTransmitting() {
		clearInterval(this.transmitIntervalId);
		this.transmitIntervalId = null;
	}
}

module.exports = ProgressQueue;