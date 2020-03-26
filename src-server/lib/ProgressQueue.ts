/*
 * percentages are 0 to 1
 */

import { EventEmitter } from "events";

import * as opt from "../options";
import { QuickValuesMap } from "./utils/QuickValuesMap";
import { anyTrue } from "./utils/arrayUtils";

export interface ProgressTracker {
	addCancelFunc(func: () => boolean): void;
	addProgressSource(source: () => number): void;
	cancel(): void;
	finished(): void;
	finishedWithError(err: any): void;
	getPercentComplete(): number;
	removeCancelFunc(func: () => boolean): void;
	setTitle(title: string, temporary?: boolean): void;
}

interface PublicProgressItem {
	cancellable?: boolean;
	contentId: number;
	percent: number;
	title: string;
	titleIsTemp?: boolean;
	userId: string;
}

export class ProgressQueue extends EventEmitter {
	private lastQueueLength: {
		[userId: string]: number | undefined
	};
	private queues: {
		[userId: string]: QuickValuesMap<number, PublicProgressItem> | undefined // number is contentId
	};
	private progressTrackers: {
		[userId: string]: QuickValuesMap<number, ProgressTracker> | undefined // number is contentId
	};
	private totalContents: number;
	private transmitIntervalId: NodeJS.Timeout | undefined;

	public emit(eventName: "delete", userId: string, contentId: number): boolean;
	public emit(eventName: "error", userId: string, contentId: number, error: Error): boolean;
	public emit(eventName: "list", userId: string, items: PublicProgressItem[]): boolean;
	public emit(eventName: "prepared", userId: string, title: string): boolean;
	public emit(eventName: string, ...args: any[]): boolean {
		return super.emit(eventName, ...args);
	}

	public on(eventName: "delete", handler: (userId: string, contentId: number) => void): this;
	public on(eventName: "error", handler: (userId: string, contentId: number, error: Error) => void): this;
	public on(eventName: "list", handler: (userId: string, items: PublicProgressItem[]) => void): this;
	public on(eventName: "prepared", handler: (userId: string, title: string) => void): this;
	public on(eventName: string, handler: (...args: any[]) => void): this {
		return super.on(eventName, handler);
	}

	constructor() {
		super();

		this.lastQueueLength = {};
		this.progressTrackers = {};
		this.queues = {};
		this.totalContents = 0;
		this.transmitIntervalId = undefined;
	}

	add(userId: string, contentId: number, title?: string): ProgressTrackerImpl {
		if (!this.queues[userId]) {
			this.queues[userId] = new QuickValuesMap();
		}

		const newItem: PublicProgressItem = {
			contentId,
			percent: 0,
			title: title || "",
			userId,
		};

		this.queues[userId]!.set(contentId, newItem);
		this.totalContents++;

		this.transmitToUserMaybe(userId);
		this.maybeItemIsPrepared(newItem);

		const tracker = new ProgressTrackerImpl(newItem);

		tracker.on("error", (error) => {
			this.deleteQueueItem(this.findQueueItem(userId, contentId)!);
			this.emit("error", userId, contentId, error);
		});

		tracker.on("finished", () => {
			this.deleteQueueItem(this.findQueueItem(userId, contentId)!);
			this.emit("delete", userId, contentId);
		});

		tracker.on("title", () => {
			// might have just gained all the data needed
			this.maybeItemIsPrepared(newItem);
			this.transmitToUserMaybe(userId);
		});

		this.setTracker(userId, contentId, tracker);

		return tracker;
	}

	private deleteQueueItem(item: PublicProgressItem) {
		const progressTrackers = this.progressTrackers[item.userId];

		if (progressTrackers) {
			progressTrackers.delete(item.contentId);
		}

		const queueMap = this.queues[item.userId];

		if (queueMap) {
			queueMap.delete(item.contentId);
		}

		this.totalContents--;
	}

	private findQueueItem(userId: string, contentId: number): PublicProgressItem | undefined {
		const queueMap = this.queues[userId];

		if (!queueMap) return undefined;

		return queueMap.get(contentId);
	}

	getQueue(userId: string): PublicProgressItem[] | undefined {
		const queueMap = this.queues[userId];

		if (queueMap) return queueMap.valuesQuick();

		return undefined;
	}

	getTracker(userId: string, contentId: number): ProgressTracker | undefined {
		return this.progressTrackers[userId]?.get(contentId);
	}

	/* emits a "prepared" event when the item has all the data needed
	 * for Clippy to talk to the user about the item by name
	 */
	private maybeItemIsPrepared(item: PublicProgressItem) {
		if (item.title && !item.titleIsTemp) {
			this.emit("prepared", item.userId, item.title);
		}
	}

	private setTracker(userId: string, contentId: number, tracker: ProgressTracker) {
		if (!this.progressTrackers[userId]) {
			this.progressTrackers[userId] = new QuickValuesMap();
		}

		this.progressTrackers[userId]!.set(contentId, tracker);
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
		const queueMap = this.queues[userId]!;
		const queueLength = queueMap.size;

		const lastQueueLength = this.lastQueueLength[userId];

		if (queueLength > 0 || (lastQueueLength && lastQueueLength > 0)) {
			this.updateQueue(userId);
			this.emit("list", userId, queueMap.valuesQuick());
			this.lastQueueLength[userId] = queueLength;
		}
	}

	private updateQueue(userId: string) {
		const queueMap = this.queues[userId];
		const trackersMap = this.progressTrackers[userId];

		if (!trackersMap || !queueMap) {
			return;
		}

		for (const item of queueMap.valuesQuick()) {
			const tracker = trackersMap.get(item.contentId);
			if (tracker) {
				item.percent = tracker.getPercentComplete();
			}
		}
	}
}

class ProgressTrackerImpl extends EventEmitter {
	private cancelFuncs: (() => boolean)[];
	private item: PublicProgressItem;
	private progressSources: (() => number)[];

	emit(eventName: "error", error: any): boolean;
	emit(eventName: "finished"): boolean;
	emit(eventName: "title"): boolean;
	emit(eventName: string, ...args: any[]) {
		return super.emit(eventName, ...args);
	}

	on(eventName: "error", handler: (error: any) => void): this;
	on(eventName: "finished", handler: () => void): this;
	on(eventName: "title", handler: () => void): this;
	on(eventName: string, hander: (...args: any[]) => void) {
		return super.on(eventName, hander);
	}

	constructor(item: PublicProgressItem) {
		super();
		this.cancelFuncs = [];
		this.item = item;
		this.progressSources = [];
	}

	addCancelFunc(func: () => boolean) {
		this.item.cancellable = true;
		this.cancelFuncs.push(func);
	}

	addProgressSource(getProgress: () => number) {
		this.progressSources.push(getProgress);
	}

	cancel() {
		const successes = this.cancelFuncs.map(func => func());
		if (anyTrue(successes)) {
			this.finished();
			return true;
		}

		return false;
	}

	finished() {
		this.emit("finished");
	}

	finishedWithError(error: any) {
		this.emit("error", error);
	}

	getPercentComplete() {
		const totalPercents = this.progressSources.map(func => func())
			.reduce((a, b) => a + b, 0);
		return totalPercents / this.progressSources.length;
	}

	removeCancelFunc(func: () => boolean) {
		const index = this.cancelFuncs.indexOf(func);
		this.cancelFuncs.splice(index, 1);
		this.item.cancellable = Boolean(this.cancelFuncs.length);
	}

	setTitle(title: string, temporary = false) {
		this.item.title = title;
		this.item.titleIsTemp = temporary;
		this.emit("title");
	}
}
