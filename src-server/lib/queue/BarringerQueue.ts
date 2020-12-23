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

export class BarringerQueue {
	private userQueues: OneToManyMap<string, ItemData>;
	private idToUser: Map<number, string>;
	private getMaxBucketTime: () => number;
	private roundRobin: RoundRobin<string>;

	private bucketsCache: Cache<ReadonlyArray<ReadonlyArray<ItemData>>>;

	constructor(getMaxBucketTime: () => number, queueObj?: SuspendedBarringerQueue) {

		// TODO
		// queueObj && queueObj.buckets
		// 	? queueObj.buckets
		// 	: []

		this.getMaxBucketTime = getMaxBucketTime;
		this.idToUser = new Map();
		this.roundRobin = RoundRobin.new();
		this.userQueues = new OneToManyMap();

		this.bucketsCache = new Cache(() => this._getBuckets());
	}

	add(item: ItemData) {
		this.idToUser.set(item.id, item.userId);
		this.userQueues.set(item.userId, item);
		this.roundRobin.add(item.userId);
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
		const buckets = [] as ItemData[][];

		const maxBucketTime = this.getMaxBucketTime();
		const simulatedRoundRobin = this.roundRobin.clone();

		// add every item to the right bucket

		// split into buckets so that no user exceeds the bucket time limit
		const userBuckets = iterUtils.mapToObject(
			this.userQueues.keys(),
			userId => splitByDuration(this.userQueues.getAll(userId)!, maxBucketTime)
		);

		// order the contents of the bucket using round-robin

		const eventualBucketsLength = Math.max(...Object.values(userBuckets)
			.map(bucket => bucket.length));

		while (buckets.length < eventualBucketsLength) {
			const bucketNum = buckets.length;
			const nextBucket = [] as ItemData[];

			// get the nth bucket for each user
			// figure out how many things need to go into the new bucket
			const eventualNewBucketLength =
				Object.keys(userBuckets)
					.map(userId => {
						const bucket = userBuckets[userId][bucketNum];
						return bucket ? bucket.length : 0;
					})
					.reduce((acc, next) => acc + next, 0);

			// loop through round robin and append items
			// increment when added
			// break when reached target number of adds
			while (nextBucket.length < eventualNewBucketLength) {
				const nextUser = simulatedRoundRobin.next();
				const userBucket = userBuckets[nextUser][bucketNum];

				// only users with uploads are in the round robin
				// but their items in this temporary bucket are being removed as the output buckets are built
				if (userBucket !== undefined && userBucket.length !== 0) {
					nextBucket.push(userBucket[0]);
					userBucket.splice(0, 1);
				}
			}

			buckets.push(nextBucket);
		}

		return buckets;
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

		// Increment the round robin before removing a user
		// because removing first could empty the round robin.
		this.roundRobin.next();
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
		this.roundRobin.remove(uid);

		this.bucketsCache.inputsChanged();
	}

	remove(uid: string, cid: number): boolean {
		const success = this.userQueues.removeIf(uid, item => item.id === cid);

		if (!success) {
			return false;
		}

		this.idToUser.delete(cid);

		// if the user removes everything and adds something later,
		// they should be added in at the back
		const userItems = this.userQueues.getAll(uid);
		if (userItems === undefined || userItems.length === 0) {
			this.roundRobin.remove(uid);
		}

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
