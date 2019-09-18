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
		if (item.duration > this.maxTimePerBucket) return false;

		for (const bucket of this.buckets.slice(1)) {
			if (this.spaceForItemInBucket(item.duration, bucket, item.userId)) {
				BarringerQueue.randomlyInsert(item, bucket);
				return true;
			}
		}

		this.buckets.push([item]);

		return false;
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

	getBuckets() {
		return [...this.buckets];
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

	next(): ItemData | undefined | null {
		if (this.buckets.length === 0) return null;

		// make sure the top bucket has something in it
		while (this.buckets[0].length === 0) {
			this.buckets.shift();
			if (this.buckets.length === 0) return null;
		}

		return this.buckets[0].shift();
	}

	purge(uid: string) {
		for (const bucket of this.buckets) {
			for (let i = 0; i < bucket.length; i++) {
				if (bucket[i].userId === uid) {
					bucket.splice(i, 1);
				}
			}
		}
	}

	static randomlyInsert(newItem: ItemData, bucket: ItemData[]) {
		const targetIndex = utils.randUpTo(bucket.length);
		const itemsAfterNew = bucket.slice(targetIndex, bucket.length);
		// bucket is modified to lose all items after new

		bucket.push(newItem, ...itemsAfterNew);
	}

	remove(cid: number): boolean {
		for (const bucket of this.buckets) {
			for (let i = 0; i < bucket.length; i++) {
				if (bucket[i].id === cid) {
					bucket.splice(i, 1);
					return true;
				}
			}
		}

		return false;
	}

	spaceForItemInBucket(time: number, bucket: ItemData[], userId: string) {
		let totalTimeExisting = 0;

		for (const item of bucket) {
			if (item.userId === userId) {
				totalTimeExisting += item.duration;
			}
		}

		return totalTimeExisting + time < this.maxTimePerBucket;
	}
}
