import * as q from 'q';

import { ContentManager } from '../lib/ContentManager.js';
import { YtDownloader } from '../lib/YtDownloader.js';

import * as utils from '../lib/utils.js';

import { IdFactoryService } from './IdFactoryService.js';
import { ProgressQueueService } from './ProgressQueueService.js';
import { UserRecordService } from './UserRecordService.js';

export const ContentManagerService = new ContentManager(ContentManager.recover(), IdFactoryService, ProgressQueueService, UserRecordService, new YtDownloader(ProgressQueueService));

//set up
function play() {
	const isNext = ContentManagerService.playNext();

	if (!isNext) {
		q.delay(1000)
		.then(play)
		.catch(utils.reportError);
	}
}

ContentManagerService.on('end', play);

ContentManagerService.run();
