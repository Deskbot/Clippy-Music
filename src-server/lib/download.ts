import * as fs from "fs";
import * as request from "request";

import * as opt from "../options";
import { ContentType } from "../types/ContentType";
import { BadUrlError, UnknownDownloadError, DownloadTooLargeError } from "./errors";
import { Html5Entities } from "html-entities";
import { OverlayMedium } from "../types/UploadData";

export function downloadOverlay(url: string, destination: string) {
    return new Promise<void>((resolve, reject) => {
        const stream = request(url).pipe(fs.createWriteStream(destination));

        stream.on("close", () => {
            return resolve();
        });
        stream.on("error", (err) => {
            err.contentType = ContentType.Image;
            return reject(err);
        });
    });
}

function getFileNameFromUrl(url: string): string {
    let name = url.split("/").pop();
    if (name === undefined) {
        return "";
    } else {
        name = name.length <= 1 ? undefined : name.split(".").shift();
    }

    if (name === undefined) {
        return "";
    }

    return name;
}

export function canDownloadOverlay(url: string): Promise <[string, OverlayMedium]> {
    return new Promise((resolve, reject) => {
        request.head(url, async (err, res, body) => {
            if (err) {
                err.contentType = ContentType.Image;
                if (err.code === "ENOTFOUND" || err.code === "ETIMEDOUT") {
                    return reject(new BadUrlError(ContentType.Image));
                }
                return reject(err);
            }

            if (!res) {
                return reject(new UnknownDownloadError("I could not download the requested overlay.", ContentType.Image));
            }

            const mimeTypeFound = res.headers["content-type"] as string;
            const typeFound = mimeTypeFound.split("/")[0];

            let overlayMedium: OverlayMedium;
            if (typeFound === "image") {
                overlayMedium = OverlayMedium.Image;
            } else if (typeFound === "video") {
                overlayMedium = OverlayMedium.Video;
            } else {
                return reject(new BadUrlError(ContentType.Image));
            }

            if (parseInt(res.headers["content-length"] as string) > opt.fileSizeLimit) {
                return reject(new DownloadTooLargeError(ContentType.Image));
            }

            const imageName = getFileNameFromUrl(url);
            const title = new Html5Entities().encode(imageName);
            resolve([title, overlayMedium]);
        });
    });
}
