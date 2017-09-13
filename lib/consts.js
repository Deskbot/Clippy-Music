const opt = require('../options.js');

const utils = require('./utils.js');

module.exports = {
	initialUploadDirName: 'httpUploads',

	musicSizeLimStr: utils.sizeToReadbleStr(opt.musicSizeLimit),
	imageSizeLimStr: utils.sizeToReadbleStr(opt.imageSizeLimit),
};
