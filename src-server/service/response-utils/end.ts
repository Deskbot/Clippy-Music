import * as http from "http";

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
