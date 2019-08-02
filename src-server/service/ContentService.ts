import * as q from 'q';

import { ContentManager } from '../lib/ContentManager';
import { YtDownloader } from '../lib/YtDownloader';

import * as utils from '../lib/utils';

import { IdFactoryService } from './IdFactoryService';
import { ProgressQueueService } from './ProgressQueueService';
import { UserRecordService } from './UserRecordService';

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
