const ProgressQueue = require('../lib/ProgressQueue.js');

const idFactory = require('../serv/IdFactoryServer.js');

module.exports = new ProgressQueue(idFactory);