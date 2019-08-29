//all purpose handler for incoming web sockets connections and messages

import ws = require("ws");

import * as opt from "../options";

export class WebSocketHandler {
	private wss: ws.Server;

	constructor(
		onConnect: (soc: ws, id: string) => void,
		onMessage: (soc: ws, id: string, data: any) => void,
		onClose: (soc: ws, id: string) => void
	) {
		this.wss = new ws.Server({ port: opt.webSocketPort });

		this.wss.on("connection", (soc, req) => { //when a client connects
			const id = req.connection.remoteAddress!;

			//add handler to do something when the client sends a message
			soc.on("message", data => {
				onMessage(soc, id, data);
			});

			soc.on("close", () => {
				onClose(soc, id);
			});

			onConnect(soc, id);
		});
	}

	broadcast(data: any) {
		this.wss.clients.forEach(client => {
			if (client.readyState === ws.OPEN) {
				client.send(data);
			}
		});
	}

	sendToMany(socs: ws | ws[], message: any) {
		if (Array.isArray(socs)) {
			for (let soc of socs) soc.send(message);
		} else {
			socs.send(message);
		}
	}
}
