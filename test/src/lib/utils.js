const baseDir = "../../../build/";
const utils = require(baseDir + "lib/utils.js");

const assert = require("assert").strict;

module.exports = {
    looksLikeIpAddress: () => {
        // ipv4

        assert(utils.looksLikeIpAddress("0.0.0"));
        assert(utils.looksLikeIpAddress("12.12.12"));
        assert(utils.looksLikeIpAddress("123.123.123"));
        assert(utils.looksLikeIpAddress("0.0.0.0"));
        assert(utils.looksLikeIpAddress("12.12.12.12"));
        assert(utils.looksLikeIpAddress("123.123.123.123"));
        assert(utils.looksLikeIpAddress("123.123.123.123.123"));
        assert(utils.looksLikeIpAddress("  12.12.12.12\t"));

        assert.strictEqual(utils.looksLikeIpAddress("0.0"), false);
        assert.strictEqual(utils.looksLikeIpAddress("hello 0.0.0.0"), false);
        assert.strictEqual(utils.looksLikeIpAddress("0.0.0.0 hello"), false);
        assert.strictEqual(utils.looksLikeIpAddress("hello 0.0.0.0 hello"), false);

        //ipv6

        assert(utils.looksLikeIpAddress("ffff:ffff:ffff"));
        assert(utils.looksLikeIpAddress("ffff:ffff:ffff:ffff"));
        assert(utils.looksLikeIpAddress("ffff:ffff::ffff"));
        assert(utils.looksLikeIpAddress("ffff:ffff::::ffff"));
        assert(utils.looksLikeIpAddress("0000:0000:0000:0000:0000:0000:0000:0000"));
        assert(utils.looksLikeIpAddress("::ffff::"));
        assert(utils.looksLikeIpAddress("\tffff:ffff:ffff:ffff  "));

        assert.strictEqual(utils.looksLikeIpAddress("hello ffff:ffff:ffff:ffff"), false);
        assert.strictEqual(utils.looksLikeIpAddress("ffff:ffff:ffff:ffff hello"), false);
        assert.strictEqual(utils.looksLikeIpAddress("hello ffff:ffff:ffff:ffff hello"), false);
        assert.strictEqual(utils.looksLikeIpAddress("xyz:ffff:ffff:ffff"), false);
        assert.strictEqual(utils.looksLikeIpAddress("ffff.ffff.ffff.ffff"), false);
        assert.strictEqual(utils.looksLikeIpAddress("fff:fffffff:fff"), false);
        assert.strictEqual(utils.looksLikeIpAddress("abc:abc"), false);

        //ipv6 followed by ipv4

        assert(utils.looksLikeIpAddress("::127.0.0.1"));
        assert(utils.looksLikeIpAddress(":ffff::127.0.0.1"));
        assert(utils.looksLikeIpAddress(":ffff:1234:6564:45:127.0.0.1"));
    },
};