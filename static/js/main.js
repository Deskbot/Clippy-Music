clippy.Balloon.prototype.CLOSE_BALLOON_DELAY = 20000;

const main = {
	clippyAgent: null,
}

function loadClippy() {
	return new Promise(function(resolve, reject) {
		clippy.load({ name: 'Clippy', path: 'js/agents/' }, (agent) => {
			resolve(agent);
		});
	});
}

function setKonamiCode() {
	var easterEgg = new Konami();
	easterEgg.code = partyMode;
	easterEgg.load();
}

function submitForm($form) {
	var url = $form.attr('action');
	var type = typeof $form.attr('method') !== 'undefined' ? $form.attr('method') : 'POST';
	
	if (url.includes('?')) {
		url += '&ajax=1';
	} else {
		url += '?ajax=1';
	}
	
	return $.ajax(url, {
		type: type,
		data: $form.serializeArray()
	})
}

function stringWrap(str, width, insert) {
	var result = "";
	var pos = 0;

	var iters = Math.floor(str.length / width);

	for (var i = 0; i <= iters; i++) {
		result += str.substr(pos, width) + insert;
		pos += width;
	}

	return result;
}

$(document).ready(function() {
	loadClippy()
	.then(function (clippy) {
		clippy.moveTo(window.innerWidth / 2, window.innerHeight / 2);
		clippy.play('Greeting');
		clippy.speak("Hi I'm Clippit, your music server assistant.");
		clippy.play('Alert');
		main.clippyAgent = clippy;
	})
	.then(function(){
		main.webSocketHandler = new WebSocketHandler();
	})
	.then(handlers.set)
	.then(setKonamiCode)
	.catch(function(err) {
		console.error(err);
	});
});