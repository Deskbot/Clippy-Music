import * as fs from "fs";
import * as request from "request";

import * as opt from "../options";
import { ContentType } from "../types/ContentType";
import { BadUrlError, UnknownDownloadError, DownloadWrongTypeError, DownloadTooLargeError } from "./errors";
import { Html5Entities } from "html-entities";

export function downloadImage(url: string, destination: string): Promise < string > {
    return new Promise((resolve, reject) => {
        request.head(url, (err, res, body) => {
            if (err) {
                err.contentType = ContentType.Image;
                if (err.code === "ENOTFOUND" || err.code === "ETIMEDOUT") {
                    return reject(new BadUrlError(ContentType.Image));
                }
                return reject(err);
            }

            if (!res) {
                return reject(new UnknownDownloadError("Could not get a response for the request.", ContentType.Image));
            }

            const typeFound = res.headers["content-type"] as string;

            if (typeFound.split("/")[0] !== "image") {
                return reject(new DownloadWrongTypeError(ContentType.Image, "image", typeFound));
            }
            if (parseInt(res.headers["content-length"] as string) > opt.fileSizeLimit) {
                return reject(new DownloadTooLargeError(ContentType.Image));
            }

            let imageName: string | null = url.split("/").pop() as string;
            imageName = imageName.length <= 1 ? null : imageName.split(".").shift() as string;

            if (imageName == null) {
                imageName = "";
            }

            const title = new Html5Entities().encode(imageName);

            const stream = request(url).pipe(fs.createWriteStream(destination));

            stream.on("close", () => {
                return resolve(title);
            });
            stream.on("error", (err) => {
                err.contentType = ContentType.Image;
                return reject(err);
            });
        });
    });
}
