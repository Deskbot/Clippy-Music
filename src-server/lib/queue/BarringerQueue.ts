import * as arrayUtils from "../utils/arrayUtils";

import { ItemData } from "../../types/ItemData";
import { OneToManyMap } from "../utils/OneToManyMap";
import { RoundRobin } from "../utils/RoundRobin";

export interface SuspendedBarringerQueue {

}

export function isSuspendedBarringerQueue(obj: any): obj is SuspendedBarringerQueue {
	return "buckets" in obj
		&& Array.isArray(obj.buckets)
		&& arrayUtils.allTrue(
			obj.buckets.map((bucket: any) => Array.isArray(bucket))
		);
}

export class BarringerQueue {
	private userQueues: OneToManyMap<string, ItemData>;
	private idToUser: Map<number, string>;
	private getMaxBucketTime: () => number;
	private roundRobin: RoundRobin<string>;

	constructor(getMaxBucketTime: () => number, queueObj?: SuspendedBarringerQueue) {

		// TODO
		// queueObj && queueObj.buckets
		// 	? queueObj.buckets
		// 	: []

		this.getMaxBucketTime = getMaxBucketTime;
		this.idToUser = new Map();
		this.roundRobin = RoundRobin.new();
		this.userQueues = new OneToManyMap();
	}

	add(item: ItemData) {
		this.idToUser.set(item.id, item.userId);
		this.userQueues.set(item.userId, item);
		this.roundRobin.add(item.userId);
	}

	get(cid: number): ItemData | undefined {
		const userId = this.idToUser.get(cid);

		if (userId === undefined) {
			return undefined;
		}

		const queue = this.userQueues.getAll(userId)!;
		return queue.find(item => item.id === cid);
	}

	getBuckets(): ReadonlyArray<ReadonlyArray<ItemData>> {
		const buckets = [] as ItemData[][];

		const maxBucketTime = this.getMaxBucketTime();

		const simulatedRoundRobin = this.roundRobin.clone();

		// add every item to the right bucket
		for (const queue of this.userQueues.values()) {
			const itemsToAddToBuckets = splitByDuration(queue, maxBucketTime);
			for (let i = 0; i < itemsToAddToBuckets.length; i++) {
				const bucketToAddTo = buckets[i];
				const groupToAdd = itemsToAddToBuckets[i];
				bucketToAddTo.push(...groupToAdd);
			}
		}

		// TODO sort the items in the bucket by round robin

		return buckets;
	}

	getUserItems(uid: string): ReadonlyArray<ItemData> {
		return this.userQueues.getAll(uid) ?? [];
	}

	next(): ItemData | undefined {
		if (this.roundRobin.isEmpty()) {
			return undefined;
		}

		let queue: readonly ItemData[] | undefined;

		do {
			const userId = this.roundRobin.next();
			queue = this.userQueues.getAll(userId);
		} while (queue === undefined || queue.length === 0);

		const nextItem = queue[0];

		this.remove(nextItem.userId, nextItem.id);

		return nextItem;
	}

	purge(uid: string) {
		const queue = this.userQueues.getAll(uid);

		if (queue === undefined) {
			return;
		}

		for (const item of queue) {
			this.idToUser.delete(item.id);
		}

		this.userQueues.removeAll(uid);
	}

	remove(uid: string, cid: number): boolean {
		const success = this.userQueues.removeIf(uid, item => item.id === cid);

		if (!success) {
			return false;
		}

		this.idToUser.delete(cid);

		// if the user removes everything and adds something later,
		// they should be added in at the back
		if (this.userQueues.getAll(uid)?.length === 0) {
			this.roundRobin.remove(uid);
		}

		return true;
	}
}

function splitByDuration(items: ReadonlyArray<ItemData>, bucketSize: number): ItemData[][] {
	const allItems = [] as ItemData[][];
	let nextBucket = [] as ItemData[];
	let timeInNextBucket = 0;

	for (const item of items) {
		const newTimeInNextBucket = timeInNextBucket + item.duration;

		if (newTimeInNextBucket > bucketSize) {
			// this bucket is finished
			allItems.push(nextBucket);

			// reset fields
			nextBucket = [];
			timeInNextBucket = 0;
		} else {
			nextBucket.push(item);
			timeInNextBucket = newTimeInNextBucket;
		}
	}

	return allItems;
}
