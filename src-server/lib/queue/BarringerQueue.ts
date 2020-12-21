import * as arrayUtils from "../utils/arrayUtils";

import { ItemData } from "../../types/ItemData";
import { OneToManyMap } from "../utils/OneToManyMap";
import { RoundRobin } from "../utils/RoundRobin";
import { Cache } from "../utils/Cache";
import { all } from "q";

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
		for (const queue of this.userQueues.values()) {
			console.log("\nqueue", queue);

			// split into buckets so that no user exceeds the bucket time limit
			const itemsToAddToBuckets = splitByDuration(queue, maxBucketTime);

			console.log("itemsToAddToBuckets", itemsToAddToBuckets);

			for (let i = 0; i < itemsToAddToBuckets.length; i++) {

				// order the contents of the bucket using round-robin
				const groupToAdd = itemsToAddToBuckets[i];
				const orderedGroupToAdd = [] as ItemData[];

				while (groupToAdd.length > 0) {
					console.log("groupToAdd", groupToAdd);
					console.log("orderedGroupToAdd", groupToAdd);

					// iterate through round robin
					const nextUser = simulatedRoundRobin.next();

					// get first elem of the bucket we're adding from that this user uploaded
					// put that into the output queue
					// if that user has no items to queue, continue
					const index = groupToAdd.findIndex(item => item.userId === nextUser);
					if (index !== -1) {
						orderedGroupToAdd.push(groupToAdd[index]);
						groupToAdd.splice(index, 1);
					}
				}

				console.log("groupToAdd", groupToAdd);
				console.log("orderedGroupToAdd", groupToAdd);

				if (buckets[i] === undefined) {
					buckets[i] = orderedGroupToAdd;
				} else {
					buckets[i].push(...orderedGroupToAdd);
				}
			}
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

		this.remove(item.userId, item.id);

		this.roundRobin.next();

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

		// if the user removes everything and adds something later,
		// they should be added in at the back
		if (this.userQueues.getAll(uid)?.length === 0) {
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
