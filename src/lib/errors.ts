import * as consts from './consts.js';

import * as ContentType from './ContentType.js';

abstract class DeferredContentError extends Error {
	public readonly contentType;

	constructor(reason, contentType) {
		super(reason + ' So the content was not downloaded.');
		this.contentType = contentType;
	}
}


export class BadUrlError extends DeferredContentError {
	constructor(contentType) {
		super('The url resource requested does not exist.', contentType);
	}
}

export class BannedError extends Error {
	constructor() {
		super('You can\'t upload becuase you are banned.');
	}
}

export class CancelError extends Error {
	constructor(message) {
		super(message);
	}
}

export class DownloadTooLargeError extends DeferredContentError {
	public readonly sizeLimit;

	constructor(contentType) {
		const sizeLimit = contentType == ContentType.music ? consts.musicSizeLimStr : consts.imageSizeLimStr;
		super(`The ${contentType.toString()} requested was too large (over ${sizeLimit}).`, contentType);
		this.sizeLimit = sizeLimit;
	}
}

export class DownloadWrongTypeError extends DeferredContentError {
	public readonly actualTypeDesc;
	public readonly expectedType;

	constructor(contentType, expectedType, actualTypeDesc) {
		super(`The ${expectedType.toString()} you requested was the wrong type. It's actually a "${actualTypeDesc}".`, contentType);
		this.actualTypeDesc = actualTypeDesc;
		this.expectedType = expectedType;
	}
}

export class FileUploadError extends Error {
	public files;

	constructor(message, files) {
		super(message);
		this.files = files;
	}
}

export class UniqueError extends DeferredContentError {
	public readonly playedWithin;

	constructor(contentType) {
		let playedWithin;
		if (contentType === ContentType.music) {
			playedWithin = consts.musicPlayedWithin;
		} else {
			playedWithin = consts.imagePlayedWithin;
		}

		super(`The ${contentType} you gave has been played in the past ${playedWithin}.`, contentType);
		this.playedWithin = playedWithin;
	}
}

export class UnknownDownloadError extends DeferredContentError {
	constructor(message, contentType) {
		super(message, contentType);
	}
}

export class YTError extends Error {
	constructor(message) {
		super(message);
	}
}