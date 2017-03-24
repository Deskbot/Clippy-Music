const opt = require('./options.js');
const kp = require('keypress');
kp(process.stdin); //gives it keypress events

const userInfo = new Map(); //id -> (ip,nickname,ws)
const ipUser = new Map(); //ip -> id
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
	userInfo: userInfo,
	ipUser: ipUser,
	contentManager: contentManager,
	banlist: banlist,
};
