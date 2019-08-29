const { QuickValuesMap } = require("../../../build/lib/QuickValuesMap");

const assert = require("assert");

module.exports = {
    clear: () => {
        const m = new QuickValuesMap();
        m.set(1,2);
        m.clear();

        assert(m.size == 0);
        assert(m.valuesQuick().length === 0);
    },

    constructor: () => {
        const m = new Map();
        m.set(1,1);
        m.set(2,2);
        m.set(3,3);

        const qvm = new QuickValuesMap(m);
        assert(qvm.get(1) === 1);
        assert(qvm.get(2) === 2);
        assert(qvm.get(3) === 3);
    },

    delete: () => {
        const m = new QuickValuesMap();
        m.set(1,1);
        m.set(2,2);

        m.delete(2);

        let list = [...m.valuesQuick()];

        assert(list[0] !== undefined);
        assert(list[1] === undefined);
        assert(list.length === 1);
        assert(m.size === 1);

        m.delete(1);

        list = [...m.valuesQuick()];

        assert(list[0] === undefined);
        assert(list.length === 0);
        assert(m.size === 0);
    },

    // also test order of elems
    entries: () => {
        const m = new QuickValuesMap();
        m.set(1,1);
        m.set(2,2);
        m.set(3,3);
        m.set(4,4);

        const list = [...m.entries()];
        const answer = [1,2,3,4];

        for (let i = 0; i < list.length; i++) {
            assert(list[i][0] === answer[i]);
            assert(list[i][1] === answer[i]);
        }
    },

    get: () => {
        const m = new QuickValuesMap();
        m.set(1,2);
        assert(m.get(1) === 2);
        assert(m.get(2) === undefined);
    },

    has: () => {
        const m = new QuickValuesMap();
        m.set(1,2);
        assert(m.has(1) === true);
        assert(m.has(2) === false);
    },

    size: () => {
        const m = new QuickValuesMap();
        m.set(1,1);
        assert(m.size === 1);

        m.set(2,2);
        assert(m.size === 2);
    },

    // also test order of elems
    valuesSlowAndQuick: () => {
        const m = new QuickValuesMap();
        m.set(1, 1);
        m.set(2, 2);
        m.set(3, 3);
        m.set(4, 4);

        const answer = [1,2,3,4];

        const list1 = [...m.values()];
        for (let i = 0; i < list1.length; i++) {
            assert(list1[i] === answer[i]);
        }

        const list2 = [...m.valuesQuick()];
        for (let i = 0; i < list2.length; i++) {
            assert(list1[i] === answer[i]);
        }
    },
};