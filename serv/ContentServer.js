const q = require('q');

const ContentManager = require('../lib/ContentManager.js');
const YtDownloader = require('../lib/YtDownloader.js');

const utils = require('../lib/utils.js');

const IdFactoryServer = require('./IdFactoryServer.js');
const ProgressQueueServer = require('./ProgressQueueServer.js');

const cm = new ContentManager(ContentManager.recover(), IdFactoryServer, ProgressQueueServer, new YtDownloader(ProgressQueueServer));

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
