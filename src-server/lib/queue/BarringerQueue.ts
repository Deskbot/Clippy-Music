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
		this.roundRobin = new RoundRobin();
		this.userQueues = new OneToManyMap();
	}

	add(item: ItemData) {
		this.idToUser.set(item.id, item.userId);
		this.userQueues.set(item.userId, item);
		this.roundRobin
	}

	get(cid: number): ItemData | undefined {
		const userId = this.idToUser.get(cid);

		if (userId === undefined) {
			return undefined;
		}

		const queue = this.userQueues.getAll(userId)!;
		return queue.find(item => item.id === cid);
	}

	getBuckets(): IterableIterator<ReadonlyArray<ItemData>> {
		return this.userQueues.values();
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

		if (success) {
			this.idToUser.delete(cid);
		}

		return success;
	}
}
