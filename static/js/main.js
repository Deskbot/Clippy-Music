clippy.Balloon.prototype.CLOSE_BALLOON_DELAY = 20000;

const main = {
	clippyAgent: null,
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

//this function makes sections 'absolute' as opposed to 'relative' as jquery-ui sets them by default
//we need to start them off normally so they start off in a natural location when the page loads
//then we change their position type without moving them on the page
function positionSections() {
	var $section = $('section');

	//setting a section to 'absolute', causes others to move as they are still 'relative', so we must 
	for (var i = $section.length - 1; i >= 0; i--) {
		var section = $section[i];
		var pos = section.getBoundingClientRect();
		
		section.style.left = pos.left + 'px'; //keep them fixed where they are when position type changes
		section.style.top = pos.top + 'px';
		section.style.position = 'absolute';
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
		setKonamiCode();
		setTimeout(function() {positionSections()}, 100);
	})
	.catch(function(err) {
		console.error(err);
	});
});