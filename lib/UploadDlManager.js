/*
 * percentages are 0 to 1
 */

const EventEmitter = require('events');

const opt = require('../options.js');
const utils = require('./utils.js');

class UploadDlManager extends EventEmitter {
	constructor() {
		super();

		this.queues = {};
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

		//return a function for updating the percentage
		return (percent) => {
			newItem.percent = percent;
		};
	}

	getQueue(userId) {
		return this.queues[userId];
	}

	startTransmitting(userId) {
		const interval = setInterval(() => {
			this.transmit(userId);

			if (this.queues[userId].length === 0) clearInterval(interval);

		}, opt.dlPercentUpdateFreq);
	}

	transmit(userId) {
		const queue = this.queues[userId];

		this.emit(userId, queue);

		console.log(userId, queue);

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