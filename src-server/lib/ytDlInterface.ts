import * as cp from "child_process";
import { Html5Entities } from "html-entities";
import { URL } from "url";
import * as debug from "./utils/debug";
import * as opt from "../options";
import * as utils from "./utils/utils";

export interface UrlMusicData {
    duration: number,
    uniqueUrlId: string,
    title: string,
}

export function getYtDlMusicInfo(url: string): Promise<UrlMusicData> {
    return new Promise((resolve, reject) => {
        const infoProc = cp.spawn(opt.youtubeDlCommand, [
            "--no-playlist",
            "--get-title",
            "--get-id",
            "--get-duration",
            url
        ]);
        let rawData = "";
        let rawError = "";

        infoProc.stdout.on("data", (chunk) => {
            rawData += chunk;
        });
        infoProc.on("error", (message) => {
            rawError += message;
        });
        infoProc.on("close", (code, signal) => {
            if (code === 0) {
                try {
                    var site = getShortSiteNameFromUrl(new URL(url));
                } catch (e) {
                    return reject(e);
                }

                // the order of data array is independent of the argument order to youtube-dl
                const dataArr = rawData.split("\n");

                // all the data needs to be here
                if (dataArr.length !== 4) {
                    debug.log("raw data obtained from yt-dl", url, dataArr);
                    return reject();
                }

                try {
                    const info = {
                        duration: utils.ytDlTimeStrToSec(dataArr[2]),
                        title: new Html5Entities().encode(dataArr[0]),
                        uniqueUrlId: uniqueUrlMusicIdentifier(site, dataArr[1]),
                    };

                    debug.log("yt-dl info obtained from", url, info);

                    return resolve(info);

                } catch (e) {
                    return reject(e);
                }
            }

            debug.error("yt-dl info getting error message:", rawError);

            return reject(rawError);
        });
    });
}

/**
 * Get a short name for a website from its url
 * Get the top level and first subdomain
 * i.e. www.youtube.com becomes youtube.com
 * @param url
 */
function getShortSiteNameFromUrl(url: URL): string {
    const hostnameParts = url.hostname.split(".");
    return hostnameParts.slice(hostnameParts.length - 2).join(".");
}

/**
 * Creates an identifier for music obtained by url that is unique within this program.
 */
function uniqueUrlMusicIdentifier(hostname: string, idAtTheSite: string): string {
    // hostname should not end with a space
    return hostname + " " + idAtTheSite.trimLeft();
}
