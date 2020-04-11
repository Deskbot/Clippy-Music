import * as http from "http";
import * as formidable from "formidable";
import * as q from "q";

import * as consts from "../../consts";
import * as opt from "../../options";
import * as utils from "../../lib/utils/utils";

import { FileUploadError } from "../../lib/errors";
import { UploadData, UrlOverlay, NoOverlay, FileOverlay, FileMusic, UrlMusic, OverlayMedium } from "../../types/UploadData";
import { ProgressTracker } from "../../lib/ProgressQueue";

export function parseForm(req: http.IncomingMessage, progressTracker: ProgressTracker)
    : q.Promise<[formidable.IncomingForm, formidable.Fields, formidable.Files]>
{
    const defer = q.defer<[formidable.IncomingForm, formidable.Fields, formidable.Files]>();

    const form = new formidable.IncomingForm();
    form.maxFileSize = opt.fileSizeLimit;
    form.uploadDir = consts.dirs.httpUpload;

    let lastFileField: string | undefined;
    let files: formidable.File[] = [];

    form.on("file", (fieldName: string, file: formidable.File) => {
        files.push(file);
    });

    form.on("error", (err) => {
        let fileError;

        if (lastFileField === "music-file") {
            fileError = makeMusicTooBigError(files);
        } else if (lastFileField === "overlay-file") {
            fileError = makeOverlayTooBigError(files);
        } else {
            fileError = err;
        }

        defer.reject(fileError);
    });

    const musicProgressSource = progressTracker.createSource();
    const overlayProgressSource = progressTracker.createSource();

    let musicPercentComplete = 0;
    let overlayPercentComplete = 0;

    form.once("end", () => {
        musicProgressSource.ignoreIfNoPercentGetter();
        overlayProgressSource.ignoreIfNoPercentGetter();
    });

    form.on("fileBegin", (fieldName, file) => {
        lastFileField = fieldName;

        if (fieldName === "music-file" && file && file.name) {
            form.once("progress", () => {
                progressTracker.setTitle(file.name, false);
                musicProgressSource.setPercentGetter(() => musicPercentComplete);
            });

            form.on("progress", (sofar: number, total: number) => {
                musicPercentComplete = sofar / total;
            });
        } else if (fieldName === "overlay-file" && file) {
            form.once("progress", () => {
                overlayProgressSource.setPercentGetter(() => overlayPercentComplete);
            });

            form.on("progress", (sofar: number, total: number) => {
                overlayPercentComplete = sofar / total;
            });
        }
    });

    form.on("field", (name, value) => {
        if (name === "music-url") {
            // the true title is set later by the ContentManager
            // a progress source is added later when the url is downloaded
            progressTracker.setTitle(value, true);
        }
    });

    form.parse(req, (err, fields, files) => {
        if (err) {
            defer.reject(err);
        }
        defer.resolve([form, fields, files]);
    });

    return defer.promise;
}

function makeOverlayTooBigError(files: formidable.File[]) {
    return new FileUploadError(`The overlay file you gave was too large. The maximum size is ${consts.fileSizeLimStr}.`, files);
}

function makeMusicTooBigError(files: formidable.File[]) {
    return new FileUploadError(`The music file you gave was too large. The maximum size is ${consts.fileSizeLimStr}.`, files);
}

export function extractFormData(
    form: formidable.IncomingForm,
    fields: formidable.Fields,
    files: formidable.Files
): Promise<UploadData> {
    return new Promise((resolve, reject) => {
        if (form.type != "multipart") {
            throw new FileUploadError(`"I require a multipart form type. I received '${form.type}' instead.`, []);
        }

        const musicFile = files["music-file"];
        const overlayFile = files["overlay-file"];

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
                throw new FileUploadError("It looks like you uploaded a music file, but could not find it.", [musicFile, overlayFile]);
            }

            //no file
            if (musicFile.size === 0) {
                utils.deleteFile(musicFile.path); //empty file will still persist otherwise, due to the way multipart form uploads work / are handled
                throw new FileUploadError("You didn't specify a music file or a URL given.", [musicFile, overlayFile]);
            }

            //file too big
            if (musicFile.size > opt.fileSizeLimit) {
                throw makeMusicTooBigError([musicFile, overlayFile]);
            }

            //file wrong type
            const mimetype = musicFile.type;
            const lhs = mimetype.split("/")[0];
            if (!(lhs === "audio" || lhs === "video" || mimetype === "application/octet-stream")) { //audio, video, or default (un-typed) file
                throw new FileUploadError(`The music you uploaded was not in an audio or video format I recognise. The type of file given was "${musicFile.type}".`, [musicFile, overlayFile]);
            }

            //success
            music = {
                isUrl: false,
                path: musicFile.path,
                title: utils.sanitiseFilename(musicFile.name),
            };
        }

        let overlay: UrlOverlay | FileOverlay | NoOverlay = {
            exists: false,
            isUrl: undefined,
            path: undefined,
            title: undefined,
        };

        // overlay
        if (fields["overlay-url"]) {
            overlay = {
                exists: true,
                isUrl: true,
                url: fields["overlay-url"] as string,
            };

            if (overlayFile) {
                utils.deleteFile(overlayFile.path);
            }

        } else if (overlayFile) {
            if (overlayFile.size !== 0) { //file exists
                //file too big
                if (overlayFile.size > opt.fileSizeLimit) {
                    throw makeOverlayTooBigError([musicFile, overlayFile]);
                }

                //file wrong type
                const lhs = overlayFile.type.split("/")[0];
                if (lhs !== "image" && lhs !== "video") {
                    throw new FileUploadError(`The overlay should be an image or video. The type of your file was "${overlayFile.type}".`, [musicFile, overlayFile]);
                }

                //success
                overlay = {
                    exists: true,
                    isUrl: false,
                    medium: lhs === "video" ? OverlayMedium.Video : OverlayMedium.Image,
                    path: overlayFile.path,
                    title: utils.sanitiseFilename(overlayFile.name),
                };

            } else { //empty image given, as is typical with multipart forms where no image is chosen
                utils.deleteFile(overlayFile.path);
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
            overlay,
            startTime,
            endTime,
        });
    });
}