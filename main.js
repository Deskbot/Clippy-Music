const kp = require('keypress');
kp(process.stdin); //gives it keypress events
const fs = require('fs');

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
process.stdin.on('keypress', (ch, key) => {
	if (key.name === 'end') 
		contentManager.killCurrent();
});

process.on('SIGINT', () => {
	console.log('closing down The Music O\'Matic 2000');

	contentManager.store();
	contentManager.killCurrent();
	
	process.exit(0);
});

//set up dirs, if they don't already exist
try { fs.mkdirSync(opt.storageDir, 0770); } catch(e) {}
try { fs.mkdirSync(opt.storageDir + '/music', 0770); } catch(e) {}
try { fs.mkdirSync(opt.storageDir + '/pictures', 0770); } catch(e) {}
try { fs.mkdirSync(opt.storageDir + '/uploadInitialLocation', 0770); } catch(e) {}

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

//get ready to begin
setTimeout(function() {
	contentManager.start();
	console.log('Ready to receive!');
}, 0); //give people a little time to queue stuff