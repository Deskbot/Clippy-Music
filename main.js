const fs = require('fs');
const readline = require('readline');

const opt = require('./options.js');

const UserRecordClass = require('./lib/UserRecord.js');
const ContentManagerClass = require('./lib/ContentManager.js');
const BanlistClass = require('./lib/Banlist.js');

const userRecord = new UserRecordClass();
const contentManager = new ContentManagerClass();
const banlist = new BanlistClass();

//start the servers
const httpServer = require('./lib/HttpServer.js');
const wsServer = require('./lib/WebSocketServer.js');

//stdin controls
readline.emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
process.stdin.on('keypress', (ch, key) => {
	if (key.name === 'end') 
		contentManager.killCurrent();

	//I'm having to put these in because the settings that allow me to use 'end' prevent normal interrupts key commands
	else if (key.name === 'c' && key.ctrl)
		process.kill(process.pid, 'SIGINT');
	else if (key.name === 's' && key.ctrl) 
		process.kill(process.pid, 'SIGSTOP');
	else if (key.name === 'u' && key.ctrl)
		process.kill(process.pid, 'SIGKILL');
	else if (key.name === 'z' && key.ctrl)
		process.kill(process.pid, 'SIGTSTP');
	else if (key.name === '\\' && key.ctrl) //single backslash
		process.kill(process.pid, 'SIGQUIT');
});

process.on('SIGINT', () => {
	console.log('Closing down Clippy.');

	contentManager.store();

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

//set up dirs, if they don't already exist
try { fs.mkdirSync(opt.storageDir, 0o777); } catch(e) {}
try { fs.mkdirSync(opt.storageDir + '/music', 0o777); } catch(e) {}
try { fs.mkdirSync(opt.storageDir + '/pictures', 0o777); } catch(e) {}
try { fs.mkdirSync(opt.storageDir + '/uploadInitialLocation', 0o777); } catch(e) {}

//exports
module.exports = {
	userRecord: userRecord,
	contentManager: contentManager,
	banlist: banlist,
	sendBanned: (id) => {
		wsServer.sendBanned(userRecord.getSocket(id));
	},
	sendError: (id, type, reason) => {
		wsServer.sendError(userRecord.getSocket(id), type, reason);
	},
	sendMessage: (id, message) => {
		wsServer.sendMessage(userRecord.getSocket(id), message);
	},
};

contentManager.start();
