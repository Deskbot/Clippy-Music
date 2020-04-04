/*
 * percentages are 0 to 1
 */

import { EventEmitter } from "events";

import * as opt from "../options";
import { QuickValuesMap } from "./utils/QuickValuesMap";
import { anyTrue } from "./utils/arrayUtils";
import { TypedEmitter } from "./utils/TypedEmitter";

export interface ProgressSource {
	cancel(): boolean;
	done(): void;
	setCancelFunc(func: () => boolean): void;
	getPercent(): number;
	setPercentGetter(getter: (() => number) | undefined): void;
	ignore(): void;
	ignoreIfNoPercentGetter(): void;
	isDone: boolean;
	isIgnored: boolean;
}

export interface ProgressTracker {
	cancel(): boolean;
	createSource(): ProgressSource;
	finished(): void;
	finishedWithError(err: any): void;
	getPercentComplete(): number;
	setTitle(title: string, temporary?: boolean): void;
}

interface PublicProgressItem {
	cancellable?: boolean;
	contentId: number;
	percent: number;
	title: string;
	titleIsTemp: boolean;
	userId: string;
}

interface ProgressQueueEvents {
	delete: (userId: string, contentId: number) => void;
	error: (userId: string, contentId: number, error: Error) => void;
	list: (userId: string, items: PublicProgressItem[]) => void;
	prepared: (userId: string, title: string) => void;
}

export class ProgressQueue extends (EventEmitter as TypedEmitter<ProgressQueueEvents>) {
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

	constructor() {
		super();

		this.lastQueueLength = {};
		this.progressTrackers = {};
		this.queues = {};
		this.totalContents = 0;
		this.transmitIntervalId = undefined;
	}

	add(userId: string, contentId: number): ProgressTrackerImpl {
		if (!this.queues[userId]) {
			this.queues[userId] = new QuickValuesMap();
		}

		const newItem: PublicProgressItem = {
			contentId,
			percent: 0,
			title: "",
			titleIsTemp: false,
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

class ProgressSourceImpl implements ProgressSource {
	private cancelFunc?: () => boolean;
	private percentGetter?: () => number;

	private _isDone: boolean;
	private _isIgnored: boolean;

	constructor() {
		this._isDone = false;
		this._isIgnored = false;
	}

	cancel(): boolean {
		if (this._isDone) {
			return false;
		}

		if (this.cancelFunc) {
			return this.cancelFunc();
		}

		return false;
	}

	done(): void {
		this._isDone = true;
	}

	getPercent(): number {
		if (this.percentGetter) {
			return this.percentGetter();
		}

		return 0;
	}

	ignore(): void {
		this._isDone = true;
		this._isIgnored = true;
	}

	ignoreIfNoPercentGetter(): void {
		if (!this.percentGetter) {
			this.ignore();
		}
	}

	setCancelFunc(func: () => boolean): void {
		this.cancelFunc = func;
	}

	setPercentGetter(func: (() => number) | undefined): void {
		this.percentGetter = func;
	}

	get isDone(): boolean {
		return this._isDone;
	}

	get isIgnored(): boolean {
		return this._isIgnored;
	}
}

interface ProgressTrackerEvents {
	error: (error: any) => void;
	finished: () => void;
	title: () => void;
}

class ProgressTrackerImpl extends (EventEmitter as TypedEmitter<ProgressTrackerEvents>) implements ProgressTracker {
	private item: PublicProgressItem;
	private progressSources: ProgressSource[];

	/**
	 * @param item The item being tracked.
	 *             Some of this data is modified to accomodate the expectations of the ProgressQueue,
	 *             however this is not ideal
	 * @param maximumExpectedSources The number of progress sources that are expected to be added.
	 */
	constructor(item: PublicProgressItem) {
		super();
		this.item = item;
		this.progressSources = [];
	}

	cancel() {
		const successes = this.progressSources.map(source => source.cancel());
		if (anyTrue(successes)) {
			this.finished();
			return true;
		}

		return false;
	}

	createSource(): ProgressSource {
		const source = new ProgressSourceImpl();
		this.progressSources.push(source);
		return source;
	}

	finished() {
		this.emit("finished");
	}

	finishedWithError(error: any) {
		this.emit("error", error);
	}

	getPercentComplete() {
		console.log(this.progressSources);
		console.log(this.progressSources.filter(source => !source.isIgnored));
		console.log(this.progressSources
			.filter(source => !source.isIgnored)
			.map(source => source.getPercent()));

		const totalPercents = this.progressSources
			.filter(source => !source.isIgnored)
			.map(source => source.getPercent())
			.reduce((a, b) => a + b, 0);
		return this.progressSources.length === 0
			? 0
			: totalPercents / this.progressSources.length;
	}

	setTitle(title: string, temporary = false) {
		this.item.title = title;
		this.item.titleIsTemp = temporary;
		this.emit("title");
	}
}
