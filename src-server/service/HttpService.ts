import * as cookie from "cookie";
import * as formidable from "formidable";
import * as http from "http";
import { Quelaag } from "quelaag";
import * as send from "send";
import * as url from "url";

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
import { BannedError, FileUploadError, UniqueError, YTError, DurationFindingError, AuthError, FormParseError } from "../lib/errors";
import { UploadDataWithId } from "../types/UploadData";
import { verifyPassword } from "../lib/PasswordContainer";
import { handleFileUpload, parseUploadForm } from "./request-utils/formUtils";
import { endWithSuccessText, endWithFailureText, redirectSuccessfulPost, downloadFile } from "./response-utils/end";
import { URL, UrlWithParsedQuery } from "url";
import { ServerResponse } from "http";
import { ItemData } from "../types/ItemData";
import { toNumber } from "../lib/utils/stringUtils";
import { ProgressTracker } from "../lib/ProgressQueue";

type FormData = {
	fields: formidable.Fields;
	files: formidable.Files;
};

async function assertIsAdmin(password: string): Promise<void> {
	const passwordContainer = PasswordService.getContainer();
	if (passwordContainer == null) {
		throw new AuthError("The admin controls can not be used because no admin password was set.\n");
	}

	if (await verifyPassword(password, passwordContainer)) {
		return;
	} else {
		throw new AuthError("Admin password incorrect.\n");
	}
}

