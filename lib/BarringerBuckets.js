class BarringerBuckets {
    constructor(maxTimePerBucket, queueObj) {
        this.buckets = queueObj ? queueObj : [];
        this.maxTimePerBucket = maxTimePerBucket;
    }

    add(item) {
        if (item.duration > this.maxTimePerBucket) return false;

        for (const bucket of this.buckets.slice(1)) {
            if (this.spaceForItemInBucket(item.duration, bucket, item.userId)) {
                bucket.push(item);
                return true;
            }
        }

        this.buckets.push([item]);
    }

    getBuckets() {
        return this.buckets;
    }

    next() {
        if (this.buckets.length === 0) return null;

        // make sure the top bucket has something in it
        while (this.buckets[0].length === 0) {
            this.buckets.shift();
            if (this.buckets.length === 0) return null;
        }

        return this.buckets[0].shift();
    }

    purge(uid) {
        for (const bucket of this.buckets) {
            for (let i = 0; i < bucket.length; i++) {
                if (bucket[i].userId === uid) {
                    bucket.splice(i, 1);
                }
            }
        }
    }

    remove(cid) {
        for (const bucket of this.buckets) {
            for (let i = 0; i < bucket.length; i++) {
                if (bucket[i].contentId === cid) {
                    bucket.splice(i, 1);
                    return;
                }
            }
        }
    }

    spaceForItemInBucket(time, bucket, userId) {
        let totalTimeExisting = 0;

        for (const item of bucket) {
            if (item.userId === userId) {
                totalTimeExisting += item.duration;
            }
        }

        return totalTimeExisting + time < this.maxTimePerBucket;
    }
}

module.exports = BarringerBuckets;
