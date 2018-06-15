module.exports = {
	DownloadError: class DownloadError extends Error {
		constructor(mess, reason, internalMessage) {
			super(mess);
			this.reason = reason;
			this.internalMessage = internalMessage;
		}
	},

	UniqueError: class UniqueError extends Error {
		constructor(message) {
			super(message);
			this.content = message;
		}
	},

	YTError: class YTError extends Error {},
};
