const fs = require('fs');
const readline = require('readline');

const debug = require('./lib/debug.js');
const opt = require('./options.js');
const utils = require('./lib/utils.js');

const ContentServer = require('./serv/ContentServer.js');
const PasswordServer = require('./serv/PasswordServer.js');
const UserRecordServer = require('./serv/UserRecordServer.js');

main();

//fin

function main() {
	const settings = interpretInput();

	Promise.resolve()
	.then(() => {
		if (settings.adminMode) return setUpAdmin();
		return null;
	})
	.then(() => {
		setUpDirs();
		setUpControls();
		setUpServers();
	})
	.catch(handleError);
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

			UserRecordServer.deleteSuspended();
			ContentServer.deleteSuspended();
			try { utils.deleteFolderRecursive(opt.storageDir + '/httpUploads') } catch(e) { console.error(e); }
			try { utils.deleteFolderRecursive(opt.storageDir + '/music') }       catch(e) { console.error(e); }
			try { utils.deleteFolderRecursive(opt.storageDir + '/pictures') }    catch(e) { console.error(e); }

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
	utils.mkdirSafelySync(opt.storageDir + '/music', 0o777);
	utils.mkdirSafelySync(opt.storageDir + '/pictures', 0o777);
	utils.mkdirSafelySync(opt.storageDir + '/uploadInitialLocation', 0o777);
}

function setUpControls() {
	//when this is about to be killed
	process.on('SIGINT', () => {
		console.log('Closing down Clippy-Music.');

		ContentServer.store();
		UserRecordServer.store();

		if (ContentServer.playingPromise) {
			console.log('Waiting for content being played to get deleted.');
			ContentServer.playingPromise.then(() => {
				process.exit(0);
			})
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