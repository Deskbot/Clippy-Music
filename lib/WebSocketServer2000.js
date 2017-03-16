ws

//out

on connect
	send queue

//in

/api/set-nickname
	=> nickname

	send to nickname

/api/get-queue
	send queue

/api/remove-item
	=> id

	remove id from queue