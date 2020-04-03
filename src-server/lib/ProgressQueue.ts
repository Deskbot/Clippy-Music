/*
 * percentages are 0 to 1
 */

import { EventEmitter } from "events";

import * as opt from "../options";
import { QuickValuesMap } from "./utils/QuickValuesMap";
import { anyTrue } from "./utils/arrayUtils";
import { TypedEmitter } from "./utils/TypedEmitter";

export interface ProgressTracker {
	addCancelFunc(func: () => boolean): void;
	addProgressSource(source: () => number): void;
	cancel(): void;
	dontExpectProgressSource(): void;
	finished(): void;
	finishedWithError(err: any): void;
	getPercentComplete(): number;
	removeCancelFunc(func: () => boolean): void;
	removeProgressSource(func: () => number): void;
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

		const tracker = new ProgressTrackerImpl(newItem, 2);

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

interface ProgressTrackerEvents {
	error: (error: any) => void;
	finished: () => void;
	title: () => void;
}

class ProgressTrackerImpl extends (EventEmitter as TypedEmitter<ProgressTrackerEvents>) implements ProgressTracker {
	private cancelFuncs: (() => boolean)[];
	private item: PublicProgressItem;
	private maximumExpectedSources: number;
	private progressSources: (() => number)[];

	/**
	 * @param item The item being tracked.
	 *             Some of this data is modified to accomodate the expectations of the ProgressQueue,
	 *             however this is not ideal
	 * @param maximumExpectedSources The number of progress sources that are expected to be added.
	 */
	constructor(item: PublicProgressItem, maximumExpectedSources: number) {
		super();
		this.cancelFuncs = [];
		this.item = item;
		this.maximumExpectedSources = maximumExpectedSources;
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

	/**
	 * Tell the tracker to reduce the expected number of sources by one.
	 * Therefore the trackers knows there is less work needed to be done.
	 * This gives a more accurate percentage of work complete than to add a source at 100%.
	 */
	dontExpectProgressSource() {
		this.maximumExpectedSources--;
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
		return this.maximumExpectedSources === 0
			? 0
			: totalPercents / this.maximumExpectedSources;
	}

	removeCancelFunc(func: () => boolean) {
		const index = this.cancelFuncs.indexOf(func);
		this.cancelFuncs.splice(index, 1);
		this.item.cancellable = Boolean(this.cancelFuncs.length);
	}

	removeProgressSource(func: () => number) {
		const index = this.progressSources.indexOf(func);
		this.progressSources.splice(index, 1);
	}

	setTitle(title: string, temporary = false) {
		this.item.title = title;
		this.item.titleIsTemp = temporary;
		this.emit("title");
	}
}
