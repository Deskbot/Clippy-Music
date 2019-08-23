import * as formidable from "formidable";

import * as consts from './consts';

import { ContentType } from './ContentType';

abstract class DeferredContentError extends Error {
	public readonly contentType: ContentType;

	constructor(reason: string, contentType: ContentType) {
		super(reason + ' So the content was not downloaded.');
		this.contentType = contentType;
	}
}


export class BadUrlError extends DeferredContentError {
	constructor(contentType: ContentType) {
		super('The url resource requested does not exist.', contentType);
	}
}

export class BannedError extends Error {
	constructor() {
		super('You can\'t upload becuase you are banned.');
	}
}

export class CancelError extends Error {
	constructor(message: string) {
		super(message);
	}
}

export class DownloadTooLargeError extends DeferredContentError {
	public readonly sizeLimit: string;

	constructor(contentType: ContentType) {
		const sizeLimit = contentType == ContentType.Music ? consts.musicSizeLimStr : consts.imageSizeLimStr;
		super(`The ${contentType.toString()} requested was too large (over ${sizeLimit}).`, contentType);
		this.sizeLimit = sizeLimit;
	}
}

export class DownloadWrongTypeError extends DeferredContentError {
	public readonly actualTypeDesc: string;
	public readonly expectedType: ContentType;

	constructor(contentType: ContentType, expectedType: ContentType, actualTypeDesc: string) {
		super(`The ${expectedType.toString()} you requested was the wrong type. It's actually a "${actualTypeDesc}".`, contentType);
		this.actualTypeDesc = actualTypeDesc;
		this.expectedType = expectedType;
	}
}

export class FileUploadError extends Error {
	public files: formidable.Files;

	constructor(message: string, files: formidable.Files) {
		super(message);
		this.files = files;
	}
}

export class UniqueError extends DeferredContentError {
	public readonly playedWithin: string;

	constructor(contentType: ContentType) {
		let playedWithin;
		if (contentType === ContentType.Music) {
			playedWithin = consts.musicPlayedWithin;
		} else {
			playedWithin = consts.imagePlayedWithin;
		}

		super(`The ${contentType} you gave has been played in the past ${playedWithin}.`, contentType);
		this.playedWithin = playedWithin;
	}
}

export class UnknownDownloadError extends DeferredContentError {
	constructor(message: string, contentType: ContentType) {
		super(message, contentType);
	}
}

export class YTError extends Error {
	constructor(message: string) {
		super(message);
	}
}
