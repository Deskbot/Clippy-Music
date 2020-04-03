import * as fs from "fs";
import * as request from "request";

import * as opt from "../options";
import { ContentPart } from "../types/ContentPart";
import { BadUrlError, UnknownDownloadError, DownloadTooLargeError } from "./errors";
import { Html5Entities } from "html-entities";
import { OverlayMedium } from "../types/UploadData";
import { getFileNameFromUrl } from "./utils/stringUtils";

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
    let totalData = 0;

    const promise = new Promise<void>((resolve, reject) => {
        const req = request(url);
        req.on("response", (res) => {
            contentLength = parseInt(res.headers["content-length"] as string);
        });

        const stream = req.pipe(fs.createWriteStream(destination));

        if (contentLength > opt.fileSizeLimit) {
            return reject(new DownloadTooLargeError(ContentPart.Overlay));
        }

        stream.on("close", () => {
            return resolve();
        });
        stream.on("data", (data) => {
            console.log(contentLength, totalData, data.length, contentLength / totalData);
            totalData += data.length;
        });
        stream.on("error", (err) => {
            err.contentType = ContentPart.Overlay;
            return reject(err);
        });
    });

    return [promise, () => contentLength === 0 ? 0 : totalData / contentLength];
}
