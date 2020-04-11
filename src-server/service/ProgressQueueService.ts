import { ProgressQueue } from "../lib/ProgressQueue";
import { MakeOnce } from "../lib/utils/MakeOnce";

/**
 * A single instance of ProgressQueue for use by other services.
 */
export const ProgressQueueServiceGetter = new (class extends MakeOnce<ProgressQueue> {
	make(): ProgressQueue {
		const service = new ProgressQueue();
		service.startTransmitting();
		return service;
	}
})();
