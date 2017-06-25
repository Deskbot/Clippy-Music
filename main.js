const fs = require('fs');
const readline = require('readline');

const opt = require('./options.js');
const prompt = require('./lib/PromptTR.js');
prompt.colors = false;
prompt.message = '';
prompt.delimiter = '';

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
		try { fs.unlinkSync(UserRecordClass.suspendedFilePath); } catch(e) {}
		try { fs.unlinkSync(ContentManagerClass.suspendedFilePath); } catch(e) {}
		try { fs.unlinkSync(ContentManagerClass.logFilePath); } catch(e) {}
		try { deleteFolderRecursive(opt.storageDir + '/uploadInitialLocation') } catch(e) {console.error(e);}
		try { deleteFolderRecursive(opt.storageDir + '/music') } catch(e) {console.error(e);}
		try { deleteFolderRecursive(opt.storageDir + '/pictures') } catch(e) {console.error(e);}

		function deleteFolderRecursive(path) {
			if( fs.existsSync(path) ) {
				fs.readdirSync(path).forEach(function(file,index){
					var curPath = path + "/" + file;

					if(fs.lstatSync(curPath).isDirectory()) { // recurse
						deleteFolderRecursive(curPath);
					} else { // delete file
						fs.unlinkSync(curPath);
					}
				});
			}
		}

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

}).catch(() => {
	console.error('Unable to get admin password');
	process.exit(1);

}).then((pass) => {
	//produce module instances
	userRecord = new UserRecordClass(UserRecordClass.recover());
	contentManager = new ContentManagerClass(ContentManagerClass.recover());

	//set up dirs, if they don't already exist
	try { fs.mkdirSync(opt.storageDir, 0o777); } catch(e) {}
	try { fs.mkdirSync(opt.storageDir + '/music', 0o777); } catch(e) {}
	try { fs.mkdirSync(opt.storageDir + '/pictures', 0o777); } catch(e) {}
	try { fs.mkdirSync(opt.storageDir + '/uploadInitialLocation', 0o777); } catch(e) {}

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

	//start the servers
	const environmentData = {
		adminPassword: pass,
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
		
		}], function(err, result) {
			if (err) return reject(err);

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