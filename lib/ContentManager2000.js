class
	.dlqueue
	.plqueue

	init
		if playqueue is serialised
			get it

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
				
				save music under name, n in music dir
				save pic under name, n, in pic dir

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