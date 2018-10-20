const fs = require('fs');

setUpOptionsFile();

const prompt = require('prompt');
const readline = require('readline');

const consts = require('./lib/consts.js');
const debug = require('./lib/debug.js');
const opt = require('./options.js');
const utils = require('./lib/utils.js');

//prompt settings
prompt.colors = false;
prompt.message = '';
prompt.delimiter = '';
const promptOpts = {
	noHandleSIGINT: true,
}

main();

//fin

function main() {
	handleArguments().then(() => {
		validateOptions();
		setUpDirs();
		setUpServices();
		setUpControls();

	}).catch(utils.reportError);
}

function chooseAdminPassword() {
	return new Promise((resolve, reject) => {
		prompt.start(promptOpts);

		prompt.get([{
			name: 'password1',
			message: 'Set Admin Password (hidden) (1/2): ',
			hidden: true,
			required: true,
		},{
			name: 'password2',
			message: 'Verify Admin Password (hidden) (2/2): ',
			hidden: true,
			required: true,

		}], function(err, result) {
			if (err) return reject(err);

			if (result.password1 === result.password2) {
				return resolve(result.password1);
			}

			console.log('Passwords did not match. Try again.');
			return resolve(chooseAdminPassword());
		});
	});
}

function handleArguments() {
	const promises = [];
	let admin = true;
	opt.mute = false;

	for (let i = 2; i < process.argv.length; i++) { //skip the 2 initial arguments which are the path to node and the file path
		let arg = process.argv[i];

		if (arg === '-c' || arg === '--clean') {
			console.log('Deleting any suspended user record, content manager, or log file.');

			utils.deleteDirRecursiveSync(opt.storageDir);

		} else if (arg === '-d' || arg === '--debug') {
			debug.on();
		} else if (arg === '-m' || arg === '--mute') {
			opt.mute = true;
		} else if (arg === '--no-admin') {
			admin = false;
		}
	}

	if (admin) promises.push(setUpAdmin());

	return Promise.all(promises);
}

//get admin password if needed
function setUpAdmin() {
	const PasswordService = require('./service/PasswordService.js');

	return chooseAdminPassword()
	.then((pass) => {
		PasswordService.set(pass);
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
	const ContentService = require('./service/ContentService.js');
	const IdFactoryService = require('./service/IdFactoryService.js');
	const UserRecordService = require('./service/UserRecordService.js');

	//when this is about to be killed
	process.on('SIGINT', () => {
		console.log('Closing down Clippy-Music.');

		ContentService.store();
		IdFactoryService.store();
		UserRecordService.store();

		if (ContentService.isPlaying()) {
			console.log('Waiting for content being played to get deleted.');
			ContentService.on('end', () => {
				process.exit(0);
			});
		} else {
			process.exit(0);
		}

		ContentService.end();
	});

	//stdin controls
	process.stdin.resume(); //needed due to something that prompt does somewhere

	readline.emitKeypressEvents(process.stdin);
	process.stdin.setRawMode(true);
	process.stdin.on('keypress', (ch, key) => {
		if (key.name === 'end') ContentService.killCurrent();

		//I'm having to put these in because the settings that allow me to use 'end' prevent normal interrupts key commands
		else if (key.name === 'c' && key.ctrl)  process.kill(process.pid, 'SIGINT');
		else if (key.name === 's' && key.ctrl)  process.kill(process.pid, 'SIGSTOP');
		else if (key.name === 'u' && key.ctrl)  process.kill(process.pid, 'SIGKILL');
		else if (key.name === 'z' && key.ctrl)  process.kill(process.pid, 'SIGTSTP');
		else if (key.name === '\\' && key.ctrl) process.kill(process.pid, 'SIGQUIT'); //single backslash
	});
}

function setUpOptionsFile() {
	const liveFilePath = __dirname + '/options.js';

	if (fs.existsSync(liveFilePath)) return;

	console.log('Creating new options.js file from the default.');

	const defaultFilePath = __dirname + '/default_options.js';
	fs.copyFileSync(defaultFilePath, liveFilePath);
}

function setUpServices() {
	require('./service/'); //do them all just in case
}

function validateOptions() {
	if (typeof opt.timeout !== 'number') {
		console.error('Error: "timeout" setting in options.js is not a number.');
		process.exit(1);
	}
}