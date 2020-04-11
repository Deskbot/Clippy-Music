/**
 * This file contains interfaces and classes to enable tracking information about an upload,
 * while the request is being processed so it can be queued.
 * This information can all change over time. It includes:
 *     percent complete
 *     title
 *     whether the upload can be cancelled
 */

import { EventEmitter } from "events";

import * as opt from "../options";
import { QuickValuesMap } from "./utils/QuickValuesMap";
import { anyTrue } from "./utils/arrayUtils";
import { TypedEmitter } from "./utils/TypedEmitter";

/**
 * Represents a unit of work to be done
 */
export interface ProgressSource {
	/**
	 * Attempts to cancels this unit of work.
	 * @returns Whether the item could be cancelled.
	 *          If false, the item may or may not have finished already.
	 */
	cancel(): boolean;
	readonly cancellable: boolean;

	/**
	 * Indicate that there is nothing to cancel.
	 */
	done(): void;
	/**
	 * @returns The amount of work done as a number from 0 to 1
	 */
	getPercent(): number;

	/**
	 * Make this source not contribute to the total amount of work needing to be done.
	 * A source should be created if it may be needed and later ignored if needed.
	 * If sources were created only when definitely needed,
	 * the aggregated percent complete would decrease when work to do is found.
	 * By ignoring a source instead of setting it to 100%,
	 * the aggregated percent will be more accurate, by only including progress that matters.
	 */
	ignore(): void;
	ignoreIfNoPercentGetter(): void;
	isIgnored(): boolean;

	/**
	 * @param func Explain how to cancel the work being tracked
	 */
	setCancelFunc(func: () => boolean): void;
	setPercentGetter(getter: () => number): void;
}

/**
 * Represents all the work to be done for a single upload.
 * Tracks multiple ProgressSources associated with it.
 */
export interface ProgressTracker {
	/**
	 * End all work being tracked. No method calls are valid afterwards.
	 */
	cancel(): boolean;
	/**
	 * Create an object to track a unit of work to be done.
	 * Previously the tracker was created with a built in number of work items to expect
	 * and this number could be decremented.
	 * Now it is expected that sources are created and then later ignored.
	 */
	createSource(): ProgressSource;
	/**
	 * State that all work associated is done.
	 * No more work is expected to be tracked. No method calls are valid afterwards.
	 */
	finished(): void;
	/**
	 * State that all work associated is done and it failed due to an error.
	 * No more work is expected to be tracked. No method calls are valid afterwards.
	 * This will trigger a cancellation of all associated sources.
	 */
	finishedWithError(err: Error): void;
	/**
	 * @returns The aggregated percent completion of all created sources as a number from 0 to 1.
	 */
	getPercentComplete(): number;
	/**
	 * @param title The new title
	 * @param temporary Whether this title is expected to be replaced.
	 */
	setTitle(title: string, temporary: boolean): void;
}

interface PublicProgressItem {
	cancellable: boolean;
	contentId: number;
	/**
	 * 0 to 1
	 */
	percent: number;
	title: string;
	titleIsTemp: boolean;
	userId: string;
}

interface ProgressQueueEvents {
	error: (userId: string, contentId: number, error: Error) => void;
	list: (userId: string, items: PublicProgressItem[]) => void;
	prepared: (userId: string, title: string) => void;
	success: (userId: string, contentId: number) => void;
}

