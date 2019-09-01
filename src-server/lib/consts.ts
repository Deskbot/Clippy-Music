import * as opt from "../options";
import * as path from "path";
import * as utils from "./utils";

export const biggestFileSizeLimit = opt.musicSizeLimit > opt.imageSizeLimit
	? opt.musicSizeLimit
	: opt.imageSizeLimit;

export const imageSizeLimStr = utils.sizeToReadbleStr(opt.imageSizeLimit);
export const musicSizeLimStr = utils.sizeToReadbleStr(opt.musicSizeLimit);
export const imagePlayedWithin = opt.imageUniqueCoolOff === Infinity
	? "already"
	: "in the past " + utils.secToTimeStr(opt.imageUniqueCoolOff);
export const musicPlayedWithin = opt.musicUniqueCoolOff === Infinity
	? "already"
	: "in the past " + utils.secToTimeStr(opt.musicUniqueCoolOff);

export const maxPercentBeforeFinished = 0.99;
export const minPlayTimeToPreventReplay = 5; //seconds

export const dirs = {
	httpUpload: opt.storageDir + "/httpUploads/",
	music:	  opt.storageDir + "/music/",
	pic:		opt.storageDir + "/pictures/",
};

export const files = {
	content:   opt.storageDir + "/suspendedContentManager.json",
	idFactory: opt.storageDir + "/idFactory.txt",
	log:	   opt.storageDir + "/log.txt",
	users:	 opt.storageDir + "/suspendedUserRecord.json",
};

export const queueUpdateMaxFreq = 2000;

export const staticDirPath = path.normalize(__dirname + "/../../src-front");
