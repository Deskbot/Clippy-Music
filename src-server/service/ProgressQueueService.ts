import { ProgressQueue } from '../lib/ProgressQueue';

import { IdFactoryService } from './IdFactoryService';

export const ProgressQueueService = new ProgressQueue(IdFactoryService);
ProgressQueueService.startTransmitting();
