const baseDir = "../../../../build/";
const arrayUtils = require(baseDir + "lib/utils/arrayUtils.js");
const utils = require(baseDir + "lib/utils/utils.js");

const assert = require("assert").strict;

module.exports = {
    random_insert_after: () => {
        const list = [];

        const itemsToInsert = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

        let expectedNumOfItemsInList = 0;

        for (const item of itemsToInsert) {
            const targetIndex = utils.randIntBetween(-1, list.length);

            arrayUtils.randInsertAfter(list, targetIndex, item);
            expectedNumOfItemsInList += 1;

            assert(list.length === expectedNumOfItemsInList,
                "The list has one more element than previously.");
            assert(list.indexOf(item) > targetIndex,
                "The inserted item should be in the list after targetIndex."
            );
        }

        // final sanity check

        assert(list.length === itemsToInsert.length,
            "The list has all of the correct number of elements.")

        for (const item of itemsToInsert) {
            assert(list.includes(item),
                "All previously inserted items should be in the list."
            );
        }
    },
};
