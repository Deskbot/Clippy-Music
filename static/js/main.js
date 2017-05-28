clippy.Balloon.prototype.CLOSE_BALLOON_DELAY = 20000;

var clippyAgent = null;

function isYouTubeUrl(url) {
	return url.includes('youtube.com/watch')
		|| url.includes('youtu.be');
}

function loadClippy() {
	return new Promise(function(resolve, reject) {
		clippy.load({ name: 'Clippy', path: 'js/agents/' }, (agent) => {
			resolve(agent);
		});
	});
}

function setKonamiCode() {
	let easterEgg = new Konami();
	easterEgg.code = partyMode;
	easterEgg.load();
}