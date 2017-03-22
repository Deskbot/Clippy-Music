express

static files

/ -> index

/api/upload
	=> music-file
	=> music-url
	=> image-file
	=> image-url

	check user not at queue limit
		shove data in content manager upload queue (add)
		ws send problem if fail
		if success, broadcast queue update
	else
		ws.sendAtQLimit(uid)

/api/ban
	=> id

	add to banlist