const baseDir = "../../../../build/";

const { Bucket } = require(baseDir + "lib/queue/Bucket.js");

const assert = require("assert").strict;

function assertBucketOrder(bucket, expectedOrder) {
    assert.deepStrictEqual(
        bucket.content,
        expectedOrder,
        "The bucket is in the right order."
    );
}

function bucketOrderMatchesOutputOrder(bucket) {
    const itemsInClaimedOrder = bucket.content

    const actualOrder = [];
    while (true) {
        const item = bucket.outputFrontItem();
        if (!item) {
            break;
        }
        actualOrder.push(item);
    }

    assert.deepStrictEqual(
        actualOrder,
        itemsInClaimedOrder,
        "The items come out in the order the bucket claims."
    );
}

module.exports = {
    destroying_individual_items_retains_correct_order() {
        const bucket = new Bucket();

        const item1 = {
            userId: "1"
        };
        bucket.push(item1);

        const item11 = {
            id: 11,
            userId: "1"
        };
        bucket.push(item11);

        const item13 = {
            userId: "1"
        };
        bucket.push(item13);

        const item2 = {
            userId: "2"
        };
        bucket.push(item2);

        const item21 = {
            userId: "2"
        };
        bucket.push(item21);

        bucket.destroyItem(11);

        assertBucketOrder(bucket, [item1, item2, item13, item21]);

        bucketOrderMatchesOutputOrder(bucket);
    },

    destroying_all_of_a_users_items_retains_correct_order() {
        const bucket = new Bucket();

        const item1 = {
            userId: "1"
        };
        bucket.push(item1);

        const item11 = {
            userId: "1"
        };
        bucket.push(item11);

        bucket.push({
            userId: "2"
        });
        bucket.push({
            userId: "2"
        });

        const item3 = {
            userId: "3"
        };
        bucket.push(item3);

        const item31 = {
            userId: "3"
        };
        bucket.push(item31);

        bucket.destroyAllFromUser("2");

        assertBucketOrder(bucket, [item1, item3, item11, item31]);

        bucketOrderMatchesOutputOrder(bucket);
    },

    item_order_in_a_bucket_is_round_robin_when_items_are_added_in_order() {
        const bucket = new Bucket();

        const item1 = {
            userId: "1"
        };
        bucket.push(item1);
        assertBucketOrder(bucket, [item1]);

        const item2 = {
            userId: "2"
        };
        bucket.push(item2);
        assertBucketOrder(bucket, [item1, item2]);

        const item11 = {
            userId: "1"
        };
        bucket.push(item11);
        assertBucketOrder(bucket, [item1, item2, item11]);

        const item12 = {
            userId: "2"
        };
        bucket.push(item12);
        assertBucketOrder(bucket, [item1, item2, item11, item12]);

        bucketOrderMatchesOutputOrder(bucket);
    },

    item_order_in_a_bucket_is_round_robin_when_items_are_added_out_of_order() {
        const bucket = new Bucket();

        const item1 = {
            userId: "1"
        };
        bucket.push(item1);
        assertBucketOrder(bucket, [item1]);

        const item11 = {
            userId: "1"
        };
        bucket.push(item11);
        assertBucketOrder(bucket, [item1, item11]);

        const item2 = {
            userId: "2"
        };
        bucket.push(item2);
        assertBucketOrder(bucket, [item1, item2, item11]);

        const item12 = {
            userId: "2"
        };
        bucket.push(item12);
        assertBucketOrder(bucket, [item1, item2, item11, item12]);

        bucketOrderMatchesOutputOrder(bucket);
    },

    outputting_an_item_keeps_correct_order() {
        const bucket = new Bucket();

        const item1 = {
            userId: "one"
        };
        bucket.push(item1);

        const item2 = {
            userId: "two"
        };
        bucket.push(item2);

        const item3 = {
            userId: "one"
        };
        bucket.push(item3);

        const item5 = {
            userId: "two"
        };
        bucket.push(item5);

        assert(bucket.outputFrontItem(), item1, "The correct item is removed.");

        const item4 = {
            userId: "three"
        };
        bucket.push(item4);

        assertBucketOrder(bucket, [item2, item3, item4, item5]);

        bucketOrderMatchesOutputOrder(bucket);
    },
};
