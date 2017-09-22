const q = require('q');

const ContentManager = require('../lib/ContentManager.js');

const cm = new ContentManager(ContentManager.recover());

//set up
function play() {
	const isNext = cm.playNext();

	if (!isNext) q.delay(1000).then(play);
}

cm.on('end', play);

cm.emit('end'); //kick start the cycle of checking for things

module.exports = cm;
