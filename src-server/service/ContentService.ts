import * as q from 'q';

import { ContentManager } from '../lib/ContentManager';
import { YtDownloader } from '../lib/YtDownloader';

import * as utils from '../lib/utils';

import { IdFactoryServiceGetter } from './IdFactoryService';
import { ProgressQueueServiceGetter } from './ProgressQueueService';
import { UserRecordServiceGetter } from './UserRecordService';
import { MakeOnce } from '../lib/MakeOnce';

export const ContentServiceGetter = new (class extends MakeOnce<ContentManager> {

	protected make(): ContentManager {
		const cm = new ContentManager(
			ContentManager.recover(),
			IdFactoryServiceGetter.get(),
			ProgressQueueServiceGetter.get(),
			UserRecordServiceGetter.get(),
			new YtDownloader(ProgressQueueServiceGetter.get())
		);

		cm.on('end', () => this.play());
		cm.run();

		return cm;
	}

	play() {
		const isNext = this.get().playNext();

		if (!isNext) {
			q.delay(1000)
				.then(() => this.play())
				.catch(utils.reportError);
		}
	}
})();
