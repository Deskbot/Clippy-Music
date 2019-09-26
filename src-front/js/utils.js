var utils = {
	counterShiftResize: function($elem, procedure) {
		var oldHeight = utils.fullHeight($elem);

		var ret = procedure();

		var newHeight = utils.fullHeight($elem);

		//counter move later windows unless neither have been moved
		//in which case we want the natural page flow
		utils.shiftDownElemsBelow($elem, oldHeight - newHeight, function($e) {
			return utils.elemIsMoved($elem) || utils.elemIsMoved($e);
		});

		return ret;
	},

	displayNickname: function(name) {
		$(".my-nickname").html(name); //nicknames are sanitised
	},

	elemIsMoved: function($elem) {
		return $elem.attr("data-moved");
	},

	entitle: function(title) {
		return "\"" + utils.htmlEntityDecode(title) + "\"";
	},

	fullHeight: function($elem) {
		return $elem.height() + utils.removePx($elem.css("margin-top")) + utils.removePx($elem.css("margin-bottom"));
	},

	getUrlStart: function() {
		return window.location.protocol + "//" + window.location.hostname;
	},

	htmlEntityDecode: function(str) {
		return $("<div/>").html(str).text()
	},

	inputHasFile: function(dom) {
		dom = dom instanceof $ ? dom[0] : dom;
		return dom.files && dom.files.length > 0;
	},

	isYouTubeUrl: function(url) {
		return url.includes("youtube.com/watch")
			|| url.includes("youtu.be");
	},

	myId: function() {
		return cookie.read("id");
	},

	removePx: function(str) {
		str = str.replace("px", "");
		return parseInt(str);
	},


	formatSeconds: function(s) {
		var hours = Math.floor(s / 3600);
		var secsInHour = s % 3600;
		var mins = Math.floor(secsInHour / 60);
		var secs = s % 60;

		var str;
		str = hours > 0 ? hours + "h " : "";
		str += mins > 0 ? mins + "m " : "";
		str += secs + "s";

		return str.trim();
	},

	shiftDownElemsBelow: function($elem, distance, condition) {
		//only shift the later siblings of elem
		var $laterSections = $elem.nextAll("section"); // don't include noscript tags

		for (var i = 0; i < $laterSections.length; i++) {
			var $s = $($laterSections[i]);

			if (condition && !condition($s)) continue;

			$s.css("top", utils.removePx($s.css("top")) + distance + "px");
		}
	}
};
