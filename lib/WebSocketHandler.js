const ws = require('ws');

const opt = require('../options.js');

class WSH {
	constructor(onConnect, onMessage, onClose) {
		this.wss = new ws.Server({ port: opt.webSocketPort });

		this.wss.on('connection', (soc) => { //when a client connects
			const id = WSH.socToUserId(soc);

			//add handler to do something when the client sends a message
			soc.on('message', (data, flags) => {
				if (!flag.binary) {
					messageHandler(soc, data, flags);
				} else {
					console.error('mysterious binary flag occured');
					console.error(data,flags);
				}
			});

			soc.on('close', () => {
				onClose(soc, id);
			});

			onConnect(soc);
		});
	}

	broadcast(data) {
		this.wss.clients.forEach((client) => {
			if (client.readyState === ws.OPEN) {
				client.send(data);
			}
		});
	}

	sendToMany(socs, message) {
		if (Array.isArray(socs)) {
			for (let soc of socs) soc.send(message);
		} else {
			socs.send(message);
		}
	}

	static socToUserId(soc) {
		return soc._socket.remoteAddress;
	}
}

module.exports = WSH;