import * as http from "http";
import { IncomingMessage, ServerResponse } from "http";
import send = require("send");

export function downloadFile(req: IncomingMessage, res: ServerResponse, title: string, path: string) {
    res.setHeader("Content-Disposition", `attachment; filename="${title}"`);
    send(req, path)
        .pipe(res);
}

export function endWithSuccessText(res: http.ServerResponse, text: string) {
    res.setHeader('Content-Type', 'text/plain');
    res.statusCode = 200;
    res.end(text);
}

export function endWithFailureText(res: http.ServerResponse, text: string) {
    res.setHeader('Content-Type', 'text/plain');
    res.statusCode = 400;
    res.end(text);
}

export function redirectSuccessfulPost(res: http.ServerResponse, location: string) {
    res.writeHead(303, {
        Location: location
    });
}
