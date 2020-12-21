const baseDir = "../../../../build/";

const { BarringerQueue } = require(baseDir + "lib/queue/BarringerQueue.js");

const assert = require("assert").strict;

module.exports = {
	can_add_to_empty_queue: () => {
		const q = new BarringerQueue(() => 1000);

		const item = {
			userId: 1,
			duration: 10,
		};
		q.add(item);

		console.log(q.getBuckets());

		assert(q.getBuckets()[0][0] === item, "The added item is in the top bucket.");
	},

	empty_queue_is_empty() {
		const q = new BarringerQueue(() => 1000);

		assert(q.getBuckets().length === 0);
	},

	exceeding_a_bucket_size_adds_a_new_bucket: () => {
		const q = new BarringerQueue(() => 1000);

		// ensure the queue does not start empty
		q.add({
			userId: "someone",
			duration: 100,
		});

		const item1 = {
			userId: "1",
			duration: 900
		};
		const item2 = {
			userId: "1",
			duration: 900
		};

		q.add(item1);
		q.add(item2);

		const buckets = [...q.getBuckets()];

		assert(buckets[0][0] === item1,
			"The added items are in different buckets.");
		assert(buckets[1][0] === item2,
			"The added items are in different buckets.");
	},

	exceeding_a_bucket_size_adds_a_new_bucket_2: () => {
		const q = new BarringerQueue(() => 1000);

		const item1 = {
			id: 2,
			userId: "1",
			duration: 300
		};
		const item2 = {
			id: 3,
			userId: "1",
			duration: 300
		};
		const item3 = {
			id: 4,
			userId: "1",
			duration: 300
		};
		const item4 = {
			id: 5,
			userId: "1",
			duration: 300
		};

		q.add(item1);
		q.add(item2);
		q.add(item3);
		q.add(item4);

		const buckets = q.getBuckets();

		assert(buckets[0].includes(item1)
			&& buckets[0].includes(item2)
			&& buckets[0].includes(item3),
			"The added items are in different buckets.");
		assert(buckets[1].includes(item4),
			"The added items are in different buckets.");
	},

	items_can_equal_size_of_bucket() {
		const q = new BarringerQueue(() => 1000);

		const item = {
			id: 1,
			userId: "1",
			duration: 1000,
		};

		q.add(item);

		assert([...q.getBuckets()][0][0] == item, "The item was successfully added.");
	},

	purge: () => {
		const q = new BarringerQueue(() => 1000);

		const item1a = {
			id: 1,
			userId: "1",
			duration: 900,
		};
		const item1b = {
			id: 2,
			userId: "1",
			duration: 450,
		};
		const item1c = {
			id: 3,
			userId: "1",
			duration: 450,
		};
		const item2 = {
			id: 4,
			userId: "2",
			duration: 900,
		};
		const item1d = {
			id: 5,
			userId: "1",
			duration: 100,
		};
		q.add(item1a);
		q.add(item1b);
		q.add(item1c);
		q.add(item2);
		q.add(item1d);

		q.purge("1");

		const allItems = [...q.getBuckets()]
			.reduce((allItems, bucket) => allItems.concat(bucket));

		const failMessage = "The purged user's items are not in the queue.";
		assert(!allItems.includes(item1a), failMessage);
		assert(!allItems.includes(item1b), failMessage);
		assert(!allItems.includes(item1c), failMessage);
		assert(!allItems.includes(item1d), failMessage);
		assert(allItems.includes(item2),
			"Other items remain in the queue."
		);

		for (const bucket of q.getBuckets()) {
			assert(bucket.length !== 0, "Each bucket has at least one item.")
		}
	},

	remove: () => {
		const q = new BarringerQueue(() => 1000);

		const items = [{
			id: 1,
			userId: "1",
			duration: 900,
		},
		{
			id: 2,
			userId: "1",
			duration: 900,
		},
		{
			id: 3,
			userId: "1",
			duration: 900,
		},
		{
			id: 4,
			userId: "1",
			duration: 900,
		}];

		for (const item of items) {
			q.add(item);
		}

		assert(q.remove("1", 4));

		const allItems = q.getBuckets().flat();

		assert(!allItems.find(item => item.id === 4),
			"The removed item is not in the queue."
		);
	},

	removing_an_item_does_not_leave_an_empty_bucket() {
		const q = new BarringerQueue(() => 1000);

		// top bucket
		q.add({
			duration: 500,
			id: 1,
			userId: "1",
		});

		// second bucket
		q.add({
			duration: 1000,
			id: 2,
			userId: "1",
		});

		q.add({
			duration: 500,
			id: 3,
			userId: "1",
		});

		q.remove(2);

		for (const bucket of q.getBuckets()) {
			assert(bucket.length !== 0, "Each bucket has at least one item.")
		}
	},
}