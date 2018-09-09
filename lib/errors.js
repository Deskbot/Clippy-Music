module.exports = {
	BannedError: class BannedError extends Error {},

	CancelError: class CancelError extends Error {
		constructor(message, contentType) {
			super(message);
			this.reason = 'cancel';
			this.contentType = contentType;
		}
	},
	
	DownloadError: class DownloadError extends Error {
		constructor(reason, contentType) {
			super(reason);
			this.reason = 'dl';
			this.contentType = contentType;
		}
	},

	FileUploadError: class FileUploadError extends Error {
		constructor(message, contentType, files) {
			super(message);
			this.contentType = contentType;
			this.files = files;
			this.reason = 'file';
		}
	},

	UniqueError: class UniqueError extends Error {
		constructor(contentType) {
			super(`The ${contentType} file given was not unique.`);
			this.contentType = contentType;
			this.reason = 'unique';
		}
	},

	YTError: class YTError extends Error {},
};
