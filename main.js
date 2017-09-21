const fs = require('fs');
const readline = require('readline');

const consts = require('./lib/consts.js');
const debug = require('./lib/debug.js');
const opt = require('./options.js');
const utils = require('./lib/utils.js');

main();

//fin

function main() {
	const settings = interpretInput();

	Promise.resolve()
	.then(() => {
		validateOptions();
		if (settings.adminMode) return setUpAdmin();
		return null;
	})
	.then(() => {
		setUpDirs();
		setUpServers();
		setUpControls();
	})
	.catch(handleError);
}

function validateOptions() {
	if (typeof opt.timeout !== 'number') {
		console.error('Error: "timeout" setting in options.js is not a number.');
		process.exit(1);
	}
}

function interpretInput() {
	const vars = {
		adminMode: true,
	};

	let arg;
	for (let i = 2; i < process.argv.length; i++) { //skip the 2 initial arguments which are the path to node and the file path
		arg = process.argv[i];
		
		if (arg === '-c' || arg === '--clean') {
			console.log('Deleting any suspended user record, content manager, or log file.');

			utils.deleteDirRecursive(opt.storageDir);

			//const dirs = consts.dirs;
			//for (let key in dirs) {
			//	try { utils.deleteDirRecursive(dirs[key]) } catch(e) { console.error(e); }
			//}

			//const files = consts.files;
			//for (let key in files) {
			//	utils.deleteFileIfExistsSync(files[key]);
			//}

		} else if (arg === '-d' || arg === '--debug') {
			debug.on();
		} else if (arg === '--no-admin') {
			vars.adminMode = false;
		}
	}

	return vars;
}

//get admin password if needed
function setUpAdmin() {
	const PasswordServer = require('./serv/PasswordServer.js');

	return PasswordServer.choose()

	.then((pass) => {
		PasswordServer.set(pass);
	})

	.catch((err) => {
		console.error('Unable to get admin password');
		console.error(err);
		process.exit(1);
	});
}

//set up dirs, if they don't already exist
function setUpDirs() {
	utils.mkdirSafelySync(opt.storageDir, 0o777);

	for (let key in consts.dirs) {
		utils.mkdirSafelySync(consts.dirs[key], 0o777);
	}
}

function setUpControls() {
	const ContentServer = require('./serv/ContentServer.js');
	const UserRecordServer = require('./serv/UserRecordServer.js');

	//when this is about to be killed
	process.on('SIGINT', () => {
		console.log('Closing down Clippy-Music.');

		ContentServer.store();
		UserRecordServer.store();

		if (ContentServer.isPlaying()) {
			console.log('Waiting for content being played to get deleted.');
			ContentServer.on('end', () => {
				process.exit(0);
			});
		} else {
			process.exit(0);
		}

		ContentServer.killCurrent();
	});

	//stdin controls
	process.stdin.resume(); //needed due to something that prompt does somewhere
	
	readline.emitKeypressEvents(process.stdin);
	process.stdin.setRawMode(true);
	process.stdin.on('keypress', (ch, key) => {
		if (key.name === 'end') ContentServer.killCurrent();

		//I'm having to put these in because the settings that allow me to use 'end' prevent normal interrupts key commands
		else if (key.name === 'c' && key.ctrl)  process.kill(process.pid, 'SIGINT');
		else if (key.name === 's' && key.ctrl)  process.kill(process.pid, 'SIGSTOP');
		else if (key.name === 'u' && key.ctrl)  process.kill(process.pid, 'SIGKILL');
		else if (key.name === 'z' && key.ctrl)  process.kill(process.pid, 'SIGTSTP');
		else if (key.name === '\\' && key.ctrl) process.kill(process.pid, 'SIGQUIT'); //single backslash
	});
}

function setUpServers() {
	require('./serv/');//do them all just in case
}

function handleError(err) {
	console.error(err);
}