import * as opt from "./options";
import * as path from "path";
import * as utils from "./lib/utils/utils";

export const fileSizeLimStr = utils.sizeToReadableStr(opt.fileSizeLimit);
export function imagePlayedWithin() {
	return opt.overlayUniqueCoolOff.get() === Infinity
		? "already"
		: "in the past " + utils.secToTimeStr(opt.overlayUniqueCoolOff.get());
}

export function musicPlayedWithin() {
	return opt.musicUniqueCoolOff.get() === Infinity
		? "already"
		: "in the past " + utils.secToTimeStr(opt.musicUniqueCoolOff.get());
}

export const dirs = {
	httpUpload: opt.storageDir + "/httpUploads/",
	music:	    opt.storageDir + "/music/",
	overlay:    opt.storageDir + "/overlay/",
};

export const files = {
	content:   opt.storageDir + "/suspendedContentManager.json",
	idFactory: opt.storageDir + "/suspendedIdFactory.txt",
	log:	   opt.storageDir + "/log.txt",
	password:  opt.storageDir + "/suspendedPasswordContainer.txt",
	users:	   opt.storageDir + "/suspendedUserRecord.json",
};

export const queueUpdateMaxFreq = 2000;

export const staticDirPath = path.normalize(__dirname + "/../src-front");
