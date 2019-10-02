import * as express from "express";
import * as formidable from "formidable";
import * as q from "q";

import { URL } from "url";

import * as consts from "../lib/consts";
import * as debug from "../lib/debug";
import * as opt from "../options";
import * as utils from "../lib/utils/utils";

import { ContentServiceGetter } from "./ContentService";
import { IdFactoryGetter } from "./IdFactoryService";
import { ProgressQueueServiceGetter } from "./ProgressQueueService";
import { PasswordService } from "./PasswordService";
import { UserRecordGetter } from "./UserRecordService";
import { WebSocketService } from "./WebSocketService";
import { BannedError, FileUploadError, UniqueError, YTError, DurationFindingError } from "../lib/errors";
import { UploadData, UrlPic, NoPic, FilePic, FileMusic, UrlMusic, UploadDataWithId } from "../types/UploadData";

type RequestWithFormData = express.Request & {
	fields: formidable.Fields;
	files: formidable.Files;
};

function adminCredentialsRequired(req: RequestWithFormData, res: express.Response, next: () => void) {
	const passwordService = PasswordService.get();
	if (passwordService == null) {
		res.status(400).end("The admin controls can not be used because no admin password was set.\n");
	} else if (passwordService.verify(req.fields.password as string)) {
		next();
	} else {
		res.status(400).end("Admin password incorrect.\n");
	}
}

function getFileForm(
	req: express.Request,
	generateProgressHandler: (file: formidable.File) => ((soFar: number, total: number) => void)
): q.Promise<[formidable.IncomingForm, formidable.Fields, formidable.Files]> {
	const defer = q.defer<[formidable.IncomingForm, formidable.Fields, formidable.Files]>();

	const form = new formidable.IncomingForm();
	form.maxFileSize = consts.biggestFileSizeLimit;
	form.uploadDir = consts.dirs.httpUpload;

	let lastFileField: string | undefined;
	let files: formidable.File[] = [];

	form.on("fileBegin", (fieldName) => {
		lastFileField = fieldName;
	});

	form.on("file", (fieldName: string, file: formidable.File) => {
		files.push(file);
	});

	form.on("error", (err) => {
		let fileError;

		if (lastFileField === "music-file") {
			fileError = makeMusicTooBigError(files);
		}
		else if (lastFileField === "image-file") {
			fileError = makeImageTooBigError(files);
		}
		else {
			fileError = err;
		}

		defer.reject(fileError);
	});

	form.parse(req, (err, fields, files) => {
		if (err) defer.reject(err);
		defer.resolve([form, fields, files]);
	});

	form.on("fileBegin", (fieldName, file) => {
		if (fieldName === "music-file" && file && file.name) {
			const onProgress = generateProgressHandler(file);
			form.on("progress", onProgress);
		}
	});

	return defer.promise;
}

function getFormMiddleware(req: express.Request, res: express.Response, next: () => void) {
	const form = new formidable.IncomingForm();

	form.parse(req, (err, fields, files) => {
		if (err) {
			console.error("Unknown data submission error: ", err);
			res.status(500).end(err.message);

		} else {
			const modifiedReq = req as RequestWithFormData;
			modifiedReq.fields = fields;
			modifiedReq.files = files;

			debug.log("fields", fields);

			next();
		}
	});
}

function handleFileUpload(req: express.Request, contentId: number): q.Promise<[formidable.IncomingForm, formidable.Fields, formidable.Files]> {
	const generateProgressHandler = (file: formidable.File) => {
		ProgressQueueServiceGetter.get().setTitle(req.ip, contentId, file.name);

		const updater = ProgressQueueServiceGetter.get().createUpdater(req.ip, contentId);

		return (sofar: number, total: number) => {
			updater(sofar / total);
		};
	}

	//pass along results and errors unaffected by internal error handling
	return getFileForm(req, generateProgressHandler);
}

function handlePotentialBan(userId: string) {
	return new Promise((resolve, reject) => {
		if (UserRecordGetter.get().isBanned(userId)) {
			WebSocketService.sendBanned(UserRecordGetter.get().getSockets(userId));
			return reject(new BannedError());
		}

		resolve();
	});
}

