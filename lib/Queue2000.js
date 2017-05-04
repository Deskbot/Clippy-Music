class Queue2000 {
	constructor(queueObj) {
		this.userPriority = {};
		this.currBucketNum = 0;
		this.bucketsDone = 0;
		this.queue = [];

		if (queueObj) {
			this.userPriority = queueObj.userPriority;
			this.currBucketNum = queueObj.currBucketNum;
			this.bucketsDone = queueObj.bucketsDone;
			this.queue = queueObj.queue;
		}

		this[Symbol.iterator] = function*() {
			for (let bucket of this.queue) {
				for (let item of bucket) {
					console.log('iterating through queue');
					yield item;
				}
			}
		}
	}

	add(itemData) {
		let targetBucket = this.userPriority[itemData.userId];
		
		if (!targetBucket || targetBucket <= this.currBucketNum) { //if you've never played anything or it's been a long time since you played anything
			targetBucket = this.currBucketNum; //was plus 1
		}

		let bucketPosition = targetBucket - this.bucketsDone;

		//add buckets to fill the queue
		for (let i = this.queue.length; i <= bucketPosition; i++) {
			this.queue[i] = [];
		}

		console.log(this.queue, targetBucket);

		this.queue[bucketPosition].push(itemData);

		//set new priority
		this.userPriority[itemData.userId] = targetBucket + durToBucketOffset(itemData.duration);
	}

	next() {
		console.log(this.queue);

		//if no buckets, return null
		if (this.queue.length === 0) {
			return null;
		}

		let i = 0;
		let bucketFound = false;
		let bucket;
		do {
			bucket = this.queue[i]; //next bucket

			if (bucket.length === 0) { //remove bucket if it's empty
				this.queue.splice(i,1);
				this.currBucketNum++;
			} else { //break successfully because content was found
				bucketFound = true;
				break;
			}

			i++;

		} while (this.queue.length !== 0); //break unsuccessfully because we ran out of buckets

		if (bucketFound) {
			return bucket.shift(); //dequeue the next content item
		} else {
			return null;
		}
	}

	nextToDownload() {
		let bucket;

		for (let i = 0; i < this.queue.length; i++) {
			bucket = this.queue[i];

			if (bucket.length !== 0) {
				for (let j = 0; j < bucket; j++) {
					if (!bucket[j].downloaded) {
						return bucket[j];
					}
				}
			}
		}

		return null;
	}

	remove(itemId) {
		for (let i = 0; i < this.queue.length; i++) {
			let bucket = this.queue[i];
			for (let j = 0; j < bucket.length; j++) {
				if (bucket[j].itemId === itemId) {
					bucket.splice(j,1);
					return true;
				}
			}
		}

		return false;
	}

	getItemIds() {
		let idList = [];

		for (let i = 0; i < this.queue.length; i++) {
			idList[i] = this.queue[i].map((index, item, arr) => {
				return item.itemid;
			});
		}
		
		return idList;
	}

	toJson() {
		return JSON.stringify(this);
	}
}

function durToBucketOffset(dur) { //assumes duration is in seconds
	return Math.ceil(dur / 60); //gives number of total minutes passed plus 1
}

module.exports = Queue2000;
