ws

//out

on connect
	send queue
	add identity to 
	if banned
		sendBanned

//in

/api/set-nickname
	=> nickname

	replace nickname in map from main

/api/get-queue
	send queue

/api/remove-item
	=> id

	remove id from queue

//funcs
export
	sendBanned con
		send type : banned

	sendErr con
		send type: err