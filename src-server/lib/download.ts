import * as fs from "fs";
import * as request from "request";

import * as opt from "../options";
import { ContentType } from "../types/ContentType";
import { BadUrlError, UnknownDownloadError, DownloadWrongTypeError, DownloadTooLargeError } from "./errors";
import { Html5Entities } from "html-entities";

export function downloadPic(url: string, destination: string): Promise < string > {
    return new Promise((resolve, reject) => {
        request.head(url, (err, res, body) => {
            if (err) {
                err.contentType = ContentType.Picture;
                if (err.code === "ENOTFOUND" || err.code === "ETIMEDOUT") {
                    return reject(new BadUrlError(ContentType.Picture));
                }
                return reject(err);
            }

            if (!res) {
                return reject(new UnknownDownloadError("Could not get a response for the request.", ContentType.Picture));
            }

            const typeFound = res.headers["content-type"] as string;

            if (typeFound.split("/")[0] !== "image") {
                return reject(new DownloadWrongTypeError(ContentType.Picture, "image", typeFound));
            }
            if (parseInt(res.headers["content-length"] as string) > opt.imageSizeLimit) {
                return reject(new DownloadTooLargeError(ContentType.Picture));
            }

            let picName: string | null = url.split("/").pop() as string;
            picName = picName.length <= 1 ? null : picName.split(".").shift() as string;

            if (picName == null) {
                picName = "";
            }

            const title = new Html5Entities().encode(picName);

            const stream = request(url).pipe(fs.createWriteStream(destination));

            stream.on("close", () => {
                return resolve(title);
            });
            stream.on("error", (err) => {
                err.contentType = ContentType.Picture;
                return reject(err);
            });
        });
    });
}