function makeImageTooBigError(files: formidable.File[]) {
	return new FileUploadError(`The image file you gave was too large. The maximum size is ${consts.imageSizeLimStr}.`, files);
}

function makeMusicTooBigError(files: formidable.File[]) {
	return new FileUploadError(`The music file you gave was too large. The maximum size is ${consts.musicSizeLimStr}.`, files);
}

function noRedirect(req: RequestWithFormData) {
	return req.fields.ajax || (req.headers["user-agent"] as string).includes("curl");
}

function parseUploadForm(
	form: formidable.IncomingForm,
	fields: formidable.Fields,
	files: formidable.Files
): Promise<UploadData> {
	return new Promise((resolve, reject) => {
		if (form.type != "multipart") {
			throw new FileUploadError(`"I require a multipart form type. I received '${form.type}' instead.`, []);
		}

		const musicFile = files["music-file"];
		const picFile = files["image-file"];

		let music: FileMusic | UrlMusic;

		//music & video
		if (fields["music-url"]) {
			music = {
				isUrl: true,
				path: fields["music-url"] as string,
			};

			if (musicFile) utils.deleteFile(musicFile.path);

		} else {
			if (!musicFile) {
				throw new FileUploadError("It looks like you uploaded a music file, but could not find it.", [musicFile, picFile]);
			}

			//no file
			if (musicFile.size === 0) {
				utils.deleteFile(musicFile.path); //empty file will still persist otherwise, due to the way multipart form uploads work / are handled
				throw new FileUploadError("You didn't specify a music file or a URL given.", [musicFile, picFile]);
			}

			//file too big
			if (musicFile.size > opt.musicSizeLimit) {
				throw makeMusicTooBigError([musicFile, picFile]);
			}

			//file wrong type
			const mimetype = musicFile.type;
			const lhs = mimetype.split("/")[0];
			if (!(lhs === "audio" || lhs === "video" || mimetype === "application/octet-stream")) { //audio, video, or default (un-typed) file
				throw new FileUploadError(`The music you uploaded was not in an audio or video format I recognise. The type of file given was "${musicFile.type}".`, [musicFile, picFile]);
			}

			//success
			music = {
				isUrl: false,
				path: musicFile.path,
				title: utils.sanitiseFilename(musicFile.name),
			};
		}

		let pic: UrlPic | FilePic | NoPic = {
			exists: false,
			isUrl: undefined,
			path: undefined,
			title: undefined,
		};

		//pic
		if (fields["image-url"]) {
			pic = {
				exists: true,
				isUrl: true,
				path: fields["image-url"] as string,
			};

			if (picFile) utils.deleteFile(picFile.path);

		} else if (picFile) {
			if (picFile.size !== 0) { //file exists
				//file too big
				if (picFile.size > opt.imageSizeLimit) {
					throw makeImageTooBigError([musicFile, picFile]);
				}

				//file wrong type
				const lhs = picFile.type.split("/")[0];
				if (lhs !== "image") {
					throw new FileUploadError(`The image file you gave was not in a format I recognise. The type of file given was "${picFile.type}".`, [musicFile, picFile]);
				}

				//success
				pic = {
					exists: true,
					isUrl: false,
					path: picFile.path,
					title: utils.sanitiseFilename(picFile.name),
				};

			} else { //empty picture given, as is typical with multipart forms where no picture is chosen
				utils.deleteFile(picFile.path);
			}
		}

		let time: string;
		let startTime: number | null = null;
		let endTime: number | null = null;

		if (time = fields["start-time"] as string) {
			startTime = utils.timeCodeToSeconds(time);
		}
		if (time = fields["end-time"] as string) {
			endTime = utils.timeCodeToSeconds(time);
		}

		resolve({
			music,
			pic,
			startTime,
			endTime,
		});
	});
}

function recordUserMiddleware(req: express.Request, res: express.Response, next: () => void) {
	if (!UserRecordGetter.get().isUser(req.ip)) UserRecordGetter.get().add(req.ip);

	const expiryDate = new Date();
	expiryDate.setFullYear(expiryDate.getFullYear() + 1);

	//store user id in cookie
	res.cookie("id", req.ip, {
		encode: a => a,
		expires: expiryDate,
	});

	next();
}

