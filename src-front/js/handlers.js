var $adminPasswordInput = $("#admin-password-input");
var $banUserFields = $("#ban-form").add("#un-ban-form");
var $fileInput = $("input[type=file]");
var $section = $("section");
var $uploadForm = $("#upload-form");
var $uploadSection = $("#upload-section");

$("html").mouseup(function() {
	$(".active").removeClass("active");
});

$section.draggable({
	handle: ".handle",
	start: function() {
		var $this = $(this);
		$this.css("z-index", main.maxZ++);
		$this.attr("data-moved", true);
	}
});

$section.click(function() {
	$(this).css("z-index", main.maxZ++);
});

$section.find(".handle > .x-button").click(function(e) {
	var $window = $(this).parentsUntil("main").last();

	//offset is caused by both height and margins
	var distance = utils.fullHeight($window);

	utils.shiftDownElemsBelow($window, distance);

	$window.remove();
});

$uploadForm.find("input[name=music-file]").change(function(e) {
	var $musicUrl = $uploadForm.find("[name=music-url]");

	if (utils.inputHasFile(this)) $musicUrl.attr("disabled", true);
	else						  $musicUrl.attr("disabled", false);

	var typeArr = this.files[0].type.split("/");

	var folder = typeArr[0] === "audio"
		? "My Music"
		: typeArr[0] === "video"
			? "My Videos"
			: "My Documents";


	var $this = $(this);

	var title = $this.val().replace("C:\\fakepath\\", "");
	var fileName = title === "" ? "No File Chosen" : "C:\\" + folder + "\\" + title;
	$this.siblings(".file-name").text(fileName ? fileName : "No File Chosen");
});

$uploadForm.find("input[name=overlay-file]").change(function(e) {
	var $musicUrl = $uploadForm.find("[name=image-url]");

	if (utils.inputHasFile(this)) $musicUrl.attr("disabled", true);
	else						  $musicUrl.attr("disabled", false);

	var typeArr = this.files[0].type.split("/");

	var folder = typeArr[0] === "image"
		? "My Pictures"
		: typeArr[0] === "video"
			? "My Videos"
			: "My Documents";

	var $this = $(this);
	var title = $this.val().replace("C:\\fakepath\\", "");
	var fileName = title === "" ? "No File Chosen" : "C:\\" + folder + "\\" + title;
	$this.siblings(".file-name").text(fileName ? fileName : "No File Chosen");
});

$uploadForm.find("input[type=url]").keyup(function(e) {
	var $this = $(this);
	var $disabledTargets = $this.siblings(".file-upload").find("input, button");

	if ($this.val().length === 0) {
		$disabledTargets.attr("disabled", false);
	} else {
		$disabledTargets.attr("disabled", true);
	}
});

$uploadForm.submit(function(e) {
	e.preventDefault();

	var $this = $(this);
	var $buttons = $this.find("button");
	var $inputs = $this.find("input");
	var $fields = $inputs.filter(":not([type=submit])");

	//validate before submit

	var musicInputElem = $this.find("[name=music-file]")[0];
	var musicUrl = $this.find("[name=music-url]").val();

	//no music file
	if (!utils.inputHasFile(musicInputElem)) {
		if (!musicUrl) {
			main.clippyAgent.stop();
			main.clippyAgent.speak("No music chosen for upload.");
			main.clippyAgent.play("Searching");
			return false;
		} else {
			try {
				if (URL) {
					new URL(musicUrl);
				}
			} catch (e) {
				main.clippyAgent.stop();
				main.clippyAgent.speak("An invalid URL was given.");
				main.clippyAgent.play("CheckingSomething");
				return false;
			}
		}
	}

	//check start / end time
	var startTime = $this.find("[name=start-time]").val();
	var endTime = $this.find("[name=end-time]").val();
	var format = /^[0-9]+(:[0-9]+)?(:[0-9]+)?$/;

	if (startTime !== "" && !format.test(startTime) || endTime !== "" && !format.test(endTime)) {
		main.clippyAgent.stop();
		main.clippyAgent.speak("Bad format given for start or end time. It should satisfy the following regular expression: " + format.toString());
		return false;
	}

	//ajax upload

	var fd = new FormData(this);
	fd.append("ajax", true);

	main.clippyAgent.stop();
	main.clippyAgent.play("Save");

	$.ajax({
		url: "/api/queue/add",
		type: "POST",
		data: fd,
		contentType: false,
		processData: false

	}).fail(function(jqxhr, textStatus, err) {
		var responseData = JSON.parse(jqxhr.responseText);

		if (jqxhr.status >= 500 && jqxhr.status < 600) {
			main.clippyAgent.stop();
			main.clippyAgent.speak("The server encountered an error trying to queue your media. Check the console and contact the developer.");
			main.clippyAgent.play("GetArtsy");
			console.error(jqxhr.responseText);

		} else if (responseData.errorType === "BannedError") {
			main.clippyAgent.stop();
			main.clippyAgent.speak(responseData.message);
			main.clippyAgent.play("EmptyTrash");
		}

		// specific error messages are given by web socket
	});

	$uploadForm.find(".file-name").text("No File Chosen");
	$fields.val(null);
	$buttons.attr("disabled", false);
	$inputs.attr("disabled", false);

	return false;
});

