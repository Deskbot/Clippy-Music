import { ProgressQueue } from '../lib/ProgressQueue.js';

import { IdFactoryService } from './IdFactoryService.js';

export const ProgressQueueService = new ProgressQueue(IdFactoryService);
ProgressQueueService.startTransmitting();
