import * as fs from "fs";
import * as https from "https";
import * as request from "request";

import * as opt from "../options";
import { ContentPart } from "../types/ContentPart";
import { BadUrlError, UnknownDownloadError, DownloadTooLargeError } from "./errors";
import { Html5Entities } from "html-entities";
import { OverlayMedium } from "../types/UploadData";
import { getFileNameFromUrl } from "./utils/stringUtils";
import { defaultIfNaN, parseNaNableInt } from "./utils/numberUtils";

export function canDownloadOverlayFromRawUrl(url: string): Promise <[string, OverlayMedium]> {
    return new Promise((resolve, reject) => {
        request.head(url, async (err, res, body) => {
            if (err) {
                err.contentType = ContentPart.Overlay;
                if (err.code === "ENOTFOUND" || err.code === "ETIMEDOUT") {
                    return reject(new BadUrlError(ContentPart.Overlay, url));
                }
                return reject(err);
            }

            if (!res) {
                return reject(new UnknownDownloadError("I could not download the requested overlay.", ContentPart.Overlay));
            }

            const mimeTypeFound = res.headers["content-type"] as string;
            const typeFound = mimeTypeFound.split("/")[0];

            let overlayMedium: OverlayMedium;
            if (typeFound === "image") {
                overlayMedium = OverlayMedium.Image;
            } else if (typeFound === "video") {
                overlayMedium = OverlayMedium.Video;
            } else {
                return reject(new BadUrlError(ContentPart.Overlay, url));
            }

            if (parseInt(res.headers["content-length"] as string) > opt.fileSizeLimit) {
                return reject(new DownloadTooLargeError(ContentPart.Overlay));
            }

            const imageName = getFileNameFromUrl(url);
            const title = new Html5Entities().encode(imageName);
            resolve([title, overlayMedium]);
        });
    });
}

export function downloadOverlayFromRawUrl(url: string, destination: string): [Promise<void>, () => number] {
    let contentLength = 0;
    let totalDataDownloaded = 0;

    const promise = new Promise<void>((resolve, reject) => {
        const streamIntoFile = fs.createWriteStream(destination);
        streamIntoFile.on("error", (err) => {
            (err as any).contentType = ContentPart.Overlay;
            return reject(err);
        });

        // start the download
        const req = https.get(url, (res) => {
            contentLength = parseNaNableInt(res.headers["content-length"]);

            if (contentLength > opt.fileSizeLimit) {
                return reject(new DownloadTooLargeError(ContentPart.Overlay));
            }

            // store the file
            res.pipe(streamIntoFile);

            // the content size was not specified, so the amount of data downloaded will not be used
            if (!Number.isNaN(contentLength)) {
                res.on("data", (data) => {
                    totalDataDownloaded += data.length;
                });
            }
            req.on("error", (err) => {
                (err as any).contentType = ContentPart.Overlay;
                return reject(err);
            });
            res.on("finish", () => {
                return resolve();
            });
        });

        req.end();
    });

    const getProgress = () => defaultIfNaN(totalDataDownloaded / contentLength, 0);

    return [promise, getProgress];
}
