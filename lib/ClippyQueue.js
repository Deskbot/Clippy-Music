const utils = require('./utils.js');

class ClippyQueue {
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

	static recover() {
		//retreive suspended queue
		let obj, pqContent;
		let success = true;

		//I'm trying some weird control flow because I don't like try catch. Usually there's only 1 line you want to try and you don't want to assume something has been caught for the wrong reasons.
		try {
			success = true;
			pqContent = fs.readFileSync(consts.paths.contentFile);

		} catch (e) {
			success = false;
			console.log('No suspended content manager found. This is ok.');
		}

		if (success) {
			console.log('Reading suspended content manager');

			try {
				success = true;
				obj = JSON.parse(pqContent);

			} catch (e) {
				success = false;
				if (e instanceof SyntaxError) {
					console.error('Syntax error in suspendedContentManager.json file.');
					console.error(e);
					console.log('Ignoring suspended content manager');
				} else {
					throw e;
				}
			}
		}

		return success ? obj : null;
	}

	add(itemData) {
		let userBucket = this.userBuckets[itemData.userId];

		if (!userBucket) { //first visit
			userBucket = this.userBuckets[itemData.userId] = [];
			this.userIds.push(itemData.userId);
		}

		if (userBucket.length === 0) { //first visit or empty bucket
			this.userPosteriority[itemData.userId] = this.currPosteriority;
		}

		userBucket.push(itemData);
	}

	boostPosteriority(userId, val) {
		this.userPosteriority[userId] += val;
	}

	getBuckets() {
		return this.userBuckets;
	}

	getContent(uid, cid) {
		let bucket = this.userBuckets[uid];

		if (bucket) {
			let item;
			for (item of bucket) {
				if (item.id == cid) return item;
			}
		}

		return null;
	}

	getTitlesFromUserBucket(userId) {
		const bucket = this.userBuckets[userId];

		if (bucket) return bucket.map((item) => {
			return {
				title: item.music.title,
				id: item.id,
			};
		});

		else return [];
	}

	getUserBucket(uid) {
		return this.userBuckets[uid];
	}

	getUsersByPosteriority() {
		return this.userIds.sort((a,b) => {
			return this.userPosteriority[a] > this.userPosteriority[b];
		});
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

				} else if (this.userPosteriority[userId] == targetPo) {
					possibleUsers.push(userId);
				}
			}
		}

		if (possibleUsers.length > 0) {
			targetUser = possibleUsers[utils.randIntBetween(0, possibleUsers.length)];
			let userPos = this.userPosteriority[targetUser];

			//the current posteriority needs to be updated to match what the new current player's posteriority should be
			//if a user's posteriority falls below the current one, it's because they've not played in a while (it only gets boosted when their item finishes)
			//in that case they need to be bumped up to the meet the posteriority of the last user
			//so that they don't have lots of time allocated to them
			if (userPos < this.currPosteriority) {
				this.userPosteriority[targetUser] = this.currPosteriority;
			} else {
				this.currPosteriority = userPos;
			}
		}

		return targetUser ? this.userBuckets[targetUser].shift() : null;
	}

	penalise(uid) {
		if (uid in this.userPosteriority) {
			//get max of all posterioritys in userPosteriorty object
			let biggestPos = Math.max(...utils.valList(this.userPosteriority));
			this.userPosteriority[uid] = biggestPos + 1;
		}
	}

	purge(uid) {
		this.userBuckets[uid] = [];
	}

	remove(uid, obj) {
		let buckets = this.userBuckets[uid];
		if (buckets) {
			buckets.splice(buckets.indexOf(obj), 1);

		} else {
			return null;
		}
	}

	toJson() {
		return JSON.stringify(this);
	}
}

function durToBucketOffset(dur) { //assumes duration is in seconds
	return Math.ceil(dur / 60); //gives number of total minutes passed plus 1
}

module.exports = ClippyQueue;