$("#nickname-form").submit(function(e) {
	e.preventDefault();

	var $this = $(this);
	var $nicknameField = $this.find("[name=nickname]");

	//no empty nicknames
	if ($nicknameField.val().length === 0) {
		main.clippyAgent.stop();
		main.clippyAgent.speak("Your nickname can not be an empty string.");
		main.clippyAgent.play("CheckingSomething");
		return;
	}

	var $submitButton = $this.find("[input=submit]");
	$nicknameField.attr("disabled", true);
	$submitButton.attr("disabled", true);

	main.clippyAgent.stop();
	main.clippyAgent.play("SendMail");

	//ajax upload

	$.ajax({
		url: "/api/nickname/set",
		type: "POST",
		data: {
			ajax: true,
			nickname: $nicknameField.val()
		}

	}).done(function(data, status, jqxhr) {
		main.clippyAgent.stop();
		main.clippyAgent.speak("Your nickname has been changed.");

	}).fail(function(jqxhr, textStatus, err) {
		main.clippyAgent.stop();

		if (jqxhr.status >= 500 && jqxhr.status < 600) {
			main.clippyAgent.speak("The server encountered an error trying to change your nickname. Check the console and contact the developer.");
			console.error(jqxhr.responseText);
		} else {
			main.clippyAgent.speak(jqxhr.responseText);
		}

		main.clippyAgent.play("CheckingSomething");

	}).always(function() {
		$nicknameField.val("").attr("disabled", false);
		$submitButton.attr("disabled", false);
	});

	return false;
});

$("button.file").click(function(e) {
	var $this = $(this);
	$this.siblings("[type=file]").click();
});

$fileInput.mousedown(function() {
	$(this).siblings("button.file").addClass("active").focus();
});

$fileInput.focus(function() {
	$(this).siblings("button.file").focus();
});

var $dlListContainer = $("#dl-list-container");

$dlListContainer.on("click", "button.dismiss", function(e) {
	var $this = $(this);
	var $li = $this.parent();

	var contentId = $li.attr("data-cid");
	main.dlMap.delete(contentId);

	utils.counterShiftResize($uploadSection, function() {
		DlList.showHideContainer(main.dlMap);
		$li.remove();
	});
});

$dlListContainer.on("click", ".dl-item.error .dl-bar", function(e) {
	var $dlItem = $(this).parent();
	var contentId = $dlItem.attr("data-cid");
	var item = main.dlMap.get(contentId);

	if (item && item.errorMessage) {
		main.clippyAgent.stop();
		main.clippyAgent.speak(item.errorMessage);
	}
});

