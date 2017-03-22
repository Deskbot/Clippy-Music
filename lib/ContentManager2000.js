class
	.dlqueue
	.plqueue

	init
		coroutine
			while true
				get from .plqueue
				play item
				show pic
				log the play
				yield start time out
				kill current
	
		coroutine
			while true
				.dlqueue pop
				do saves
				if yt, send user the name of their song (unless you can do it from the front end)
				save music under name, n
				maybe save pic under name, n, if needed, in diff dir to where music goes

	add content
		work out music type
		
		if validate input by at least 1 music
			if validate by uniqueness
				contentId = send to content manager
				get time
				add to queue
				add to uniqueness tracker
			else
				return why fail
		else
			return why fail

	start vid(path)

	stop vid()

	start pic

	stop pic

	kill current
		kill item
		kill pic
		log end of play, includes id (ip/username) and timestamp with timezone

	is unique
		see if youtube video code or file hash is in the uniqueness tracker