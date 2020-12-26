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

class Bucket {
	private roundRobin = RoundRobin.new();
	private items = [] as ItemData[];
	private userTime = {} as Record<string, number>;

	add(item: ItemData) {
		this.roundRobin.add(item.userId);
		this.items.push(item);

		if (this.userTime[item.userId] === undefined) {
			this.userTime[item.userId] = item.duration;
		} else {
			this.userTime[item.userId] += item.duration;
		}

		this.sort();
	}

	asArray(): ReadonlyArray<ItemData> {
		return this.items;
	}

	isEmpty(): boolean {
		return this.items.length === 0;
	}

	next(): ItemData | undefined {
		this.roundRobin.next();
		console.log(this.roundRobin);

		if (this.items.length === 0) return undefined;

		return this.remove(0);
	}

	/**
	 * external use only
	 */
	removeAllIf(predicate: (item: ItemData) => boolean) {
		while (this.removeIf(predicate));
	}

	/**
	 * external use only
	 */
	removeIf(predicate: (item: ItemData) => boolean): boolean {
		const index = this.items.findIndex(predicate);

		if (index === -1) return false;

		const removedItem = this.remove(index);

		// item no longer counts towards the user's total time
		this.userTime[removedItem.userId] -= removedItem.duration;

		return true;
	}

	/**
	 * Keeps consistency of the round robin, but doesn't enforce total user time.
	 */
	private remove(index: number): ItemData {
		const itemToRemove = this.items[index];

		// remove item
		this.items.splice(index, 1);

		// remove the user from the round robin if they have no items left
		if (!this.items.find(item => item.userId === itemToRemove.userId)) {
			this.roundRobin.remove(itemToRemove.userId);
		}

		this.sort();

		return itemToRemove;
	}

	getUserTime(userId: string): number {
		return this.userTime[userId] ?? 0;
	}

	private sort() {
		// order everything by first uploaded first
		this.items.sort((item1, item2) => item1.timeUploaded - item2.timeUploaded);

		if (this.roundRobin.isEmpty()) return;

		const simulatedRoundRobin = this.roundRobin.clone();
		const newItems = [] as ItemData[];

		while (this.items.length > 0) {
			const nextUser = simulatedRoundRobin.next();
			const index = this.items.findIndex(item => item.userId === nextUser);

			// if the next user in the round-robin has no items, don't worry about them
			if (index === -1) continue;

			const nextItem = this.items.splice(index, 1)[0];
			newItems.push(nextItem);
		}

		this.items = newItems;
	}
}

export class BarringerQueue {
	private buckets: Bucket[];
	private userQueues: OneToManyMap<string, ItemData>;
	private idToUser: Map<number, string>;
	private getMaxBucketTime: () => number;

	constructor(getMaxBucketTime: () => number, queueObj?: SuspendedBarringerQueue) {

		// TODO
		// queueObj && queueObj.buckets
		// 	? queueObj.buckets
		// 	: []

		this.buckets = [];
		this.getMaxBucketTime = getMaxBucketTime;
		this.idToUser = new Map();
		this.userQueues = new OneToManyMap();
	}

	add(item: ItemData) {
		this.idToUser.set(item.id, item.userId);
		this.userQueues.set(item.userId, item);

		const maxTime = this.getMaxBucketTime();

		let targetBucket: Bucket | undefined;
		for (const bucket of this.buckets) {
			if (bucket.getUserTime(item.userId) + item.duration <= maxTime) {
				// the bucket won't exceed the max duration if the new item is added
				targetBucket = bucket;
				break;
			}
		}

		if (!targetBucket) {
			targetBucket = new Bucket();
			this.buckets.push(targetBucket);
		}

		targetBucket.add(item);
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
		return this.buckets.map(bucket => bucket.asArray());
	}

	getUserItems(uid: string): ReadonlyArray<ItemData> {
		return this.userQueues.getAll(uid) ?? [];
	}

	next(): ItemData | undefined {
		if (this.buckets.length === 0) {
			return undefined;
		}

		const bucket = this.buckets[0];
		const item = bucket.next();

		console.log(bucket)

		if (item === undefined) {
			return undefined;
		}

		if (bucket.isEmpty()) {
			this.buckets.splice(0, 1);
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

		let i = 0;
		while (i < this.buckets.length) {
			const bucket = this.buckets[i];
			bucket.removeAllIf(item => item.userId === uid);

			if (bucket.isEmpty()) {
				this.buckets.splice(i, 1);
				// we've just shrunk the array, so the next item is at the same index
			} else {
				i += 1;
			}
		}
	}

	remove(uid: string, cid: number): boolean {
		const success = this.userQueues.removeIf(uid, item => item.id === cid);

		if (!success) {
			return false;
		}

		this.idToUser.delete(cid);

		for (let i = 0; i < this.buckets.length; i++) {
			const bucket = this.buckets[i];

			const removed = bucket.removeIf(item => item.id === cid);
			if (removed) {
				if (bucket.isEmpty()) {
					this.buckets.splice(i, 1);
				}
				break;
			}
		}

		return true;
	}
}
