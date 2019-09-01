const baseDir = "../../../build/";
const time = require(baseDir + "lib/time");

const assert = require("assert").strict;

module.exports = {
	clipTimeByStartAndEnd: () => {
		assert.equal(time.clipTimeByStartAndEnd(0, 0, 0), 0);
		assert.equal(time.clipTimeByStartAndEnd(100, 0, 0), 0);
		assert.equal(time.clipTimeByStartAndEnd(100, 10, 10), 0);
		assert.equal(time.clipTimeByStartAndEnd(100, 0, 10), 10);
		assert.equal(time.clipTimeByStartAndEnd(100, 20, 80), 60);

		assert.equal(time.clipTimeByStartAndEnd(100, null, null), 100);
		assert.equal(time.clipTimeByStartAndEnd(100, null, 0), 0);
		assert.equal(time.clipTimeByStartAndEnd(100, 0, null), 100);
		assert.equal(time.clipTimeByStartAndEnd(100, null, 20), 20);
		assert.equal(time.clipTimeByStartAndEnd(100, 20, null), 80);
	},
};