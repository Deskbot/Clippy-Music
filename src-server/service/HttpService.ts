import * as cookie from "cookie";
import * as http from "http";
import * as formidable from "formidable";
import { Quelaag } from "quelaag";
import * as send from "send";

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
import { UploadDataWithId } from "../types/UploadData";
import { verifyPassword } from "../lib/PasswordContainer";
import { redirectSuccessfulPost } from "./httpUtils";
import { handleFileUpload, parseUploadForm } from "./request-utils/formUtils";

type FormData = {
	fields: formidable.Fields;
	files: formidable.Files;
};

async function isPassword(password: string) {
	const passwordContainer = PasswordService.getContainer();
	if (passwordContainer == null) {
		throw new Error("The admin controls can not be used because no admin password was set.\n");
	}

	if (await verifyPassword(password, passwordContainer)) {
		return;
	} else {
		throw new Error("Admin password incorrect.\n");
	}
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

const quelaag = new Quelaag({
	ajax() {
		return this.form().ajax ?? false;
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
	},

	noRedirect(req?) {
		return this.ajax() || (req!.headers["user-agent"] as string).includes("curl");
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
			if (middleware.noRedirect()) {
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
			if (middleware.noRedirect()) {
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
		recordUser(req, res);

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

		if (middleware.noRedirect()) {
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
				if (middleware.noRedirect()) {
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

				if (middleware.noRedirect()) {
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
				if (middleware.noRedirect()) {
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

				if (middleware.noRedirect()) {
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
			.pipe(res);
	}
});

quelaag.addEndpoint({
	when: req => req.url!.startsWith("/"),
	do(req, res) {
		send(req, req.url! ?? "/", {
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
