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
		this.queues = {};
		this.transmitIntervalIds = {};
	}

	add(userId, title) {
		if (!this.queues[userId]) {
			this.queues[userId] = [];
		}

		const queue = this.queues[userId];
		const newItem = {
			title,
			percent: 0,
			progId: this.idFactory.new(),
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
		return { deleter, updater };
	}

	delete(userId, what) {
		const userQueue = this.queues[userId];

		for (let i = 0; i < userQueue.length; i++) {
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
		if (this.queues[userId] && this.queues[userId].length === 0)
			this.stopTransmitting(userId);
	}

	startTransmitting(userId) {
		const intervalId = setInterval(() => {
			this.transmit(userId);

			this.maybeStopTransmitting(userId);

		}, opt.dlPercentUpdateFreq);

		this.transmitIntervalIds[userId] = intervalId;
	}

	stopTransmitting(userId) {;
		const inter = this.transmitIntervalIds[userId];
		delete this.transmitIntervalIds[userId];
		clearInterval(inter);
	}

	transmit(userId) {
		const queue = this.queues[userId];

		this.emit('percent-update', userId, queue);

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

module.exports = ProgressQueue;