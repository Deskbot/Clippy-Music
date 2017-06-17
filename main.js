const fs = require('fs');
const prompt = require('prompt');
prompt.colors = false;
prompt.message = '';
prompt.delimiter = '';
const readline = require('readline');

const opt = require('./options.js');

const UserRecordClass = require('./lib/UserRecord.js');
const ContentManagerClass = require('./lib/ContentManager.js');
const BanlistClass = require('./lib/Banlist.js');

let wsServer, httpServer, userRecord, contentManager, banlist;

let adminMode = true;

//interpret input
let arg;
for (let i = 2; i < process.argv.length; i++) { //skip the 2 initial arguments which are the path to node and the file path
	arg = process.argv[i];
	
	if (arg === '-c' || arg === '--clean') {
		console.log('Deleting any suspended user record or content manager.');
		try { fs.unlinkSync(UserRecordClass.suspendedFilePath); } catch(e) {}
		try { fs.unlinkSync(ContentManagerClass.suspendedFilePath); } catch(e) {}

	} else if (arg === '--no-admin') {
		adminMode = false;
	}
}

//setup

Promise.resolve().then(() => {
	//get admin password if needed
	if (adminMode) {
		return getAdminPassword();
	}

	return null;

}).then((pass) => {
	//produce module instances
	userRecord = new UserRecordClass(UserRecordClass.recover());
	contentManager = new ContentManagerClass(ContentManagerClass.recover());
	banlist = new BanlistClass();

	//stdin controls
	readline.emitKeypressEvents(process.stdin);
	process.stdin.resume();
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

	//set up dirs, if they don't already exist
	try { fs.mkdirSync(opt.storageDir, 0o777); } catch(e) {}
	try { fs.mkdirSync(opt.storageDir + '/music', 0o777); } catch(e) {}
	try { fs.mkdirSync(opt.storageDir + '/pictures', 0o777); } catch(e) {}
	try { fs.mkdirSync(opt.storageDir + '/uploadInitialLocation', 0o777); } catch(e) {}

	//start the servers
	const environmentData = {
		adminPassword: pass,
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

}).catch((err) => {
	console.error(err);
});

function getAdminPassword() {
	return new Promise((resolve, reject) => {
		prompt.start();

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
		}]
		, function(err, result) {
			if (err) throw reject(err);

			if (result.password1 === result.password2) {
				//prompt.stop();
				resolve(result.password1);
				
			} else {
				console.log('Passwords did not match. Try again.');
				getAdminPassword().then((pass) => {
					resolve(pass);
				});
			}
		});
	});
}