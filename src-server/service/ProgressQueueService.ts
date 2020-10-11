import { ProgressQueue } from "../lib/ProgressQueue";
import { makeOnce } from "../lib/utils/makeOnce";

/**
 * A single instance of ProgressQueue for use by other services.
 */
export const ProgressQueueServiceGetter = makeOnce(() => {
	const service = new ProgressQueue();
	service.startTransmitting();
	return service;
});
