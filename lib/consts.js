const opt = require('../options.js');

const utils = require('./utils.js');

module.exports = {
	biggestFileSizeLimit: opt.musicSizeLimit > opt.imageSizeLimit ? opt.musicSizeLimit : opt.imageSizeLimit,

	imageSizeLimStr: utils.sizeToReadbleStr(opt.imageSizeLimit),
	musicSizeLimStr: utils.sizeToReadbleStr(opt.musicSizeLimit),
	imagePlayedWithin: opt.imageUniqueCoolOff === Infinity ? 'already' : 'in the past ' + utils.secToTimeStr(opt.imageUniqueCoolOff),
	musicPlayedWithin: opt.musicUniqueCoolOff === Infinity ? 'already' : 'in the past ' + utils.secToTimeStr(opt.musicUniqueCoolOff),

	maxPercentBeforeFinished: 0.99,
	minPlayTimeToPreventReplay: 5, //seconds

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
