const q = require('q');

const ContentManager = require('../lib/ContentManager.js');

const utils = require('../lib/utils.js');

const cm = new ContentManager(ContentManager.restore());

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
