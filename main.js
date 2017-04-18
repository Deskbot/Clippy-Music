const opt = require('./options.js');
const kp = require('keypress');
kp(process.stdin); //gives it keypress events

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
	contentManager.store();
	contentManager.killCurrent();
	
	process.exit(0);
});

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
}, 30000); //give people a little time to queue stuff