const ProgressQueue = require('../lib/ProgressQueue.js');

const idFactory = require('./IdFactoryService.js');

const progressQueue = new ProgressQueue(idFactory);
progressQueue.startTransmitting();

module.exports = progressQueue;