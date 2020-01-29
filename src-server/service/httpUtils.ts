import * as http from "http";

export function redirectSuccessfulPost(res: http.ServerResponse, location: string) {
    res.writeHead(303, {
        Location: location
    });
}
