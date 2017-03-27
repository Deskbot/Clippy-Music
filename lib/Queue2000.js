class Queue2000 {
	constructor() {
		this.userPriority = new Map();
		this.currBucketNum = 0;
		this.bucketsDone = 0;
		this.queue = [];
		this.itemId = 0;
	}

	add(userId, contentId, duration) {
		let targetBucket = this.userPriority.get(userId);
		
		if (targetBucket <= this.currBucketNum) {
			targetBucket = this.currBucketNum + 1;
		}

		this.queue[targetBucket - this.bucketsDone].push({
			itemId: ++this.itemId,
			contentId: contentId,
			duration: duration,
		});

		//set new priority
		this.userPriority.set(userId, targetBucket + durToBucketOffset(duration));

		return this.itemId;
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
}

function durToBucketOffset(dur) { //assumes duration is in seconds
	return Math.ceil(dur / 60); //gives number of total minutes passed plus 1
}

module.exports = Queue2000;