function handleErrors(err: any, res: http.ServerResponse) {
	res.setHeader("Content-Type", "text/plain");
	if (err instanceof AuthError) {
		res.statusCode = 400;
		res.end(err.message);
		return;

	} else if (err instanceof FormParseError) {
		console.error("Unknown data submission error: ", err);
		res.statusCode = 500;
		res.end("I could not understand the request made.");
		return;
	}

	console.error(err);
	console.trace();
	res.statusCode = 500;

	if (err instanceof Error) {
		res.write(err.message);
	}

	res.end();
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

function recordUser(ipAddress: string, res: http.ServerResponse) {
	if (!UserRecordGetter.get().isUser(ipAddress)) {
		UserRecordGetter.get().add(ipAddress);
	}

	const expiryDate = new Date();
	expiryDate.setFullYear(expiryDate.getFullYear() + 1);

	//store user id in cookie
	res.setHeader("Set-Cookie", cookie.serialize("id", ipAddress, {
		maxAge: expiryDate.getTime(),
	}));
}

const quelaag = new Quelaag({
	async ajax(req): Promise<boolean> {
		return !!(await this.form(req)).fields.ajax;
	},

	form(req): Promise<FormData> {
		return new Promise<FormData>((resolve, reject) => {
			const form = new formidable.IncomingForm();

			form.parse(req, (err, fields, files) => {
				debug.log(err, fields, files);
				if (err) {
					reject(new FormParseError(err));
				} else {
					resolve({
						fields,
						files,
					});
				}
			});
		});
	},

	ip(req): string {
		return req.connection.remoteAddress!;
	},

	async password(req): Promise<string> {
		const { password } = (await this.form(req)).fields;

		if (typeof password !== "undefined") {
			return password as string;
		}

		throw new Error("Expected field 'password' in form.");
	},

	async noRedirect(req): Promise<boolean> {
		return (await this.ajax(req)) || (req!.headers["user-agent"] as string).includes("curl");
	},

	urlWithQuery(req): UrlWithParsedQuery {
		return url.parse(req.url!, true);
	},
}, (err) => {
	console.error(err);
	console.trace();
});

quelaag.addEndpoint({
	when: req => req.url === "/api/wsport",
	do(req, res) {
		endWithSuccessText(res, opt.webSocketPort.toString());
	}
});

/* Post variables:
	* music-file (file)
	* music-url
	* overlay-file (file)
	* overlay-url
	* start-time
	* end-time
 */
quelaag.addEndpoint({
	when: req => req.method === "POST" && req.url! === "/api/queue/add",
	do(req, res, middleware) {
		const userId = middleware.ip();

		debug.log(userId);

		recordUser(userId, res);
		const ProgressQueueService = ProgressQueueServiceGetter.get();
		const contentId = IdFactoryGetter.get().next();

		let progressTracker: ProgressTracker;

		handlePotentialBan(userId)
			.then(() => {
				progressTracker = ProgressQueueService.add(userId, contentId);
				return handleFileUpload(req, progressTracker);
			})
			.then(async ([form, fields, files]) => {
				const uplData: UploadDataWithId = {
					...await parseUploadForm(form, fields, files),
					id: contentId,
					userId: userId,
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
				}

				try {
					var itemData = await ContentServiceGetter.get().add(uplData, progressTracker);
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
					progressTracker.setTitle(itemData.music.title);
				}

				debug.log("successfully queued: ", uplData);

				if (fields.ajax || (req.headers["user-agent"] && req.headers["user-agent"].includes("curl"))) {
					endWithSuccessText(res, "Success\n");
				} else {
					redirectSuccessfulPost(res, "/");
				}
			})
			.catch((err) => {
				if (err instanceof FileUploadError) {
					debug.log("deleting these bad uploads: ", err.files);

					if (err.files) {
						for (let file of err.files) {
							if (file) {
								utils.deleteFileIfExists(file.path); // might already have been deleted if url upload
							}
						}

						delete err.files; // so they aren't sent to the user
					}

					res.statusCode = 400;
					progressTracker.finishedWithError(err);

				} else if (err instanceof BannedError) {
					res.statusCode = 400;

				} else if (err instanceof UniqueError) {
					res.statusCode = 400;
					progressTracker.finishedWithError(err);

				} else if (err instanceof YTError) {
					res.statusCode = 400;
					progressTracker.finishedWithError(err);

				} else {
					console.error("Unknown upload error: ", err);
					res.statusCode = 500;
					progressTracker.finishedWithError(err);
				}

				res.setHeader("Content-Type", "application/json");
				res.end(JSON.stringify({
					contentId,
					errorType: err.constructor.name,
					message: err.message,
				}));
			});
		}
	}
);

function validateDownload(res: ServerResponse, contentIdStr: string | string[], success: (content: ItemData) => void) {
	if (typeof contentIdStr !== "string") {
		endWithFailureText(res, "You did not specify what music to download.");
		return;
	}

	const contentId = parseInt(contentIdStr);

	if (Number.isNaN(contentId)) {
		endWithFailureText(res, "The contentId should be a number.");
		return;
	}

	const ContentService = ContentServiceGetter.get();
	const current = ContentService.getCurrentlyPlaying();

	const content = current?.id === contentId
		? current
		: ContentService.getContent(contentId);

	if (content) {
		success(content);

	} else {
		endWithFailureText(res, "You did not give a valid id for what to donwload.");
	}
}

// GET variables: id
quelaag.addEndpoint({
	when: req => req.url!.startsWith("/api/download/music") && req.method === "GET",
	do(req, res, middleware) {
		const query = middleware.urlWithQuery().query;

		validateDownload(res, query.id, (content) => {
			if (content.music.isUrl) {
				endWithFailureText(res, "I couldn't download that music for you because it was submitted by URL.");
			} else {
				downloadFile(req, res, content.music.title, content.music.path);
			}
		});
	},
	catch(err, req, res) {
		handleErrors(err, res);
	}
});

// GET variables: id
quelaag.addEndpoint({
	when: req => req.url!.startsWith("/api/download/overlay") && req.method === "GET",
	do(req, res, middleware) {
		const query = middleware.urlWithQuery().query;

		validateDownload(res, query.id, (content) => {
			if (content.overlay.isUrl) {
				endWithFailureText(res, "I couldn't download that overlay for you because it was submitted by URL.");
				return;
			}

			if (content.overlay.path) {
				downloadFile(req, res, content.overlay.title, content.overlay.path);
			} else {
				endWithFailureText(res, "The upload with that id doesn't have have an overlay.");
			}
		});
	},
	catch(err, req, res) {
		handleErrors(err, res);
	}
});

//POST variable: content-id
quelaag.addEndpoint({
	when: req => req.url === "/api/queue/remove" && req.method === "POST",
	async do(req, res, middleware) {
		const ContentService = ContentServiceGetter.get();
		const { fields } = await middleware.form();

		if (ContentService.remove(parseInt(fields["content-id"] as string))) {
			if (await middleware.noRedirect()) {
				endWithSuccessText(res, "Success\n");
			} else {
				redirectSuccessfulPost(res, "/");
			}
		} else {
			endWithFailureText(res, "OwnershipError");
		}
	},
	catch(e, req, res) {
		handleErrors(e, res);
	}
});

//POST variable: content-id
quelaag.addEndpoint({
	when: req => req.url === "/api/upload/cancel" && req.method === "POST",
	async do(req, res, middleware) {
		const ProgressQueueService = ProgressQueueServiceGetter.get();
		const { fields } = await middleware.form();

		const userId = middleware.ip();
		const contentId = parseInt(fields["content-id"] as string);

		const progressTracker = ProgressQueueService.getTracker(userId, contentId)
		if (progressTracker && progressTracker.cancel()) {
			if (await middleware.noRedirect()) {
				endWithSuccessText(res, "Success\n");
			} else {
				redirectSuccessfulPost(res, "/");
			}
		} else {
			endWithFailureText(res, "I could not cancel that.\n");
		}
	},
	catch(e, req, res) {
		handleErrors(e, res);
	}
});

//POST variable: nickname
quelaag.addEndpoint({
	when: req => req.url === "/api/nickname/set" && req.method === "POST",
	async do(req, res, middleware) {
		recordUser(middleware.ip(), res);

		const UserRecordService = UserRecordGetter.get();
		const WebSocketService = WebSocketServiceGetter.get()

		const { fields } = await middleware.form();
		const nickname = utils.sanitiseNickname(fields.nickname as string);

		if (nickname.length === 0) {
			endWithFailureText(res, "Empty nicknames are not allowed.");
			return;
		}

		// check sanitised version because that's what admins will see
		if (utils.looksLikeIpAddress(nickname)) {
			endWithFailureText(res, "Your nickname can not look like an IP address.");
			return;
		}

		UserRecordService.setNickname(middleware.ip(), nickname);
		WebSocketService.sendNicknameToUser(middleware.ip(), nickname);

		if (await middleware.noRedirect()) {
			endWithSuccessText(res, "Success\n");
		} else {
			redirectSuccessfulPost(res, "/");
		}
	},
	catch(e, req, res) {
		handleErrors(e, res);
	}
});

//POST variable: password, id, nickname
quelaag.addEndpoint({
	when: req => req.url === "/api/ban/add" && req.method === "POST",
	async do(req, res, middleware) {
		await assertIsAdmin(await middleware.password());

		const ContentService = ContentServiceGetter.get();
		const UserRecordService = UserRecordGetter.get();

		const { fields } = await middleware.form();

		if (fields.id) {
			if (!UserRecordService.isUser(fields.id as string)) {
				endWithFailureText(res, "That user doesn't exist.\n");
				return;

			} else {
				UserRecordService.addBan(fields.id as string);
				ContentService.purgeUser(fields.id as string);
				if (await middleware.noRedirect()) {
					endWithSuccessText(res, "Success\n");
				} else {
					redirectSuccessfulPost(res, "/");
				}
			}

		} else if (fields.nickname) {
			const uids = UserRecordService.whoHasNickname(utils.sanitiseNickname(fields.nickname as string));

			if (uids.length === 0) {
				endWithFailureText(res, "That user doesn't exist.\n");
				return;

			} else {
				uids.forEach((id) => {
					UserRecordService.addBan(id);
					ContentService.purgeUser(id);
				});

				if (await middleware.noRedirect()) {
					endWithSuccessText(res, "Success\n");
				} else {
					redirectSuccessfulPost(res, "/");
				}
			}

		} else {
			endWithFailureText(res, "User not specified.\n");
		}
	},
	catch(e, req, res) {
		handleErrors(e, res);
	}
});

//POST variable: password, id
quelaag.addEndpoint({
	when: req => req.url === "/api/ban/remove" && req.method === "POST",
	async do(req, res, middleware) {
		try {
			await assertIsAdmin(await middleware.password());

			const UserRecordService = UserRecordGetter.get();

			const { fields } = await middleware.form();

			if (fields.id) {
				if (!UserRecordService.isUser(fields.id as string)) {
					endWithFailureText(res, "That user doesn't exist.\n");
					return;

				} else {
					UserRecordService.removeBan(fields.id as string);
					if (await middleware.noRedirect()) {
						endWithSuccessText(res, "Success\n");
					} else {
						redirectSuccessfulPost(res, "/");
					}
					return;
				}

			} else if (fields.nickname) {
				const uids = UserRecordService.whoHasNickname(utils.sanitiseNickname(fields.nickname as string));
				if (uids.length === 0) {
					endWithFailureText(res, "That user doesn't exist.\n");
					return;

				} else {
					uids.forEach((id) => {
						UserRecordService.removeBan(id);
					});

					if (await middleware.noRedirect()) {
						endWithSuccessText(res, "Success\n");
					} else {
						redirectSuccessfulPost(res, "/");
					}
					return;
				}

			} else {
				endWithFailureText(res, "User not specified.\n");
			}
		} catch (e) {
			handleErrors(e, res);
		}
	}
});

function handleInvalidSkipParams(res: ServerResponse, fields: formidable.Fields): boolean {
	const ContentService = ContentServiceGetter.get();

	const targetId = toNumber(fields.contentId);
	if (targetId === undefined) {
		endWithFailureText(res, "Bad content id specified.\n")
		return false;
	}

	if (ContentService.getCurrentlyPlaying()?.id !== targetId) {
		endWithFailureText(res, "The requested content to skip was not playing when the request was issued.");
		return false;
	}

	return true;
}

//POST variable: contentId
quelaag.addEndpoint({
	when: req => req.url === "/api/skipMine" && req.method === "POST",
	async do(req, res, middleware) {
		if (!handleInvalidSkipParams(res, (await middleware.form()).fields)) {
			return;
		}

		const ContentService = ContentServiceGetter.get();

		if (middleware.ip() !== ContentService.getCurrentlyPlaying()?.userId) {
			endWithFailureText(res, "You can only end your own music.");
			return;
		}

		ContentService.killCurrent();
		endWithSuccessText(res, "Success\n");
	},
	catch(e, req, res) {
		handleErrors(e, res);
	}
});

//POST variable: password, contentId
quelaag.addEndpoint({
	when: req => req.url === "/api/skip" && req.method === "POST",
	async do(req, res, middleware) {
		const [password, form] = await Promise.all([middleware.password(), middleware.form()]);
		if (!handleInvalidSkipParams(res, form.fields)) {
			return;
		}

		const ContentService = ContentServiceGetter.get();

		if (middleware.ip() !== ContentService.getCurrentlyPlaying()?.userId) {
			await assertIsAdmin(password);
		}

		ContentService.killCurrent();
		endWithSuccessText(res, "Success\n");
	},
	catch(e, req, res) {
		handleErrors(e, res);
	}
});

//POST variable: password, contentId
quelaag.addEndpoint({
	when: req => req.url === "/api/skipAndBan" && req.method === "POST",
	async do(req, res, middleware) {
		const [password, form] = await Promise.all([middleware.password(), middleware.form()]);
		if (!handleInvalidSkipParams(res, form.fields)) {
			return;
		}

		await assertIsAdmin(password);

		const ContentService = ContentServiceGetter.get();
		const UserRecordService = UserRecordGetter.get();
		const current = ContentService.getCurrentlyPlaying();

		if (current) {
			const userId = current.userId;
			UserRecordService.addBan(userId);
			ContentService.purgeUser(userId);
		}

		ContentService.killCurrent();

		endWithSuccessText(res, "Success\n");
	},
	catch(e, req, res) {
		handleErrors(e, res);
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
	when: req => req.url!.startsWith("/") && req.method === "GET",
	do(req, res) {
		send(req, req.url ?? "/", {
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
