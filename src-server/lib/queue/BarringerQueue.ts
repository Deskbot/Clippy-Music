import * as arrayUtils from "../utils/arrayUtils";

import { ItemData } from "../../types/ItemData";

export interface SuspendedBarringerQueue {
	buckets: ItemData[][];
}

export function isSuspendedBarringerQueue(obj: any): obj is SuspendedBarringerQueue {
	return "buckets" in obj
		&& Array.isArray(obj.buckets)
		&& arrayUtils.allTrue(
			obj.buckets.map((bucket: any) => Array.isArray(bucket))
		);
}

export class BarringerQueue {
	private buckets: Buckets;
	private getMaxBucketTime: () => number;
	private lastMaxBucketTime: number;

	constructor(getMaxBucketTime: () => number, queueObj?: SuspendedBarringerQueue) {
		this.lastMaxBucketTime = getMaxBucketTime();
		this.buckets = new Buckets(this.lastMaxBucketTime);
		this.getMaxBucketTime = getMaxBucketTime;
	}

	add(newItem: ItemData) {
		this.enforceMaxBucketSize();
		return this.buckets.add(newItem);
	}

	get(cid: number): ItemData | undefined {
		this.enforceMaxBucketSize();
		return this.buckets.get(cid);
	}

	getBuckets(): IterableIterator<ItemData[]> {
		this.enforceMaxBucketSize();
		return this.buckets.getBuckets();
	}

	getUserItems(uid: string): ItemData[] {
		this.enforceMaxBucketSize();
		return this.buckets.getUserItems(uid);
	}

	next(): ItemData | undefined {
		this.enforceMaxBucketSize();
		return this.buckets.next();
	}

	purge(uid: string) {
		this.enforceMaxBucketSize();
		return this.buckets.purge(uid);
	}

	remove(cid: number): boolean {
		this.enforceMaxBucketSize();
		return this.buckets.remove(cid);
	}

	private enforceMaxBucketSize() {
		const maxBucketTime = this.getMaxBucketTime();
		if (this.lastMaxBucketTime !== maxBucketTime) {
			this.buckets = new Buckets(maxBucketTime);

			for (const bucket of this.buckets.getBuckets()) {
				for (const item of bucket) {
					this.buckets.add(item);
				}
			}
		}
	}
}

class Buckets {
	private buckets: ItemData[][];
	private maxBucketTime: number;

	constructor(maxBucketTime: number) {
		this.buckets = [] as ItemData[][];
		this.maxBucketTime = maxBucketTime;
	}

	add(item: ItemData) {
		if (item.duration > this.maxBucketTime) return;

		for (const bucket of this.buckets.slice(1)) {
			if (this.spaceForItemInBucket(item.duration, bucket, this.maxBucketTime, item.userId)) {
				const index = arrayUtils.findLastIndex(
					bucket,
					itemInBucket => itemInBucket.userId === item.userId
				);
				arrayUtils.randInsertAfter(bucket, index + 1, item);
				return;
			}
		}

		this.buckets.push([item]);
	}

	private enforceAllBucketsAreNotEmpty() {
		// when an item is removed, the indices to the right will change
		// so check whether to remove items from right to left
		for (let bucketIndex = this.buckets.length - 1; bucketIndex >= 0; bucketIndex--) {
			this.enforceBucketIsNotEmpty(bucketIndex);
		}
	}

	private enforceBucketIsNotEmpty(index: number) {
		if (this.buckets[index].length === 0) {
			this.buckets.splice(index, 1);
		}
	}

	get(cid: number): ItemData | undefined {
		for (const bucket of this.buckets) {
			for (const item of bucket) {
				if (item.id === cid) {
					return item;
				}
			}
		}

		return undefined;
	}

	getBuckets(): IterableIterator<ItemData[]> {
		return this.buckets[Symbol.iterator]();
	}

	getUserItems(uid: string): ItemData[] {
		const userItems = [];

		for (const bucket of this.buckets) {
			for (const item of bucket) {
				if (item.userId === uid) {
					userItems.push(item);
				}
			}
		}

		return userItems;
	}

	private makeTopBucketNotEmpty() {
		while (this.buckets[0].length === 0) {
			this.buckets.shift();
			if (this.buckets.length === 0) return;
		}
	}

	next(): ItemData | undefined {
		if (this.buckets.length === 0) return;

		// make sure the top bucket has something in it to read
		this.makeTopBucketNotEmpty();

		if (this.buckets.length === 0) return;

		const nextItem = this.buckets[0].shift();

		this.makeTopBucketNotEmpty();

		return nextItem;
	}

	purge(uid: string) {
		for (let bucketIndex = 0; bucketIndex < this.buckets.length; bucketIndex++) {
			const bucket = this.buckets[bucketIndex];
			this.removeAllItemsOfUserFromBucket(uid, bucket);
		}

		this.enforceAllBucketsAreNotEmpty();
	}

	remove(cid: number): boolean {
		for (let bucketIndex = 0; bucketIndex < this.buckets.length; bucketIndex++) {
			const bucket = this.buckets[bucketIndex];
			if (this.removeFromBucket(cid, bucket)) {
				this.enforceBucketIsNotEmpty(bucketIndex);
				return true;
			}
		}

		return false;
	}

	private removeAllItemsOfUserFromBucket(uid: string, bucket: ItemData[]) {
		arrayUtils.removeAll(bucket, item => item.userId === uid);
	}

	private removeFromBucket(cid: number, bucket: ItemData[]): boolean {
		return arrayUtils.removeFirst(bucket, item => item.id === cid);
	}

	private spaceForItemInBucket(
		time: number,
		bucket: ItemData[],
		maxTimePerBucket: number,
		userId: string,
	): boolean {
		let totalTimeExisting = 0;

		for (const item of bucket) {
			if (item.userId === userId) {
				totalTimeExisting += item.duration;
			}
		}

		return (totalTimeExisting + time) < maxTimePerBucket;
	}
}