//creation of express instance and attaching handlers

const app = express();

app.use("/", express.static(consts.staticDirPath));

app.use("/admin", express.static(consts.staticDirPath + "/index.html"));

app.use("/", (req, res, next) => {
	res.type("text/plain");
	next();
});

app.get("/api/wsport", (req, res) => {
	res.status(200).end(opt.webSocketPort.toString());
});

/* Post variables:
	* music-file (file)
	* music-url
	* image-file (file)
	* image-url
	* start-time
	* end-time
 */
app.post("/api/queue/add", recordUserMiddleware, (req, res) => {
	const ProgressQueueService = ProgressQueueServiceGetter.get();
	const contentId = IdFactoryGetter.get().next();

	handlePotentialBan(req.ip) //assumes ip address is userId
	.then(() => ProgressQueueServiceGetter.get().add(req.ip, contentId))
	.then(() => handleFileUpload(req, contentId))
	.then(async ([form, fields, files]) => { //nesting in order to get the scoping right
		let uplData: UploadDataWithId = {
			...await parseUploadForm(form, fields, files),
			id: contentId,
			userId: req.ip,
		};

		// ignore end time if it would make the play time less than 1 second
		if (uplData.endTime !== null
			&& uplData.startTime !== null
			&& uplData.endTime - uplData.startTime < 1
		) {
			uplData.endTime = null;
		}

		if (uplData.music.isUrl) {
			const { hostname } = new URL(uplData.music.path);
			if (utils.looksLikeIpAddress(hostname)) {
				// prevent cheesing the uniqueness cooloff by using the IP Address and site name
				throw new Error("I can not download music from an IP address.");
			}

			ProgressQueueServiceGetter.get().setTitle(req.ip, contentId, uplData.music.path, true);
			// the title and duration are set later by `ContentService.add(uplData)`
		}

		let itemData;

		try {
			itemData = await ContentServiceGetter.get().add(uplData);
		} catch (err) {
			if (err instanceof DurationFindingError) {
				console.error("Error discerning the duration of a music file.", err, uplData.music.path);
				throw new FileUploadError(
					`I could not count the duration of the music file you uploaded (${uplData.music.title}).`,
					Object.values(files)
				);
			} else {
				throw err;
			}
		}

		if (itemData.music.isUrl) {
			ProgressQueueServiceGetter.get().setTitle(req.ip, contentId, itemData.music.title);
		}

		debug.log("successful upload: ", uplData);

		if (fields.ajax || (req.headers["user-agent"] && req.headers["user-agent"].includes("curl"))) {
			res.status(200).end("Success\n");
		} else {
			res.redirect("/");
		}
	})
	.catch(err => {
		if (err instanceof FileUploadError) {
			debug.log("deleting these bad uploads: ", err.files);

			if (err.files) {
				for (let file of err.files) {
					if (file) utils.deleteFileIfExists(file.path); // might already have been deleted if url upload
				}

				delete err.files; // so they aren't sent to the user
			}

			res.status(400);
			ProgressQueueService.finishedWithError(req.ip, contentId, err);

		} else if (err instanceof BannedError) {
			res.status(400);

		} else if (err instanceof UniqueError) {
			res.status(400);
			ProgressQueueService.finishedWithError(req.ip, contentId, err);

		} else if (err instanceof YTError) {
			res.status(400);
			ProgressQueueService.finishedWithError(req.ip, contentId, err);

		} else {
			console.error("Unknown upload error: ", err);
			res.status(500);
			ProgressQueueService.finishedWithError(req.ip, contentId, err);
		}

		res.end(JSON.stringify({
			contentId,
			errorType: err.constructor.name,
			message: err.message,
		}));
	});
});

app.use(getFormMiddleware);

//POST variable: content-id
app.post("/api/queue/remove", (req: RequestWithFormData, res) => {
	const ContentService = ContentServiceGetter.get();

	if (ContentService.remove(parseInt(req.fields["content-id"] as string))) {
		if (noRedirect(req)) res.status(200).end("Success\n");
		else				 res.redirect("/");
	} else {
		res.status(400).end("OwnershipError");
	}
});

