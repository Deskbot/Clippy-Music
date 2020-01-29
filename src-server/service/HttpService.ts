import * as cookie from "cookie";
import * as http from "http";
import * as formidable from "formidable";
import * as q from "q";
import { Quelaag } from "quelaag";
import * as send from "send";

import { URL } from "url";

import * as consts from "../consts";
import * as debug from "../lib/utils/debug";
import * as opt from "../options";
import * as utils from "../lib/utils/utils";

import { ContentServiceGetter } from "./ContentService";
import { IdFactoryGetter } from "./IdFactoryService";
import { ProgressQueueServiceGetter } from "./ProgressQueueService";
import { PasswordService } from "./PasswordService";
import { UserRecordGetter } from "./UserRecordService";
import { WebSocketServiceGetter } from "./WebSocketService";
import { BannedError, FileUploadError, UniqueError, YTError, DurationFindingError } from "../lib/errors";
import { UploadData, UrlPic, NoPic, FilePic, FileMusic, UrlMusic, UploadDataWithId } from "../types/UploadData";
import { verifyPassword } from "../lib/PasswordContainer";
import { redirectSuccessfulPost } from "./httpUtils";

type FormData = {
	fields: formidable.Fields;
	files: formidable.Files;
};

async function isPassword(password: string) {
	const passwordContainer = PasswordService.getContainer();
	if (passwordContainer == null) {
		throw new Error("The admin controls can not be used because no admin password was set.\n");
	}

	if (await verifyPassword(password as string, passwordContainer)) {
		return;
	} else {
		throw new Error("Admin password incorrect.\n");
	}
}

