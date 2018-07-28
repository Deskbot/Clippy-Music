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
		this.queues = {};
		this.totalContents = 0;
		this.transmitIntervalId = null;
	}

	add(userId, title) {
		if (!this.queues[userId]) {
			this.queues[userId] = [];
		}

		const newProgressId = this.idFactory.new();

		const newItem = {
			title,
			percent: 0,
			progId: newProgressId,
		};

		this.queues[userId].push(newItem);
		this.totalContents++;

		return newProgressId;
	}

	addAutoUpdate(func) {
		this.autoUpdateFuncs.push(func);
	}

	autoUpdate() {
		this.autoUpdateFuncs.forEach((func) => {
			func();
		});
	}

	delete(userId, progId) {
		const queue = this.queues[userId];

		for (let i = 0; i < queue.length; i++) {
			let item = queue[i];

			if (item.progId === progId) {
				queue.splice(i, 1);
				this.totalContents--;
				break;
			}
		}
	}
	
	emitQueue(userId) {
		const queue = this.queues[userId];

		this.emit('percent-update', userId, queue);
	}

	getUpdater(userId, progId) {
		//find the target queue item

		const queue = this.queues[userId];

		let targetItem;

		for (let elem of queue) {
			if (elem.progId === progId) {
				targetItem = elem;
			}
		}

		if (targetItem) {
			//hold on to the reference
			return (percent) => {
				targetItem.percent = percent;
			};
		} else {
			return null;
		}
	}

	startTransmitting() {
		this.transmitIntervalId = setInterval(() => {
			this.autoUpdate();

			if (this.totalContents === 0) return;

			for (let userId in this.queues) {
				if (this.queues[userId].length > 0) {
					this.emitQueue(userId);
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