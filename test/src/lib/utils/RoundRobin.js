const baseDir = "../../../../build/";
const { RoundRobin } = require(baseDir + "lib/utils/RoundRobin.js");

const assert = require("assert").strict;

module.exports = {
    starts_empty_and_grows() {
        const rr = new RoundRobin();
        assert(rr.isEmpty());

        rr.add(1);
        assert(!rr.isEmpty());

        rr.add(2);
        assert(!rr.isEmpty());
    },

    one_item() {
        const rr = new RoundRobin();
        rr.add(1);

        assert(rr.next() === 1);
        assert(rr.next() === 1);
        assert(rr.next() === 1);
    },

    two_items() {
        const rr = new RoundRobin();
        rr.add(1);
        rr.add(2);

        assert(rr.next() === 1);
        assert(rr.next() === 2);
        assert(rr.next() === 1);
        assert(rr.next() === 2);
        assert(rr.next() === 1);
        assert(rr.next() === 2);
    },

    three_items() {
        const rr = new RoundRobin();
        rr.add(1);
        rr.add(2);
        rr.add(3);

        assert(rr.next() === 1);
        assert(rr.next() === 2);
        assert(rr.next() === 3);
        assert(rr.next() === 1);
        assert(rr.next() === 2);
        assert(rr.next() === 3);
        assert(rr.next() === 1);
        assert(rr.next() === 2);
        assert(rr.next() === 3);
    },

    late_entries_1() {
        const rr = new RoundRobin();
        rr.add(1);
        rr.add(2);

        assert(rr.next() === 1);
        assert(rr.next() === 2);

        rr.add(3);
        assert(rr.next() === 1);
        assert(rr.next() === 2);
        assert(rr.next() === 3);

        assert(rr.next() === 1);
        assert(rr.next() === 2);
        assert(rr.next() === 3);
    },

    late_entries_2() {
        const rr = new RoundRobin();
        rr.add(1);
        rr.add(2);

        assert(rr.next() === 1);
        assert(rr.next() === 2);
        assert(rr.next() === 1);

        rr.add(3);
        rr.add(4);

        assert(rr.next() === 2);
        assert(rr.next() === 1);
        assert(rr.next() === 3);
        assert(rr.next() === 4);
    }
};
