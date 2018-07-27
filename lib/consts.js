const opt = require('../options.js');

const utils = require('./utils.js');

module.exports = {
	biggestFileSizeLimit: opt.musicSizeLimit > opt.imageSizeLimit ? opt.musicSizeLimit : opt.imageSizeLimit,

	musicSizeLimStr:  utils.sizeToReadbleStr(opt.musicSizeLimit),
	imageSizeLimStr:  utils.sizeToReadbleStr(opt.imageSizeLimit),
	uniqueCoolOffStr: utils.secToTimeStr(opt.uniqueCoolOff),

	dirs: {
		httpUpload: opt.storageDir + '/httpUploads/',
		music:      opt.storageDir + '/music/',
		pic:        opt.storageDir + '/pictures/',
	},

	files: {
		content:   opt.storageDir + '/suspendedContentManager.json',
		idFactory: opt.storageDir + '/idFactory.txt',
		log:       opt.storageDir + '/log.txt',
		users:     opt.storageDir + '/suspendedUserRecord.json',
	},

	queueUpdateMaxFreq: 2000
};
