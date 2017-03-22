require options

boot websocket server
boot http(s) server
boot player //???

//websocket._socket.remoteAddress
map1 = ip -> (unum,nickname)
map2 = ip -> ws

export
	map1
	map2
	new content manager
	new banlist
	
	if a queue is serialised
		new playqueue from file
	else
		new playqueue

on ctrl+D
	end current song

on ctrl+C
	store current queue