module.exports = {
	DownloadError: class DownloadError extends Error {
		constructor(mess, reason) {
			super(mess);
			this.reason = reason;
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
