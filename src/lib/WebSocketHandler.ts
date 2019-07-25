//all purpose handler for incoming web sockets connections and messages

const ws = require('ws');

const opt = require('../../options.js');

class WSH {
	constructor(onConnect, onMessage, onClose, socToId) {
		this.wss = new ws.Server({ port: opt.webSocketPort });

		this.wss.on('connection', (soc) => { //when a client connects
			const id = socToId(soc);

			//add handler to do something when the client sends a message
			soc.on('message', (data, flags) => {
				if (!flag.binary) {
					onMessage(soc, id, data, flags);
				} else {
					console.error('mysterious binary flag occured');
					console.error(data,flags);
				}
			});

			soc.on('close', () => {
				onClose(soc, id);
			});

			onConnect(soc, id);
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
}

module.exports = WSH;