//POST variable: content-id
app.post("/api/download/cancel", (req: RequestWithFormData, res) => {
	const ProgressQueueService = ProgressQueueServiceGetter.get();

	if (ProgressQueueService.cancel(req.ip, parseInt(req.fields["content-id"] as string))) {
		if (noRedirect(req)) res.status(200).end("Success\n");
		else				 res.redirect("/");
	} else {
		res.status(400).end("I could not cancel that.\n");
	}
});

//POST variable: nickname
app.post("/api/nickname/set", recordUserMiddleware, (req: RequestWithFormData, res) => {
	const UserRecordService = UserRecordGetter.get();

	const nickname = utils.sanitiseNickname(req.fields.nickname as string);

	if (nickname.length === 0) {
		res.status(400).end("Empty nicknames are not allowed.");
		return;
	}

	// check sanitised version because that's what admins will see
	if (utils.looksLikeIpAddress(nickname)) {
		res.status(400).end("Your nickname can not look like an IP address.");
		return;
	}

	UserRecordService.setNickname(req.ip, nickname);
	WebSocketService.sendNicknameToUser(req.ip, nickname);

	if (noRedirect(req)) res.status(200).end("Success\n");
	else				 res.redirect("/");
});

//POST variable: password, id, nickname
app.post("/api/ban/add", adminCredentialsRequired, (req: RequestWithFormData, res) => {
	const ContentService = ContentServiceGetter.get();
	const UserRecordService = UserRecordGetter.get();

	if (req.fields.id) {
		if (!UserRecordService.isUser(req.fields.id as string)) {
			res.status(400).end("That user doesn't exist.\n");
			return;

		} else {
			UserRecordService.addBan(req.fields.id as string);
			ContentService.purgeUser(req.fields.id as string);
			if (noRedirect(req)) res.status(200).end("Success\n");
			else				 res.redirect("/");
		}

	} else if (req.fields.nickname) {
		const uids = UserRecordService.whoHasNickname(utils.sanitiseNickname(req.fields.nickname as string));

		if (uids.length === 0) {
			res.status(400).end("That user doesn't exist.\n");
			return;

		} else {
			uids.forEach((id) => {
				UserRecordService.addBan(id);
				ContentService.purgeUser(id);
			});

			if (noRedirect(req)) res.status(200).end("Success\n");
			else				 res.redirect("/");
		}

	} else {
		res.status(400).end("User not specified.\n");
	}
});

//POST variable: password, id
app.post("/api/ban/remove", adminCredentialsRequired, (req: RequestWithFormData, res) => {
	const UserRecordService = UserRecordGetter.get();

	if (req.fields.id) {
		if (!UserRecordService.isUser(req.fields.id as string)) {
			res.status(400).end("That user doesn't exist.\n");
			return;

		} else {
			UserRecordService.removeBan(req.fields.id as string);
			if (noRedirect(req)) res.status(200).end("Success\n");
			else				 res.redirect("/");
		}

	} else if (req.fields.nickname) {
		const uids = UserRecordService.whoHasNickname(utils.sanitiseNickname(req.fields.nickname as string));
		if (uids.length === 0) {
			res.status(400).end("That user doesn't exist.\n");
			return;

		} else {
			uids.forEach((id) => {
				UserRecordService.removeBan(id);
			});

			if (noRedirect(req)) res.status(200).end("Success\n");
			else				 res.redirect("/");
		}

	} else {
		res.status(400).end("User not specified.\n");
	}
});

//POST variable: password
app.post("/api/skip", adminCredentialsRequired, (req, res) => {
	const ContentService = ContentServiceGetter.get();

	ContentService.killCurrent();
	res.status(200).end("Success\n");
});

//POST variable: password
app.post("/api/skipAndBan", adminCredentialsRequired, (req, res) => {
	const ContentService = ContentServiceGetter.get();
	const UserRecordService = UserRecordGetter.get();

	if (ContentService.currentlyPlaying) {
		const id = ContentService.currentlyPlaying.userId;
		UserRecordService.addBan(id);
		ContentService.purgeUser(id);
	}

	ContentService.killCurrent();

	res.status(200).end("Success\n");
});

export function startHttpService() {
	app.listen(opt.httpPort, (err) => {
		if (err) throw err;

		console.log("Web server started");
	});
}
