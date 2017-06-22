const utils = require('./utils.js');

class Queue2000 {
	constructor(queueObj) {
		this.userPosteriority = {};
		this.userBuckets = {};
		this.userIds = [];
		this.currPosteriority = 0;

		if (queueObj) {
			this.userPosteriority = queueObj.userPosteriority;
			this.userBuckets = queueObj.userBuckets;
			this.userIds = queueObj.userIds;
			this.currPosteriority = queueObj.currPosteriority;
		}
	}

	add(itemData) {
		let userBucket = this.userBuckets[itemData.userId];

		if (!userBucket) {
			userBucket = this.userBuckets[itemData.userId] = [];
			this.userPosteriority[itemData.userId] = this.currPosteriority;
			this.userIds.push(itemData.userId);
		}
		
		userBucket.push(itemData);
	}

	next() {
		let possibleUsers = [];
		let targetUser = null;
		let targetPo = Infinity;
		let userId;

		for (let i = 0; i < this.userIds.length; i++) {
			userId = this.userIds[i];
			
			if (this.userBuckets[userId].length > 0) {
				if (this.userPosteriority[userId] < targetPo) {
					possibleUsers = [userId];
					targetPo = this.userPosteriority[userId];

				} else if (this.userPosteriority[userId] === targetPo) {
					possibleUsers.push(userId);
				}
			}
		}

		if (possibleUsers.length > 0) {
			targetUser = possibleUsers[utils.randIntBetween(0, possibleUsers.length)];
			this.currPosteriority = this.userPosteriority[targetUser];
		}


		return targetUser ? this.userBuckets[userId].shift() : null;
	}

	remove(userId, itemId) {
		let bucket = this.userBucket[userId].length;

		for (let i = 0; i < bucket; i++) {
			if (bucket[i].contentId === itemId) {
				bucket.splice(i,1); //delete that entry
				return true;
			}
		}

		return false;
	}

	updatePosteriority(userId, val) {
		this.userPosteriority[userId] += val;
	}

	getBuckets() {
		return this.userBuckets;
	}

	getTitlesFromUserBucket(userId) {
		const bucket = this.userBuckets[userId];

		if (bucket) return bucket.map((item) => {
			return item.musicTitle;
		});

		else return [];
	}

	getUsersByPosteriority() {
		return this.userIds.sort((a,b) => {
			return this.userPosteriority[a] > this.userPosteriority[b];
		});
	}

	purge(uid) {
		this.userBuckets[uid] = [];
	}

	toJson() {
		return JSON.stringify(this);
	}
}

function durToBucketOffset(dur) { //assumes duration is in seconds
	return Math.ceil(dur / 60); //gives number of total minutes passed plus 1
}

module.exports = Queue2000;