/**
 * A class responsible for knowing all of the progress information about uploads waiting to be queued.
 * It can:
 *     have new uploads added to it,
 *     cancel uploads in progress,
 * 	   emit the state of each user's uploads in progress at regular intervals
 */
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
			cancellable: false,
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

		// create a tracker that the external world can use to interact indirectly with the queue
		const tracker = new ProgressTrackerImpl();

		tracker.on("cancellable", (isCancellable) => {
			newItem.cancellable = isCancellable;
		});

		tracker.once("finished", (error) => {
			if (error) {
				this.emit("error", userId, contentId, error);
			} else {
				this.emit("success", userId, contentId);
			}

			this.deleteQueueItem(newItem);
		});

		tracker.on("title", (title, isTemporary) => {
			newItem.title = title;
			newItem.titleIsTemp = isTemporary;
			// might have just gained all the data needed
			this.maybeItemIsPrepared(newItem);
			this.transmitToUserMaybe(userId);
		});

		this.setTracker(userId, contentId, tracker);

		return tracker;
	}

	cancel(userId: string, contentId: number): boolean {
		const tracker = this.progressTrackers[userId]?.get(contentId);

		if (tracker) {
			return tracker.cancel();
		}

		return false;
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

	getQueue(userId: string): PublicProgressItem[] | undefined {
		const queueMap = this.queues[userId];

		if (queueMap) return queueMap.valuesQuick();

		return undefined;
	}

	/**
	 * Emit a "prepared" event if the item has all the data needed
	 * for Clippy to talk to the user about the item by name.
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

interface ProgressSourceImplEvents {
	cancellable: (cancellable: boolean) => void;
}

class ProgressSourceImpl extends (EventEmitter as TypedEmitter<ProgressSourceImplEvents>)
	implements ProgressSource
{
	private cancelFunc?: () => boolean;
	private percentGetter?: () => number;

	private isDone: boolean;
	private _isIgnored: boolean;

	constructor() {
		super();
		this.isDone = false;
		this._isIgnored = false;
	}

	cancel(): boolean {
		if (this.isDone) {
			return false;
		}

		if (this.cancelFunc) {
			return this.cancelFunc();
		}

		return false;
	}

	get cancellable(): boolean {
		return Boolean(this.cancelFunc);
	}

	done(): void {
		this.isDone = true;
	}

	getPercent(): number {
		if (this.percentGetter) {
			return this.percentGetter();
		}

		return 0;
	}

	ignore(): void {
		this.done();
		this._isIgnored = true;
	}

	isIgnored(): boolean {
		return this._isIgnored;
	}

	ignoreIfNoPercentGetter(): void {
		if (!this.percentGetter) {
			this.ignore();
		}
	}

	setCancelFunc(func: () => boolean): void {
		this.cancelFunc = func;
		this.emit("cancellable", true);
	}

	setPercentGetter(func: () => number): void {
		this.percentGetter = func;
	}
}

interface ProgressTrackerEvents {
	cancellable: (isCancellable: boolean) => void;
	finished: (error?: Error) => void;
	title: (title: string, isTemporary: boolean) => void;
}

class ProgressTrackerImpl extends (EventEmitter as TypedEmitter<ProgressTrackerEvents>) implements ProgressTracker {
	private progressSources: ProgressSource[];

	/**
	 * @param maximumExpectedSources The number of progress sources that are expected to be added.
	 */
	constructor() {
		super();
		this.progressSources = [];
	}

	cancel(): boolean {
		const successes = this.progressSources.map(source => source.cancel());
		if (anyTrue(successes)) {
			this.finished(); // the progress is done
			return true;
		}

		return false;
	}

	createSource(): ProgressSource {
		const source = new ProgressSourceImpl();
		this.progressSources.push(source);

		// if any source is cancellable, the whole thing is
		source.on("cancellable", (cancellable) => {
			if (cancellable) {
				this.emit("cancellable", true);
			} else {
				this.emit("cancellable", anyTrue(this.progressSources.map(source => source.cancellable)));
			}
		});

		return source;
	}

	finished() {
		this.emit("finished");
	}

	finishedWithError(error: Error) {
		this.cancel(); // clean up all sources
		this.emit("finished", error);
	}

	getPercentComplete() {
		const sourcesToAggregate = this.progressSources
			.filter(source => !source.isIgnored());

		const totalPercents = sourcesToAggregate
			.map(source => source.getPercent())
			.reduce((a, b) => a + b, 0);
		return sourcesToAggregate.length === 0
			? 0
			: totalPercents / sourcesToAggregate.length;
	}

	setTitle(title: string, isTemporary = false) {
		this.emit("title", title, isTemporary);
	}
}