$("#queue").on("click", ".bucket-container .bucket button.delete", function(e) {
	var $this = $(this);

	$this.attr("disabled", true);

	main.clippyAgent.stop();
	main.clippyAgent.play("EmptyTrash");

	var contentName = $this.siblings(".title").text();

	$.ajax({
		url: "/api/queue/remove",
		type: "POST",
		data: {
			ajax: true,
			"content-id": $this.attr("data-id"),
		}

	}).done(function() {
		var $queueSection = $("#queue-section");

		utils.counterShiftResize($queueSection, function() {
			main.clippyAgent.speak(utils.entitle(contentName) + " was deleted successfully.");

			var $buttonAncestors = $this.parentsUntil(".bucket");
			var $bucket = $buttonAncestors.first().parent();

			$buttonAncestors.first().remove(); //remove li

			//remove bucket container for user if the bucket list contains nothing
			if ($bucket.children().length === 0) $bucket.parent().remove();
		});

	}).fail(function(jqxhr, textStatus, err) {
		if (jqxhr.status >= 500 && jqxhr.status < 600) {
			main.clippyAgent.speak("The server encountered an error trying to queue your media. Check the console and contact the developer.");
			console.error(jqxhr.responseText);
			return;
		}

		if (jqxhr.responseText === "OwnershipError") {
			main.clippyAgent.speak("You didn't queue " + utils.entitle(contentName) + ", so you can't delete it.");
		} else {
			main.clippyAgent.speak(jqxhr.responseText);
		}

		$this.attr("disabled", false);
	});
});

$("#dl-list-container").on("click", "button.cancel", function(e) {
	var $this = $(this);
	var $li = $this.parent();

	$this.attr("disabled", true);

	main.clippyAgent.stop();
	main.clippyAgent.play("EmptyTrash");

	var contentId = $li.attr("data-cid");
	var contentName = $this.siblings(".title").text();

	$.ajax({
		url: "/api/upload/cancel",
		type: "POST",
		data: {
			ajax: true,
			"content-id": contentId,
		}

	}).done(function() {
		main.clippyAgent.speak("The download of " + utils.entitle(contentName) + " was cancelled.");

		utils.counterShiftResize($uploadSection, function() {
			$li.remove();

			main.dlMap.delete(contentId);

			DlList.showHideContainer(main.dlMap);
		});

	}).fail(function(jqxhr, textStatus, err) {
		if (jqxhr.status >= 500 && jqxhr.status < 600) {
			main.clippyAgent.speak("The server encountered an error trying to cancel that download. Check the console and contact the developer.");
			console.error(jqxhr.responseText);
			return;
		}

		main.clippyAgent.speak(jqxhr.responseText);

		$this.attr("disabled", false);
	});
});

$("#skip-mine-button").click(function() {
	$.ajax({
		url: "/api/skipMine",
		type: "POST",
		data: {
			ajax: true,
			contentId: main.current.id,
		}

	}).done(function() {
		main.clippyAgent.play("Congratulate");

	}).fail(function(jqxhr, textStatus, err) {
		main.clippyAgent.stop();

		if (jqxhr.status >= 500 && jqxhr.status < 600) {
			main.clippyAgent.speak("The server encountered an error trying to end the current music. Check the console and contact the developer.");
			console.error(jqxhr.responseText);
		} else {
			main.clippyAgent.speak(jqxhr.responseText);
		}
	});
});

$("#skip-button").click(function() {
	var adminPassword = $adminPasswordInput.val();

	//no empty password
	if (!adminPassword) {
		main.clippyAgent.stop();
		main.clippyAgent.speak("You need to give the admin password.");
		main.clippyAgent.play("Searching");
		return;
	}

	if (!main.current) {
		main.clippyAgent.stop();
		main.clippyAgent.speak("There is nothing playing right now.");
		main.clippyAgent.play("Searching");
		return;
	}

	$.ajax({
		url: "/api/skip",
		type: "POST",
		data: {
			ajax: true,
			password: adminPassword,
			contentId: main.current.id,
		}

	}).done(function() {
		main.clippyAgent.play("Congratulate");

	}).fail(function(jqxhr, textStatus, err) {
		main.clippyAgent.stop();

		if (jqxhr.status >= 500 && jqxhr.status < 600) {
			main.clippyAgent.speak("The server encountered an error trying to skip the current music. Check the console and contact the developer.");
			console.error(jqxhr.responseText);
		} else {
			main.clippyAgent.speak(jqxhr.responseText);
		}
	});
});

