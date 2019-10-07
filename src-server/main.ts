import prompt = require("prompt");
import * as readline from "readline";

import * as consts from "./consts";
import * as debug from "./lib/utils/debug";
import * as opt from "./options";
import * as utils from "./lib/utils/utils";

import * as ContentService from "./service/ContentService";
import * as IdFactoryService from "./service/IdFactoryService";
import * as UserRecordService from "./service/UserRecordService";

import { PasswordService } from "./service/PasswordService";
import { ContentServiceGetter, startPlayingContent } from "./service/ContentService";
import { startHttpService } from "./service/HttpService";
import { startWebSocketService } from "./service/WebSocketService";

// prompt settings
prompt.colors = false;
prompt.message = "";
prompt.delimiter = "";
const promptOpts = {
	noHandleSIGINT: true,
}

main();

async function main() {
	await handleArguments();

	setUpDirs();
	startWebSocketService();
	startHttpService();
	setUpControls();
	startPlayingContent();
}

function chooseAdminPassword(): Promise<string> {
	return new Promise((resolve, reject) => {
		prompt.start(promptOpts);

		prompt.get([{
			name: "password1",
			message: "Set Admin Password (hidden) (1/2): ",
			hidden: true,
			required: true,
		}, {
			name: "password2",
			message: "Verify Admin Password (hidden) (2/2): ",
			hidden: true,
			required: true,
		}], (err, result) => {

			if (err) return reject(err);

			if (result.password1 === result.password2) {
				return resolve(result.password1);
			}

			console.log("Passwords did not match. Try again.");
			return resolve(chooseAdminPassword());
		});
	});
}

async function handleArguments(): Promise<void> {
	let admin = true;
	opt.mute.set(false);

	for (let i = 2; i < process.argv.length; i++) { //skip the 2 initial arguments which are the path to node and the file path
		const arg = process.argv[i];

		if (arg === "-c" || arg === "--clean") {
			console.log("Deleting any suspended user record, content manager, or log file.");
			utils.deleteDirRecursiveSync(opt.storageDir);

		} else if (arg === "-d" || arg === "--debug") {
			debug.on();
		} else if (arg === "-m" || arg === "--mute") {
			opt.mute.set(true);
		} else if (arg === "--no-admin") {
			admin = false;
		}
	}

	if (admin) {
		await setUpAdmin();
	}
}

//get admin password if needed
async function setUpAdmin(): Promise<void> {
	try {
		const suspendedPasswordExists = PasswordService.recover();

		if (!suspendedPasswordExists) {
			const pass = await chooseAdminPassword();
			await PasswordService.setNew(pass);
		}

	} catch (err) {
		console.error("Unable to get admin password");
		console.error(err);
		process.exit(1);
	}
}

//set up dirs, if they don't already exist
function setUpDirs() {
	utils.mkdirSafelySync(opt.storageDir, 0o777);

	Object.values(consts.dirs).forEach(dir => {
		utils.mkdirSafelySync(dir, 0o777);
	});
}

function setUpControls() {
	const contentManager = ContentServiceGetter.get();

	//when this is about to be killed
	process.on("exit", () => {
		console.log("Closing down Clippy-Music...");

		ContentService.store();
		IdFactoryService.store();
		UserRecordService.store();
		PasswordService.store();

		if (contentManager.isPlaying()) {
			console.log("Waiting for content being played to get deleted.");
			contentManager.on("end", () => {
				process.exit(0);
			});
		} else {
			process.exit(0);
		}

		contentManager.end();
	});

	//stdin controls
	process.stdin.resume(); //needed due to something that prompt does somewhere

	readline.emitKeypressEvents(process.stdin);

	if (process.stdin.setRawMode) {
		process.stdin.setRawMode(true);
	}

	process.stdin.on("keypress", (ch, key) => {
		if (key.name === "end") contentManager.killCurrent();

		//I'm having to put these in because the settings that allow me to use "end" prevent normal interrupts key commands
		else if (key.name === "c" && key.ctrl)  process.kill(process.pid, "SIGINT");
		else if (key.name === "s" && key.ctrl)  process.kill(process.pid, "SIGSTOP");
		else if (key.name === "u" && key.ctrl)  process.kill(process.pid, "SIGKILL");
		else if (key.name === "z" && key.ctrl)  process.kill(process.pid, "SIGTSTP");
		else if (key.name === "\\" && key.ctrl) process.kill(process.pid, "SIGQUIT"); //single backslash
	});
}
