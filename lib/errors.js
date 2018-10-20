const consts = require('./consts.js');

const ContentType = require('./ContentType.js');

class DeferredContentError extends Error {
	constructor(reason) {
		super(reason + ' So the content was not downloaded.');
	}
}

module.exports = {
	BadUrlError: class BadUrlError extends DeferredContentError {
		constructor(contentType) {
			super('The url resource requested does not exist.', contentType);
			this.contentType = contentType;
		}
	},

	BannedError: class BannedError extends Error {
		constructor() {
			super('You can\'t upload becuase you are banned.');
		}
	},

	CancelError: class CancelError extends DeferredContentError {
		constructor(message, contentType) {
			super(message);
			this.contentType = contentType;
		}
	},

	DownloadTooLargeError: class DownloadTooLargeError extends DeferredContentError {
		constructor(contentType) {
			const sizeLimit = contentType == ContentType.music ? consts.musicSizeLimStr : consts.imageSizeLimStr;
			super(`The ${contentType.toString()} requested was too large (over ${sizeLimit}).`);
			this.sizeLimit = sizeLimit;
			this.contentType = contentType;
		}
	},

	DownloadWrongTypeError: class DownloadWrongTypeError extends DeferredContentError {
		constructor(contentType, expectedType, actualTypeDesc) {
			super(`The ${expectedType.toString()} you requested was the wrong type. It's actually a "${actualTypeDesc}".`);
			this.actualTypeDesc = actualTypeDesc;
			this.contentType = contentType;
			this.expectedType = expectedType;
		}
	},

	FileUploadError: class FileUploadError extends Error {
		constructor(message, contentType, files) {
			super(message);
			this.contentType = contentType;
			this.files = files || [];
		}
	},

	UniqueError: class UniqueError extends DeferredContentError {
		constructor(contentType) {
			super(`The ${contentType} you gave has been played in the past ${consts.uniqueCoolOffStr}.`);
			this.contentType = contentType;
			this.timeWithin = consts.uniqueCoolOffStr;
		}
	},

	UnknownDownloadError: class UnknownDownloadError extends DeferredContentError {
		constructor(message, contentType) {
			super(message);
			this.contentType = contentType;
		}
	},

	YTError: class YTError extends Error {
		constructor(message) {
			super(message);
		}
	},
};
