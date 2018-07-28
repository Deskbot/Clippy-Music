const ProgressQueue = require('../lib/ProgressQueue.js');

const idFactory = require('../serv/IdFactoryServer.js');

const progressQueue = new ProgressQueue(idFactory);
progressQueue.startTransmitting();

module.exports = progressQueue