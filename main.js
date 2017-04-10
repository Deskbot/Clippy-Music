const opt = require('./options.js');
const kp = require('keypress');
kp(process.stdin); //gives it keypress events

const userRecord = new require('./lib/userRecord.js')();
const contentManager = new require('./lib/ContentManager2000.js')();
const banlist = new require('./lib/Banlist2000.js')();

//start the servers
const httpServer = require('./lib/HttpServer2000.js');
const wsServer = require('./lib/WebSocketServer2000.js');

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