import * as http from "http";
import * as formidable from "formidable";
import * as q from "q";

import * as consts from "../../consts";
import * as opt from "../../options";
import * as utils from "../../lib/utils/utils";

import { ProgressQueueServiceGetter } from "../ProgressQueueService";
import { FileUploadError } from "../../lib/errors";
import { UploadData, UrlPic, NoPic, FilePic, FileMusic, UrlMusic } from "../../types/UploadData";

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

export function handleFileUpload(req: http.IncomingMessage, contentId: number): q.Promise<[formidable.IncomingForm, formidable.Fields, formidable.Files]> {
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

function makeImageTooBigError(files: formidable.File[]) {
    return new FileUploadError(`The image file you gave was too large. The maximum size is ${consts.imageSizeLimStr}.`, files);
}

function makeMusicTooBigError(files: formidable.File[]) {
    return new FileUploadError(`The music file you gave was too large. The maximum size is ${consts.musicSizeLimStr}.`, files);
}

export function parseUploadForm(
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