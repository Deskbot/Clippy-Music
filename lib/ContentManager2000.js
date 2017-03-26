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
				
				errs=[]

				yield dl pic //using http(s) request or curl with an event for on done

				if pic dl error
					add to errs
					ignore it
					give null as pic file

				yield dl music //using child process on whatever

				if music dl error
					add to errs
					send any errs to user
					continue

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

	itemChosenByUser (queueidm, userid)
		boolean

	remove item (vidId)
		not sure how

	getQueue
		returns [
			[
				{
					name
					nickname / ip, if nickname is null
				}
			],
			.
			.
			.
		]

	musicIsRepeated 

	picIsRepeated