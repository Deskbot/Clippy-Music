const baseDir = "../../../build/";

const { BarringerBuckets } = require(baseDir + "lib/BarringerBuckets.js");

const assert = require("assert").strict;

module.exports = {
	can_add_to_empty_queue: () => {
		const q = new BarringerBuckets(1000);

		const item = {
			userId: 1,
			duration: 10,
		};
		q.add(item);

		assert(q.getBuckets()[0][0] === item, "The added item is in the top bucket.");
	},

	can_not_add_to_top_bucket_if_queue_is_not_empty: () => {
		const q = new BarringerBuckets(1000);

		q.add({
			userId: 2,
			duration: 2
		});

		const item = {
			userId: 1,
			duration: 10,
		};
		q.add(item);

		assert(q.getBuckets()[1][0] === item, "The added item is in the second bucket.");
	},

	exceeding_a_bucket_size_adds_a_new_bucket: () => {
		const q = new BarringerBuckets(1000);

		const item1 = {
			userId: 1,
			duration: 900
		};
		const item2 = {
			userId: 1,
			duration: 900
		};

		q.add(item1);
		q.add(item2);

		const buckets = q.getBuckets();

		assert(buckets[0][0] === item1,
			"The added items are in different buckets.");
		assert(buckets[1][0] === item2,
			"The added items are in different buckets.");
	},

	random_insert_does_insert: () => {
		let bucket = [];

		const items = [{
			userId: 1,
			contentId: 1,
			duration: 200,
		}, {
			userId: 2,
			contentId: 2,
			duration: 200,
		}, {
			userId: 3,
			contentId: 3,
			duration: 200,
		}];

		for (const item of items) {
			BarringerBuckets.randomlyInsert(item, bucket);
			assert(bucket.includes(item),
				"The inserted item should be in the bucket."
			);
		}

		for (const item of items) {
			assert(bucket.includes(item),
				"All previously inserted items should be in the bucket."
			);
		}
	},

	remove: () => {
		const q = new BarringerBuckets(1000);

		const items = [{
			id: 1,
			userId: 1,
			duration: 900,
		},
		{
			id: 2,
			userId: 1,
			duration: 900,
		},
		{
			id: 3,
			userId: 1,
			duration: 900,
		},
		{
			id: 4,
			userId: 1,
			duration: 900,
		}];

		for (const item of items) {
			q.add(item);
		}

		q.remove(4);

		const allItems = q.getBuckets().reduce((allItems, bucket) => allItems.concat(bucket));

		assert(!allItems.find(item => item.contentId === 4),
			"The removed item is not in the queue."
		);
	},

	purge: () => {
		const q = new BarringerBuckets(1000);

		const item1a = {
			contentId: 1,
			userId: 1,
			duration: 900,
		};
		const item1b = {
			contentId: 2,
			userId: 1,
			duration: 900,
		};
		const item2 = {
			contentId: 3,
			userId: 2,
			duration: 900,
		};
		q.add(item1a);
		q.add(item1b);
		q.add(item2);

		q.purge(1);

		const allItems = q.getBuckets().reduce((allItems, bucket) => allItems.concat(bucket));

		assert(!allItems.includes(item1a),
			"The purged user's items are not in the queue."
		);
		assert(!allItems.includes(item1b),
			"The purged user's items are not in the queue."
		);
		assert(allItems.includes(item2),
			"Other items remain in the queue."
		);
	},
}