function getFileForm(
	req: http.IncomingMessage,
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

function handleFileUpload(req: http.IncomingMessage, contentId: number): q.Promise<[formidable.IncomingForm, formidable.Fields, formidable.Files]> {
	const ipAddress = req.connection.remoteAddress!;

	const generateProgressHandler = (file: formidable.File) => {
		ProgressQueueServiceGetter.get().setTitle(ipAddress, contentId, file.name);

		const updater = ProgressQueueServiceGetter.get().createUpdater(ipAddress, contentId);

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
			WebSocketServiceGetter.get().sendBanned(UserRecordGetter.get().getSockets(userId));
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

function noRedirect(req: http.IncomingMessage, ajax: boolean) {
	return ajax || (req.headers["user-agent"] as string).includes("curl");
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
				url: fields["music-url"] as string,
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

function recordUser(req: http.IncomingMessage, res: http.ServerResponse) {
	const ipAddress = req.connection.remoteAddress!;

	if (!UserRecordGetter.get().isUser(ipAddress)) {
		UserRecordGetter.get().add(ipAddress);
	}

	const expiryDate = new Date();
	expiryDate.setFullYear(expiryDate.getFullYear() + 1);

	//store user id in cookie
	res.setHeader('Set-Cookie', cookie.serialize("id", ipAddress, {
		maxAge: expiryDate.getTime(),
	}));
}

//creation of express instance and attaching handlers

const quelaag = new Quelaag({
	ajax() {
		return !!this.form().ajax;
	},

	form(req?) {
		return new Promise<FormData>((resolve, reject) => {
			const form = new formidable.IncomingForm();

			form.parse(req!, (err, fields, files) => {
				if (err) {
					return reject(err);

				} else {
					debug.log("fields", fields);

					resolve({
						fields,
						files,
					});
				}
			});
		});
	},

	ip(req?) {
		return req!.connection.remoteAddress!;
	},

	password() {
		const { password } = this.form();

		if (typeof password !== "undefined") {
			return password;
		}

		throw new Error("Expected field 'password' in form.");
	}
});

// TODO do I need this?
// app.use("/", (req, res, next) => {
// 	res.type("text/plain");
// 	next();
// });

quelaag.addEndpoint({
	when: req => req.url === "/api/wsport",
	do(req, res) {
		res.statusCode = 200;
		res.end(opt.webSocketPort.toString());
	}
});

/* Post variables:
	* music-file (file)
	* music-url
	* image-file (file)
	* image-url
	* start-time
	* end-time
 */
quelaag.addEndpoint({
	when: req => req.method === "POST" && req.url! === "/api/queue/add",
	do(req, res, middleware) {
		const ipAddress = middleware.ip();

		recordUser(req, res);
		const ProgressQueueService = ProgressQueueServiceGetter.get();
		const contentId = IdFactoryGetter.get().next();

		handlePotentialBan(ipAddress) //assumes ip address is userId
			.then(() => ProgressQueueServiceGetter.get().add(ipAddress, contentId))
			.then(() => handleFileUpload(req, contentId))
			.then(async ([form, fields, files]) => { //nesting in order to get the scoping right
				const uplData: UploadDataWithId = {
					...await parseUploadForm(form, fields, files),
					id: contentId,
					userId: ipAddress,
				};

				// ignore end time if it would make the play time less than 1 second
				if (uplData.endTime !== null
					&& uplData.startTime !== null
					&& uplData.endTime - uplData.startTime < 1
				) {
					uplData.endTime = null;
				}

				if (uplData.music.isUrl) {
					const { hostname } = new URL(uplData.music.url);
					if (utils.looksLikeIpAddress(hostname)) {
						// prevent cheesing the uniqueness cooloff by using the IP Address and site name
						throw new Error("I can not download music from an IP address.");
					}

					ProgressQueueServiceGetter.get().setTitle(ipAddress, contentId, uplData.music.url, true);
					// the title and duration are set later by `ContentService.add(uplData)`
				}

				try {
					var itemData = await ContentServiceGetter.get().add(uplData);
				} catch (err) {
					if (err instanceof DurationFindingError) {
						console.error("Error discerning the duration of a music file.", err, uplData.music);
						throw new FileUploadError(
							`I could not count the duration of the music file you uploaded (${uplData.music.title}).`,
							Object.values(files)
						);
					} else {
						throw err;
					}
				}

				if (itemData.music.isUrl) {
					ProgressQueueServiceGetter.get().setTitle(ipAddress, contentId, itemData.music.title);
				}

				debug.log("successful upload: ", uplData);

				if (fields.ajax || (req.headers["user-agent"] && req.headers["user-agent"].includes("curl"))) {
					res.statusCode = 200;
					res.end("Success\n");
				} else {
					redirectSuccessfulPost(res, "/");
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

					res.statusCode = 400;
					ProgressQueueService.finishedWithError(ipAddress, contentId, err);

				} else if (err instanceof BannedError) {
					res.statusCode = 400;

				} else if (err instanceof UniqueError) {
					res.statusCode = 400;
					ProgressQueueService.finishedWithError(ipAddress, contentId, err);

				} else if (err instanceof YTError) {
					res.statusCode = 400;
					ProgressQueueService.finishedWithError(ipAddress, contentId, err);

				} else {
					console.error("Unknown upload error: ", err);
					res.statusCode = 500;
					ProgressQueueService.finishedWithError(ipAddress, contentId, err);
				}

				res.end(JSON.stringify({
					contentId,
					errorType: err.constructor.name,
					message: err.message,
				}));
			});
		}
	}
);

//POST variable: content-id
quelaag.addEndpoint({
	when: req => req.url === "/api/queue/remove" && req.method === "POST",
	async do(req, res, middleware) {
		const ContentService = ContentServiceGetter.get();

		try {
			var { fields } = await middleware.form();
		} catch (err) {
			console.error("Unknown data submission error: ", err);
			res.statusCode = 500;
			res.end(err.message);
			return;
		}

		if (ContentService.remove(parseInt(fields["content-id"] as string))) {
			if (noRedirect(req, middleware.ajax())) {
				res.statusCode = 200;
				res.end("Success\n");
			} else {
				redirectSuccessfulPost(res, "/");
			}
		} else {
			res.statusCode = 400;
			res.end("OwnershipError");
		}
	}
});

//POST variable: content-id
quelaag.addEndpoint({
	when: req => req.url === "/api/download/cancel" && req.method === "POST",
	async do(req, res, middleware) {
		try {
			var { fields } = await middleware.form();
		} catch (err) {
			console.error("Unknown data submission error: ", err);
			res.statusCode = 500;
			res.end(err.message);
			return;
		}

		const ProgressQueueService = ProgressQueueServiceGetter.get();

		if (ProgressQueueService.cancel(middleware.ip(), parseInt(fields["content-id"] as string))) {
			if (noRedirect(req, middleware.ajax())) {
				res.statusCode = 200;
				res.end("Success\n");
			} else {
				redirectSuccessfulPost(res, "/");
			}
		} else {
			res.statusCode = 400;
			res.end("I could not cancel that.\n");
		}
	}
});

//POST variable: nickname
quelaag.addEndpoint({
	when: req => req.url === "/api/nickname/set",
	async do(req, res, middleware) {
		try {
			var { fields } = await middleware.form();
		} catch (err) {
			console.error("Unknown data submission error: ", err);
			res.statusCode = 500;
			res.end(err.message);
			return;
		}

		const UserRecordService = UserRecordGetter.get();
		const WebSocketService = WebSocketServiceGetter.get()

		const nickname = utils.sanitiseNickname(fields.nickname as string);

		if (nickname.length === 0) {
			res.statusCode = 400;
			res.end("Empty nicknames are not allowed.");
			return;
		}

		// check sanitised version because that's what admins will see
		if (utils.looksLikeIpAddress(nickname)) {
			res.statusCode = 400;
			res.end("Your nickname can not look like an IP address.");
			return;
		}

		UserRecordService.setNickname(middleware.ip(), nickname);
		WebSocketService.sendNicknameToUser(middleware.ip(), nickname);

		if (noRedirect(req, middleware.ajax())) {
			res.statusCode = 200;
			res.end("Success\n");
		} else {
			redirectSuccessfulPost(res, "/");
		}
	}
});

//POST variable: password, id, nickname
quelaag.addEndpoint({
	when: req => req.url === "/api/ban/add" && req.method === "POST",
	async do(req, res, middleware) {
		try {
			await isPassword(middleware.password());
		} catch (e) {
			res.statusCode = 400;
			res.end();
			return;
		}

		const ContentService = ContentServiceGetter.get();
		const UserRecordService = UserRecordGetter.get();

		try {
			var { fields } = await middleware.form();
		} catch (err) {
			console.error("Unknown data submission error: ", err);
			res.statusCode = 500;
			res.end(err.message);
		}

		if (fields.id) {
			if (!UserRecordService.isUser(fields.id as string)) {
				res.statusCode = 400;
				res.end("That user doesn't exist.\n");
				return;

			} else {
				UserRecordService.addBan(fields.id as string);
				ContentService.purgeUser(fields.id as string);
				if (noRedirect(req, middleware.ajax())) {
					res.statusCode = 200;
					res.end("Success\n");
				} else {
					redirectSuccessfulPost(res, "/");
				}
			}

		} else if (fields.nickname) {
			const uids = UserRecordService.whoHasNickname(utils.sanitiseNickname(fields.nickname as string));

			if (uids.length === 0) {
				res.statusCode = 400;
				res.end("That user doesn't exist.\n");
				return;

			} else {
				uids.forEach((id) => {
					UserRecordService.addBan(id);
					ContentService.purgeUser(id);
				});

				if (noRedirect(req, middleware.ajax())) {
					res.statusCode = 200;
					res.end("Success\n");
				} else {
					redirectSuccessfulPost(res, "/");
				}
			}

		} else {
			res.statusCode = 400;
			res.end("User not specified.\n");
		}
	}
});

//POST variable: password, id
quelaag.addEndpoint({
	when: req => req.url === "/api/ban/remove" && req.method === "POST",
	async do(req, res, middleware) {
		try {
			await isPassword(middleware.password());
		} catch (e) {
			res.statusCode = 400;
			res.end();
			return;
		}

		const UserRecordService = UserRecordGetter.get();

		try {
			var { fields } = await middleware.form();
		} catch (err) {
			console.error("Unknown data submission error: ", err);
			res.statusCode = 500;
			res.end(err.message);
		}

		if (fields.id) {
			if (!UserRecordService.isUser(fields.id as string)) {
				res.statusCode = 400;
				res.end("That user doesn't exist.\n");
				return;

			} else {
				UserRecordService.removeBan(fields.id as string);
				if (noRedirect(req, middleware.ajax())) {
					res.statusCode = 200;
					res.end("Success\n");
				} else {
					redirectSuccessfulPost(res, "/");
				}
				return;
			}

		} else if (fields.nickname) {
			const uids = UserRecordService.whoHasNickname(utils.sanitiseNickname(fields.nickname as string));
			if (uids.length === 0) {
				res.statusCode = 400;
				res.end("That user doesn't exist.\n");
				return;

			} else {
				uids.forEach((id) => {
					UserRecordService.removeBan(id);
				});

				if (noRedirect(req, middleware.ajax())) {
					res.statusCode = 200;
					res.end("Success\n");
				} else {
					redirectSuccessfulPost(res, "/");
				}
				return;
			}

		} else {
			res.statusCode = 400;
			res.end("User not specified.\n");
		}
	}
});

//POST variable: password
quelaag.addEndpoint({
	when: req => req.url === "/api/skip" && req.method === "POST",
	async do(req, res, middleware) {
		try {
			await isPassword(middleware.password());
		} catch (e) {
			res.statusCode = 400;
			res.end();
			return;
		}

		const ContentService = ContentServiceGetter.get();

		ContentService.killCurrent();
		res.statusCode = 200;
		res.end("Success\n");
	}
});

//POST variable: password
quelaag.addEndpoint({
	when: req => req.url === "/api/skipAndBan" && req.method === "POST",
	async do(req, res, middleware) {
		try {
			await isPassword(middleware.password());
		} catch (e) {
			res.statusCode = 400;
			res.end();
			return;
		}

		const ContentService = ContentServiceGetter.get();
		const UserRecordService = UserRecordGetter.get();

		if (ContentService.currentlyPlaying) {
			const id = ContentService.currentlyPlaying.userId;
			UserRecordService.addBan(id);
			ContentService.purgeUser(id);
		}

		ContentService.killCurrent();

		res.statusCode = 200;
		res.end("Success\n");
	}
});

quelaag.addEndpoint({
	when: req => req!.url === "/admin",
	do(req, res) {
		send(req, consts.staticDirPath + "/index.html")
			.pipe(res)
	}
});

quelaag.addEndpoint({
	when: req => req.url!.startsWith("/"),
	do(req, res) {
		send(req, new URL(req.url!).pathname, {
			root: consts.staticDirPath
		})
			.pipe(res);
	},
});

export function startHttpService() {
	const server = http.createServer((req, res) => quelaag.handle(req, res));
	server.listen(8080, () => {
		console.log("Web server started");
	});
}
