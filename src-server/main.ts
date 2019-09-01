import prompt = require("prompt");
import * as readline from "readline";

import * as consts from "./lib/consts";
import * as debug from "./lib/debug";
import * as opt from "./options";
import * as utils from "./lib/utils";

import { PasswordService } from "./service/PasswordService";
import { ContentServiceGetter } from "./service/ContentService";
import { IdFactoryServiceGetter } from "./service/IdFactoryService";
import { UserRecordServiceGetter } from "./service/UserRecordService";

// prompt settings
prompt.colors = false;
prompt.message = "";
prompt.delimiter = "";
const promptOpts = {
	noHandleSIGINT: true,
}

main();

function main() {
	handleArguments().then(() => {
		setUpDirs();
		setUpServices();
		setUpControls();

	}).catch(utils.reportError);
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

function handleArguments(): Promise<void[]> {
	const promises: Promise<void>[] = [];
	let admin = true;
	opt.mute.set(false);

	for (let i = 2; i < process.argv.length; i++) { //skip the 2 initial arguments which are the path to node and the file path
		let arg = process.argv[i];

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

	if (admin) promises.push(setUpAdmin());

	return Promise.all(promises);
}

//get admin password if needed
function setUpAdmin(): Promise<void> {
	return chooseAdminPassword()
	.then(pass => {
		PasswordService.set(pass);
	})
	.catch(err => {
		console.error("Unable to get admin password");
		console.error(err);
		process.exit(1);
	});
}

//set up dirs, if they don't already exist
function setUpDirs() {
	utils.mkdirSafelySync(opt.storageDir, 0o777);

	Object.values(consts.dirs).forEach(dir => {
		utils.mkdirSafelySync(dir, 0o777);
	});
}

function setUpControls() {
	const ContentManager = ContentServiceGetter.get();
	const IdFactoryService = IdFactoryServiceGetter.get();
	const UserRecordService = UserRecordServiceGetter.get();

	//when this is about to be killed
	process.on("exit", () => {
		console.log("Closing down Clippy-Music...");

		ContentManager.store();
		IdFactoryService.store();
		UserRecordService.store();

		if (ContentManager.isPlaying()) {
			console.log("Waiting for content being played to get deleted.");
			ContentManager.on("end", () => {
				process.exit(0);
			});
		} else {
			process.exit(0);
		}

		ContentManager.end();
	});

	//stdin controls
	process.stdin.resume(); //needed due to something that prompt does somewhere

	readline.emitKeypressEvents(process.stdin);

	if (process.stdin.setRawMode) {
		process.stdin.setRawMode(true);
	}

	process.stdin.on("keypress", (ch, key) => {
		if (key.name === "end") ContentManager.killCurrent();

		//I'm having to put these in because the settings that allow me to use "end" prevent normal interrupts key commands
		else if (key.name === "c" && key.ctrl)  process.kill(process.pid, "SIGINT");
		else if (key.name === "s" && key.ctrl)  process.kill(process.pid, "SIGSTOP");
		else if (key.name === "u" && key.ctrl)  process.kill(process.pid, "SIGKILL");
		else if (key.name === "z" && key.ctrl)  process.kill(process.pid, "SIGTSTP");
		else if (key.name === "\\" && key.ctrl) process.kill(process.pid, "SIGQUIT"); //single backslash
	});
}

function setUpServices() {
	const { startHttpService } = require("./service/HttpService");
	startHttpService();
}
