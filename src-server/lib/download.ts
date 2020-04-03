import * as fs from "fs";
import * as http from "https";
import * as https from "https";
import * as request from "request";

import * as opt from "../options";
import { ContentPart } from "../types/ContentPart";
import { BadUrlError, UnknownDownloadError, DownloadTooLargeError } from "./errors";
import { Html5Entities } from "html-entities";
import { OverlayMedium } from "../types/UploadData";
import { getFileNameFromUrl } from "./utils/stringUtils";
import { defaultIfNaN, parseNaNableInt } from "./utils/numberUtils";
import { URL } from "url";

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

            const overlayMedium = mimeTypeToOverlayMedium(res.headers["content-type"]);
            if (overlayMedium === undefined) {
                return reject(new BadUrlError(ContentPart.Overlay, url, "Invalid mime type"));
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

        const protocolStr = new URL(url).protocol;
        const protocol = protocolStr === "http:" // yes literally it requires a colon
            ? http
            : protocolStr === "https:"
                ? https
                : undefined;

        if (!protocol) {
            return reject(new BadUrlError(ContentPart.Overlay, url, "Unsupported url protocol."));
        }

        // start the download
        const req = protocol.get(url, (res) => {
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
            res.on("end", () => {
                return resolve();
            });
        });

        req.on("error", (err) => {
            (err as any).contentType = ContentPart.Overlay;
            return reject(err);
        });

        req.end();
    });

    const getProgress = () => defaultIfNaN(totalDataDownloaded / contentLength, 0);

    return [promise, getProgress];
}

function mimeTypeToOverlayMedium(mimeType: string | undefined): OverlayMedium | undefined {
    if (mimeType) {
        const contentTypeArr = mimeType.split("/");
        const typeFound = contentTypeArr[0];

        if (typeFound === "image") {
            return OverlayMedium.Image;
        }

        if (typeFound === "video") {
            return OverlayMedium.Video;
        }
    }

    return undefined;
}
