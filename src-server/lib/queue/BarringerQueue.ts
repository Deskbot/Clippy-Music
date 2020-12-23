import * as arrayUtils from "../utils/arrayUtils";
import * as iterUtils from "../utils/iterUtils";

import { ItemData } from "../../types/ItemData";
import { OneToManyMap } from "../utils/OneToManyMap";
import { RoundRobin } from "../utils/RoundRobin";
import { Cache } from "../utils/Cache";

export interface SuspendedBarringerQueue {

}

export function isSuspendedBarringerQueue(obj: any): obj is SuspendedBarringerQueue {
	return "buckets" in obj
		&& Array.isArray(obj.buckets)
		&& arrayUtils.allTrue(
			obj.buckets.map((bucket: any) => Array.isArray(bucket))
		);
}

class Bucket {
	private roundRobin = new RoundRobin();
	private items = [] as ItemData[];

	add(item: ItemData) {
		this.roundRobin.add(item.userId);
		this.items.push(item);
	}

	/**
	 * This destroys the bucket.
	 */
	toArray() {
		// order everything by first uploaded first
		this.items.sort((item1, item2) => item1.timeUploaded - item2.timeUploaded);

		const result = [] as ItemData[];

		while (this.items.length > 0) {
			const nextUser = this.roundRobin.next();
			const index = this.items.findIndex(item => item.userId === nextUser);

			if (index === -1) continue;

			const nextItem = this.items.splice(index, 1)[0];
			result.push(nextItem);
		}

		return result;
	}
}

export class BarringerQueue {
	private userQueues: OneToManyMap<string, ItemData>;
	private idToUser: Map<number, string>;
	private getMaxBucketTime: () => number;

	private bucketsCache: Cache<ReadonlyArray<ReadonlyArray<ItemData>>>;

	constructor(getMaxBucketTime: () => number, queueObj?: SuspendedBarringerQueue) {

		// TODO
		// queueObj && queueObj.buckets
		// 	? queueObj.buckets
		// 	: []

		this.getMaxBucketTime = getMaxBucketTime;
		this.idToUser = new Map();
		this.userQueues = new OneToManyMap();

		this.bucketsCache = new Cache(() => this._getBuckets());
	}

	add(item: ItemData) {
		this.idToUser.set(item.id, item.userId);
		this.userQueues.set(item.userId, item);
		this.bucketsCache.inputsChanged();
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
		return this.bucketsCache.get();
	}

	private _getBuckets(): ReadonlyArray<ReadonlyArray<ItemData>> {
		const maxBucketTime = this.getMaxBucketTime();

		// create:
		// iterator for each user's list of their bucket content
		// represented as IterableIterator<ItemData[][]>
		const eachUsersBuckets = iterUtils.map(
			this.userQueues.keys(),
			userId => splitByDuration(this.userQueues.getAll(userId)!, maxBucketTime),
		);

		// merge into a single list of buckets, not separated by user
		const allBuckets = [] as Bucket[];

		for (const aUsersBuckets of eachUsersBuckets) {
			// put items from this user's buckets into the shared buckets
			for (let i = 0; i < aUsersBuckets.length; i++) {
				// ensure there is a shared bucket to add to
				if (allBuckets[i] === undefined) {
					allBuckets[i] = new Bucket();
				}

				const targetBucket = allBuckets[i];

				for (const item of aUsersBuckets[i]) {
					targetBucket.add(item);
				}
			}
		}

		// all sorting of the items in each bucket is done here
		return allBuckets.map(bucket => bucket.toArray());
	}

	getUserItems(uid: string): ReadonlyArray<ItemData> {
		return this.userQueues.getAll(uid) ?? [];
	}

	next(): ItemData | undefined {
		const bucket = this.getBuckets()[0];

		if (bucket === undefined) {
			return undefined;
		}

		const item = bucket[0];

		if (item === undefined) {
			return undefined;
		}

		this.remove(item.userId, item.id);

		return item;
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

		this.bucketsCache.inputsChanged();
	}

	remove(uid: string, cid: number): boolean {
		const success = this.userQueues.removeIf(uid, item => item.id === cid);

		if (!success) {
			return false;
		}

		this.idToUser.delete(cid);

		this.bucketsCache.inputsChanged();

		return true;
	}
}

function splitByDuration(items: ReadonlyArray<ItemData>, bucketSize: number): ItemData[][] {
	if (items.length === 0) {
		return [];
	}

	const allItems = [[]] as ItemData[][];
	let timeInNextBucket = 0;
	let newTimeInNextBucket: number;

	for (const item of items) {
		newTimeInNextBucket = timeInNextBucket + item.duration;

		if (newTimeInNextBucket > bucketSize) {
			allItems.push([item]);
			timeInNextBucket = 0;
		} else {
			// always valid because the array is never empty
			allItems[allItems.length - 1].push(item);
			timeInNextBucket = newTimeInNextBucket;
		}
	}

	return allItems;
}