$("#skip-ban-button").click(function() {
	var adminPassword = $adminPasswordInput.val();

	//no empty password
	if (!adminPassword) {
		main.clippyAgent.stop();
		main.clippyAgent.speak("You need to give the admin password.");
		main.clippyAgent.play("Searching");
		return;
	}

	if (!main.current) {
		main.clippyAgent.stop();
		main.clippyAgent.speak("There is nothing playing right now.");
		main.clippyAgent.play("Searching");
		return;
	}

	$.ajax({
		url: "/api/skipAndBan",
		type: "POST",
		data: {
			ajax: true,
			password: adminPassword,
			contentId: main.current.id,
		}

	}).done(function() {
		main.clippyAgent.play("Congratulate");

	}).fail(function(jqxhr, textStatus, err) {
		main.clippyAgent.stop();

		if (jqxhr.status >= 500 && jqxhr.status < 600) {
			main.clippyAgent.speak("The server encountered an error trying to skip the current music. Check the console and contact the developer.");
			console.error(jqxhr.responseText);
		} else {
			main.clippyAgent.speak(jqxhr.responseText);
		}
	});
});

$("#ban-form").submit(function(e) {
	e.preventDefault();

	var adminPassword = $adminPasswordInput.val();

	//no empty password
	if (!adminPassword) {
		main.clippyAgent.stop();
		main.clippyAgent.speak("You need to give the admin password.");
		main.clippyAgent.play("Searching");
		return;
	}

	var $this = $(this);

	var id = $this.find("input[name=id]").val();
	var nickname = $this.find("input[name=nickname]").val();

	$.ajax({
		url: "/api/ban/add",
		type: "POST",
		data: {
			ajax: true,
			id: id,
			password: adminPassword,
			nickname: nickname
		}

	}).done(function() {
		$this.find("input").attr("disabled", false);
		$this.find("input[type=text]").val(null);
		main.clippyAgent.play("Congratulate");

		var bannedName = id == "" ? nickname : id;
		bannedName = "\"" + bannedName + "\"";
		main.clippyAgent.speak(bannedName + " is now banned.");

	}).fail(function(jqxhr, textStatus, err) {
		main.clippyAgent.stop();

		if (jqxhr.status >= 500 && jqxhr.status < 600) {
			main.clippyAgent.speak("The server encountered an error trying to ban " + bannedName + ". Check the console and contact the developer.");
			console.error(jqxhr.responseText);
		} else {
			main.clippyAgent.speak(jqxhr.responseText);
		}
	});
});

$("#un-ban-form").submit(function(e) {
	e.preventDefault();

	var adminPassword = $adminPasswordInput.val();

	//no empty password
	if (!adminPassword) {
		main.clippyAgent.stop();
		main.clippyAgent.speak("You need to give the admin password.");
		main.clippyAgent.play("Searching");
		return;
	}

	var $this = $(this);

	var id = $this.find("input[name=id]").val();
	var nickname = $this.find("input[name=nickname]").val();

	$.ajax({
		url: "/api/ban/remove",
		type: "POST",
		data: {
			ajax: true,
			id: id,
			password: adminPassword,
			nickname: nickname
		}

	}).done(function() {
		$this.find("input").attr("disabled", false);
		$this.find("input[type=text]").val(null);
		main.clippyAgent.play("Congratulate");

		var bannedName = id == "" ? nickname : id;
		main.clippyAgent.speak(bannedName + " is no longer banned.");

	}).fail(function(jqxhr, textStatus, err) {
		main.clippyAgent.stop();

		if (jqxhr.status >= 500 && jqxhr.status < 600) {
			main.clippyAgent.speak("The server encountered an error trying to un-ban " + bannedName + ". Check the console and contact the developer.");
			console.error(jqxhr.responseText);
		} else {
			main.clippyAgent.speak(jqxhr.responseText);
		}
	});
});

$banUserFields.find("[name=id]").keyup(function() {
	var $this = $(this);
	var $pairedField = $this.siblings("[name=nickname]");
	if ($this.val() != "") {
		$pairedField.attr("disabled", true);
	} else {
		$pairedField.attr("disabled", false);
	}
});

$banUserFields.find("[name=nickname]").keyup(function() {
	var $this = $(this);
	var $pairedField = $this.siblings("[name=id]");
	if ($this.val() != "") {
		$pairedField.attr("disabled", true);
	} else {
		$pairedField.attr("disabled", false);
	}
});

$("button").click(function(e) {
	e.preventDefault();
});

window.onbeforeunload = function() {
	main.clippyAgent.stop();
	main.clippyAgent.play("GoodBye");
};
