const baseDir = "../../../";
const utils = require(baseDir + "lib/utils.js");

const assert = require("assert").strict;

module.exports = {
    looksLikeIpAddress: () => {
        assert(utils.looksLikeIpAddress("0.0.0"));
        assert(utils.looksLikeIpAddress("12.12.12"));
        assert(utils.looksLikeIpAddress("123.123.123"));
        assert(utils.looksLikeIpAddress("0.0.0.0"));
        assert(utils.looksLikeIpAddress("12.12.12.12"));
        assert(utils.looksLikeIpAddress("123.123.123.123"));

        assert.strictEqual(utils.looksLikeIpAddress("0.0"), false);
        assert.strictEqual(utils.looksLikeIpAddress("hello 0.0.0.0"), false);
        assert.strictEqual(utils.looksLikeIpAddress("0.0.0.0 hello"), false);
        assert.strictEqual(utils.looksLikeIpAddress("hello 0.0.0.0 hello"), false);
    },
};