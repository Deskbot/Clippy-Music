clippy.Balloon.prototype.CLOSE_BALLOON_DELAY = 20000;

var main = {
	clippyAgent: null,
	goodWordArt: ['yellow-dash', 'blues', 'rainbow', 'marble-slab', 'gray-block', 'superhero', 'outline', 'up', 'slate', 'mauve', 'graydient', 'red-blue', 'purple', 'green-marble', 'aqua', 'paper-bag', 'sunset', 'chrome'],
	maxZ: 100
}

//function is from PrototypeJS
function offset(element) {
    var top = 0, left = 0;
    do {
        top += element.offsetTop  || 0;
        left += element.offsetLeft || 0;
        element = element.offsetParent;
    } while(element);

    return {
        top: top,
        left: left
    };
}

function loadClippy() {
	return new Promise(function(resolve, reject) {
		clippy.load({ name: 'Clippy', path: 'js/agents/' }, function(agent) {
			resolve(agent);
		});
	});
}

function maybeShowAdminPanel() {
	if (window.location.href.includes("admin")) {
		$('#admin-section').removeClass('hidden');
	}
}

function removePx(str) {
	str = str.replace('px', '');
	return parseInt(str);
}

function shiftDownElemsBelow($elem, distance) {
	//only shift the later siblings of elem
	var $laterSections = $elem.nextAll();
	
	for (var i = 0; i < $laterSections.length; i++) {
		var $s = $($laterSections[i]);
		
		console.log($s[0], $s.height(), distance, removePx($s.css('height')) + distance + 'px');

		$s.css('top', removePx($s.css('top')) + distance + 'px');
	}
}

function setKonamiCode() {
	var easterEgg = new Konami();
	easterEgg.code = partyMode;
	easterEgg.load();
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

$(document).ready(function() {
	loadClippy()
	.then(function(clippy) {
		clippy.moveTo(window.innerWidth * 3 / 4, window.innerHeight * 3 / 4);
		clippy.play('Greeting');
		clippy.speak("Hi I'm Clippit, your music server assistant.");
		clippy.play('Alert');
		main.clippyAgent = clippy;
	})
	.then(function() {
		main.webSocketHandler = new WebSocketHandler();
		maybeShowAdminPanel();
		setKonamiCode();
	})
	.catch(function(err) {
		console.error(err);
	});
});