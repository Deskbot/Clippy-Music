/*
 * percentages are 0 to 1
 */

import { EventEmitter } from "events";

import * as opt from "../options";
import { QuickValuesMap } from "./utils/QuickValuesMap";
import { allTrue } from "./utils/arrayUtils";

interface PublicProgressItem {
	cancellable?: boolean;
	contentId: number;
	percent: number;
	title: string;
	titleIsTemp?: boolean;
	unprepared: boolean;
	userId: string;
}

export class ProgressQueue extends EventEmitter {
	private cancelFuncs: {
		[contentId: number]: (() => boolean)[]
	};
	private lastQueueLength: {
		[userId: string]: number
	};
	private percentGetters: {
		[contentId: number]: () => number
	};
	private queues: {
		[userId: string]: QuickValuesMap<number, PublicProgressItem> // number is contentId
	};
	private totalContents: number;
	private transmitIntervalId: NodeJS.Timeout | undefined;

	public emit(eventName: "delete", userId: string, contentId: number): boolean;
	public emit(eventName: "error", userId: string, contentId: number, error: Error): boolean;
	public emit(eventName: "list", userId: string, items: PublicProgressItem[]): boolean;
	public emit(eventName: "prepared", userId: string, item: PublicProgressItem): boolean;
	public emit(eventName: string, ...args: any[]): boolean {
		return super.emit(eventName, ...args);
	}

	public on(eventName: "delete", handler: (userId: string, contentId: number) => void): this;
	public on(eventName: "error", handler: (userId: string, contentId: number, error: Error) => void): this;
	public on(eventName: "list", handler: (userId: string, items: PublicProgressItem[]) => void): this;
	public on(eventName: "prepared", handler: (userId: string, item: PublicProgressItem) => void): this;
	public on(eventName: string, handler: (...args: any[]) => void): this {
		return super.on(eventName, handler);
	}

	constructor() {
		super();

		this.cancelFuncs = {};
		this.lastQueueLength = {};
		this.percentGetters = {};
		this.queues = {};
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

	addCancelFunc(userId: string, contentId: number, func: () => boolean) {
		const item = this.findQueueItem(userId, contentId);
		if (item) {
			item.cancellable = true;
			if (!this.cancelFuncs[contentId]) {
				this.cancelFuncs[contentId] = [func]
			} else {
				this.cancelFuncs[contentId].push(func);
			}
		}
	}

	addPercentageGetter(contentId: number, func: () => number) {
		this.percentGetters[contentId] = func;
	}

	cancel(userId: string, contentId: number) {
		if (this.cancelFuncs[contentId]) {
			const successes = this.cancelFuncs[contentId].map(func => func());
			if (allTrue(successes)) {
				this.finished(userId, contentId);
				return true;
			}
		}
		return false;
	}

	private deleteQueueItem(item: PublicProgressItem) {
		delete this.percentGetters[item.contentId];
		delete this.cancelFuncs[item.contentId];
		const queueMap = this.queues[item.userId];

		queueMap.delete(item.contentId);
		this.totalContents--;

	}

	private findQueueItem(userId: string, contentId: number): PublicProgressItem | undefined {
		const queueMap = this.queues[userId];

		if (!queueMap) return undefined;

		return queueMap.get(contentId);
	}

	finished(userId: string, contentId: number) {
		this.deleteQueueItem(this.findQueueItem(userId, contentId) as PublicProgressItem);
		this.emit("delete", userId, contentId);
	}

	finishedWithError(userId: string, contentId: number, error: Error) {
		this.deleteQueueItem(this.findQueueItem(userId, contentId) as PublicProgressItem);
		this.emit("error", userId, contentId, error);
	}

	getQueue(userId: string): PublicProgressItem[] | undefined {
		const queueMap = this.queues[userId];

		if (queueMap) return queueMap.valuesQuick();

		return undefined;
	}

	/* emits a "prepared" event when the item has all the data needed
	 * for Clippy to talk to the user about the item by name
	 */
	private maybeItemIsPrepared(item: PublicProgressItem) {
		if (item.unprepared && item.title && !item.titleIsTemp) {
			delete item.unprepared;
			delete item.titleIsTemp;
			this.emit("prepared", item.userId, item);
		}
	}

	removeCancelFunc(userId: string, contentId: number, func: () => boolean) {
		const item = this.findQueueItem(userId, contentId);
		if (item && this.cancelFuncs[contentId]) {
			const funcs = this.cancelFuncs[contentId];
			const index = funcs.indexOf(func);
			funcs.splice(index, 1);
			item.cancellable = Boolean(funcs.length);
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
		this.transmitIntervalId = setInterval(
			() => this.transmit(),
			opt.dlPercentUpdateFreq
		);
	}

	stopTransmitting() {
		if (this.transmitIntervalId !== undefined) {
			clearInterval(this.transmitIntervalId);
		}

		this.transmitIntervalId = undefined;
	}

	private transmit() {
		if (this.totalContents === 0) return;

		for (let userId in this.queues) {
			this.transmitToUserMaybe(userId);
		}
	}

	private transmitToUserMaybe(userId: string) {
		const queueMap = this.queues[userId];
		const queueLength = queueMap.size;

		if (queueLength > 0 || this.lastQueueLength[userId] > 0) {
			this.updateQueue(queueMap);
			this.emit("list", userId, queueMap.valuesQuick());
			this.lastQueueLength[userId] = queueLength;
		}
	}

	private updateQueue(queueMap: QuickValuesMap<number, PublicProgressItem>) {
		for (const item of queueMap.valuesQuick()) {
			if (this.percentGetters[item.contentId]) {
				item.percent = this.percentGetters[item.contentId]();
			}
		}
	}
}
