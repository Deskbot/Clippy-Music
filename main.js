const fs = require('fs');
const readline = require('readline');

const adminPassword = require('./lib/adminPassword.js');
const debug = require('./lib/debug.js');
const opt = require('./options.js');
const utils = require('./lib/utils.js');

const UserRecordClass = require('./lib/UserRecord.js');
const ContentManagerClass = require('./lib/ContentManager.js');

let wsServer, httpServer, userRecord, contentManager;

let adminMode = true;

//interpret input
let arg;
for (let i = 2; i < process.argv.length; i++) { //skip the 2 initial arguments which are the path to node and the file path
	arg = process.argv[i];
	
	if (arg === '-c' || arg === '--clean') {
		console.log('Deleting any suspended user record, content manager, or log file.');

		utils.deleteFileIfExistsSync(UserRecordClass.suspendedFilePath);
		utils.deleteFileIfExistsSync(ContentManagerClass.suspendedFilePath);
		utils.deleteFileIfExistsSync(ContentManagerClass.logFilePath);
		try { utils.deleteFolderRecursive(opt.storageDir + '/uploadInitialLocation') } catch(e) {console.error(e);}
		try { utils.deleteFolderRecursive(opt.storageDir + '/music') }                 catch(e) {console.error(e);}
		try { utils.deleteFolderRecursive(opt.storageDir + '/pictures') }              catch(e) {console.error(e);}

	} else if (arg === '-d' || arg === '--debug') {
		debug.on();
	} else if (arg === '--no-admin') {
		adminMode = false;
	}
}

//setup

Promise.resolve().then(() => {
	//get admin password if needed
	if (adminMode) {
		return adminPassword.choose().then((pass) => {
			adminPassword.set(pass);
		});
	}

	return null;

}).catch(() => {
	console.error('Unable to get admin password');
	process.exit(1);

}).then((pass) => {
	//produce module instances
	userRecord = new UserRecordClass(UserRecordClass.recover());
	contentManager = new ContentManagerClass(ContentManagerClass.recover());

	//set up dirs, if they don't already exist
	utils.mkdirSafelySync(opt.storageDir, 0o777);
	utils.mkdirSafelySync(opt.storageDir + '/music', 0o777);
	utils.mkdirSafelySync(opt.storageDir + '/pictures', 0o777);
	utils.mkdirSafelySync(opt.storageDir + '/uploadInitialLocation', 0o777);

	process.on('SIGINT', () => {
		console.log('Closing down Clippy-Music.');

		contentManager.store();
		userRecord.store();

		if (contentManager.playingPromise) {
			console.log('Waiting for content being played to get deleted.');
			contentManager.playingPromise.then(() => {
				process.exit(0);
			})
		} else {
			process.exit(0);
		}

		contentManager.killCurrent();
	});

	//stdin controls
	process.stdin.resume(); //needed due to something that prompt does somewhere
	
	readline.emitKeypressEvents(process.stdin);
	process.stdin.setRawMode(true);
	process.stdin.on('keypress', (ch, key) => {
		if (key.name === 'end') contentManager.killCurrent();

		//I'm having to put these in because the settings that allow me to use 'end' prevent normal interrupts key commands
		else if (key.name === 'c' && key.ctrl)  process.kill(process.pid, 'SIGINT');
		else if (key.name === 's' && key.ctrl)  process.kill(process.pid, 'SIGSTOP');
		else if (key.name === 'u' && key.ctrl)  process.kill(process.pid, 'SIGKILL');
		else if (key.name === 'z' && key.ctrl)  process.kill(process.pid, 'SIGTSTP');
		else if (key.name === '\\' && key.ctrl) process.kill(process.pid, 'SIGQUIT'); //single backslash
	});

	//start the servers
	const environmentData = {
		contentManager: contentManager,
		userRecord: userRecord,
	};

	const httpServerProm = require('./lib/HttpServer.js').start(environmentData);
	wsServer = require('./lib/WebSocketServer.js').startSync(environmentData);
	
	return httpServerProm;

}).then((hs) => {
	httpServer = hs;

	//exports
	module.exports = {
		userRecord: userRecord,
		contentManager: contentManager,
		wsServer: wsServer,

		broadcastMessage: (type, mes) => {
			wsServer.broadcast(type, mes);
		},
		sendBanned: (id) => {
			if (userRecord.get(id)) wsServer.sendBanned(userRecord.getSockets(id));
		},
		sendError: (id, type, reason) => {
			if (userRecord.get(id)) wsServer.sendError(userRecord.getSockets(id), type, reason);
		},
		sendMessage: (id, type, message) => {
			if (userRecord.get(id)) wsServer.sendMessage(userRecord.getSockets(id), type, message);
		},
	};

	contentManager.start();

}).catch((err) => {
	console.error(err);
});