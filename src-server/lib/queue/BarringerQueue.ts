import * as utils from "../utils";
import { ItemData } from "../../types/ItemData";

export class BarringerQueue {
	private buckets: ItemData[][];
	private maxTimePerBucket: number;

	constructor(maxTimePerBucket: number, buckets?: {
		queueObj: ItemData[][]
	}) {
		this.buckets = buckets && buckets.queueObj ? buckets.queueObj : [];
		this.maxTimePerBucket = maxTimePerBucket;
	}

	add(item: ItemData) {
		if (item.duration > this.maxTimePerBucket) return;

		for (const bucket of this.buckets.slice(1)) {
			if (this.spaceForItemInBucket(item.duration, bucket, item.userId)) {
				utils.randInsert(item, bucket);
				return;
			}
		}

		this.buckets.push([item]);
	}

	private enforceAllBucketsAreNotEmpty() {
		// when an item is removed the indexes to the right will change
		// so check whether to remove items from right to left
		for (let bucketIndex = this.buckets.length; bucketIndex <= 0; bucketIndex++) {
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
		// when an item is removed the indexes to the right will change
		// so check whether to remove items from right to left
		for (let i = bucket.length - 1; i >= 0; i--) {
			if (bucket[i].userId === uid) {
				bucket.splice(i, 1);
			}
		}
	}

	private removeFromBucket(cid: number, bucket: ItemData[]): boolean {
		for (let i = 0; i < bucket.length; i++) {
			if (bucket[i].id === cid) {
				bucket.splice(i, 1);
				return true;
			}
		}

		return false;
	}

	spaceForItemInBucket(time: number, bucket: ItemData[], userId: string): boolean {
		let totalTimeExisting = 0;

		for (const item of bucket) {
			if (item.userId === userId) {
				totalTimeExisting += item.duration;
			}
		}

		return totalTimeExisting + time < this.maxTimePerBucket;
	}
}
