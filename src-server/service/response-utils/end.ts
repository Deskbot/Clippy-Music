import { IncomingMessage, ServerResponse } from "http";
import send = require("send");
import { JSONable } from "../../types/types";

export function downloadFile(req: IncomingMessage, res: ServerResponse, title: string, path: string) {
    res.setHeader("Content-Disposition", `attachment; filename="${title}"`);
    send(req, path)
        .pipe(res);
}

export function endWithSuccessJson(res: ServerResponse, object: JSONable) {
    res.setHeader("Content-Type", "text/json");
    res.statusCode = 200;
    res.end(JSON.stringify(object));
}

export function endWithSuccessText(res: ServerResponse, text: string) {
    res.setHeader("Content-Type", "text/plain");
    res.statusCode = 200;
    res.end(text);
}

export function endWithFailureText(res: ServerResponse, text: string) {
    res.setHeader("Content-Type", "text/plain");
    res.statusCode = 400;
    res.end(text);
}

export function redirectSuccessfulPost(res: ServerResponse, location: string) {
    res.writeHead(303, {
        Location: location
    });
}
