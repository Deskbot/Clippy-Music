/*
 * percentages are 0 to 1
 */
 
const debug = require('./debug.js');

const EventEmitter = require('events');

const opt = require('../options.js');
const utils = require('./utils.js');

class UploadDlManager extends EventEmitter {
	constructor() {
		super();

		this.queues = {};
		this.transmitIntervalIds = {};
	}

	add(userId, name) {
		if (!this.queues[userId]) {
			this.queues[userId] = [];
		}

		const queue = this.queues[userId];
		const newItem = {
			name,
			percent: 0
		};

		queue.push(newItem);

		if (this.queues[userId].length === 1) this.startTransmitting(userId);

		const deleter = () => {
			this.delete(userId, newItem);
		};

		const updater = (percent) => {
			newItem.percent = percent;
		};

		//return functions for updating and deleting
		return { deleter, updater }
	}

	delete(userId, what) {
		const userQueue = this.queue[userId];

		for (let i = 0; i < userQueue; i++) {
			let item = userQueue[i];
			if (item === what) {
				userQueue.splice(i, 1);
				break;
			}
		}

		this.maybeStopTransmitting(userId);
	}

	getQueue(userId) {
		return this.queues[userId];
	}

	maybeStopTransmitting(userId) {
		if (this.queues.length === 0) this.stopTransmitting(userId);
	}

	startTransmitting(userId) {
		const interval = setInterval(() => {
			this.transmit(userId);

			this.maybeStopTransmitting(userId);

		}, opt.dlPercentUpdateFreq);
	}

	stopTransmitting(userId) {;
		const inter = this.transmitIntervalIds[userId];
		delete this.transmitIntervalIds[userId];
		clearInterval(inter);
	}

	transmit(userId) {
		const queue = this.queues[userId];

		this.emit(userId, queue);

		debug.log("transmit file upload", userId, queue);

		UploadDlManager.removeDone(queue);

	}

	static removeDone(queue) {
		const toRemove = [];

		queue.forEach((elem, i) => {
			if (elem.percent === 1) toRemove.push(i);
		});

		utils.arrRemoveMany(queue, toRemove);
	}
}

module.exports = UploadDlManager;