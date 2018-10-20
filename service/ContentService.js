const q = require('q');

const ContentManager = require('../lib/ContentManager.js');
const YtDownloader = require('../lib/YtDownloader.js');

const utils = require('../lib/utils.js');

const IdFactoryService = require('./IdFactoryService.js');
const ProgressQueueService = require('./ProgressQueueService.js');
const UserRecordService = require('./UserRecordService.js');

const cm = new ContentManager(ContentManager.recover(), IdFactoryService, ProgressQueueService, UserRecordService, new YtDownloader(ProgressQueueService));

//set up
function play() {
	const isNext = cm.playNext();

	if (!isNext) {
		q.delay(1000)
		.then(play)
		.catch(utils.reportError);
	}
}

cm.on('end', play);

cm.run();

module.exports = cm;
