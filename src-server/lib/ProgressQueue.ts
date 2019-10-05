/*
 * percentages are 0 to 1
 */

import { EventEmitter } from "events";

import * as consts from "../consts";
import * as opt from "../options";
import * as utils from "./utils/utils";

import { QuickValuesMap } from "./utils/QuickValuesMap";

interface ProgressItem {
	autoUpdate?: Function;
	cancellable?: boolean;
	cancelFunc?: Function;
	contentId: number;
	percent: number;
	title: string;
	titleIsTemp?: boolean;
	unprepared: boolean;
	userId: string;
}

export class ProgressQueue extends EventEmitter {
	private lastQueueLength: {
		[userId: string]: number
	};
	private queues: {
		[userId: string]: QuickValuesMap<number, ProgressItem>
	};
	private totalContents: number;
	private transmitIntervalId: NodeJS.Timeout | undefined;

	constructor() {
		super();

		this.lastQueueLength = {};
		this.queues = {}; // userId -> QuickValuesMap<contentId, progress item>
		this.totalContents = 0;
		this.transmitIntervalId = undefined;
	}

	add(userId: string, contentId: number, title?: string) {
		if (!this.queues[userId]) {
			this.queues[userId] = new QuickValuesMap();
		}

		const newItem = {
			contentId,
			percent: 0,
			title: title || "",
			unprepared: true,
			userId
		};

		this.queues[userId].set(contentId, newItem);
		this.totalContents++;

		this.transmitToUserMaybe(userId);
		this.maybeItemIsPrepared(newItem);
	}

	addAutoUpdate(userId: string, contentId: number, func: Function) {
		const item = this.findQueueItem(userId, contentId);
		if (item) item.autoUpdate = func;
	}

	addCancelFunc(userId: string, contentId: number, func: Function) {
		const item = this.findQueueItem(userId, contentId);
		if (item) {
			item.cancellable = true;
			item.cancelFunc = func;
		}
	}

	autoUpdateQueue(queueMap: QuickValuesMap<unknown, ProgressItem>) {
		for (let item of queueMap.valuesQuick()) {
			if (item.autoUpdate) item.autoUpdate();
		}
	}

	cancel(userId: string, contentId: number) {
		const item = this.findQueueItem(userId, contentId);
		if (item && item.cancelFunc) {
			const success = item.cancelFunc();
			if (success) this.finished(userId, contentId);
			return success;
		}
	}

	createUpdater(userId: string, contentId: number): (percent: number) => void {
		//find the target queue item
		const targetItem = this.findQueueItem(userId, contentId);

		if (targetItem) {
			//hold on to the reference
			return percent => {
				targetItem.percent = percent * consts.maxPercentBeforeFinished;
			};
		} else {
			return utils.doNothing;
		}
	}

	deleteQueueItem(item: ProgressItem) {
		const queueMap = this.queues[item.userId];

		queueMap.delete(item.contentId);
		this.totalContents--;
	}

	findQueueItem(userId: string, contentId: number): ProgressItem | undefined {
		const queueMap = this.queues[userId];

		if (!queueMap) return undefined;

		return queueMap.get(contentId);
	}

	finished(userId: string, contentId: number) {
		this.deleteQueueItem(this.findQueueItem(userId, contentId) as ProgressItem);
		this.emit("delete", userId, contentId);
	}

	finishedWithError(userId: string, contentId: number, error: Error) {
		this.deleteQueueItem(this.findQueueItem(userId, contentId) as ProgressItem);
		this.emit("error", userId, contentId, error);
	}

	getQueue(userId: string): ProgressItem[] | undefined {
		const queueMap = this.queues[userId];

		if (queueMap) return queueMap.valuesQuick();

		return undefined;
	}

	/* emits a "prepared" event when the item has all the data needed
	 * for Clippy to talk to the user about the item by name
	 */
	maybeItemIsPrepared(item: ProgressItem) {
		if (item.unprepared && item.title && !item.titleIsTemp) {
			delete item.unprepared;
			delete item.titleIsTemp;
			this.emit("prepared", item.userId, item);
		}
	}

	setTitle(userId: string, contentId: number, title: string, temporary=false) {
		const item = this.findQueueItem(userId, contentId);

		if (!item) {
			console.error(`Item in progress not found (${item}), content with id "${contentId}" for user "${userId}"`);
			return;
		}

		item.title = title;
		item.titleIsTemp = temporary;

		this.maybeItemIsPrepared(item); // might have just gained all the data needed
		this.transmitToUserMaybe(userId);
	}

	startTransmitting() {
		this.transmitIntervalId = setInterval(this.transmit.bind(this), opt.dlPercentUpdateFreq);
	}

	stopTransmitting() {
		// if the argument to clearInterval can be undefined,
		// TypeScript thinks clearInterval is the browser implementation,
		// which can't take NodeJS.Timeout, which is what setTimeout returns in NodeJS
		if (this.transmitIntervalId !== undefined) {
			clearInterval(this.transmitIntervalId);
		}

		this.transmitIntervalId = undefined;
	}

	transmit() {
		if (this.totalContents === 0) return;

		for (let userId in this.queues) {
			this.transmitToUserMaybe(userId);
		}
	}

	transmitToUserMaybe(userId: string) {
		const queueMap = this.queues[userId];
		const queueLength = queueMap.size;

		if (queueLength > 0 || this.lastQueueLength[userId] > 0) {
			this.autoUpdateQueue(queueMap);
			this.emit("list", userId, queueMap.valuesQuick());
			this.lastQueueLength[userId] = queueLength;
		}
	}
}
