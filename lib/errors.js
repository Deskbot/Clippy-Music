module.exports = {
	BannedError: class BannedError extends Error {},

	CancelError: class CancelError extends Error {},
	
	DownloadError: class DownloadError extends Error {
		constructor(mess, reason) {
			super(mess);
			this.reason = reason;
		}
	},

	FileUploadError: class FileUploadError extends Error {
		constructor(message, ...files) {
			super(message);

			this.files = files;
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
