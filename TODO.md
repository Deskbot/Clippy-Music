TODO
====

This list is in a rough order of priority.

List
----

* Silent looping Video overlay
	* youtube-dl video url (this covers video files)
	* indicate to the user they can choose a video and that it will be silent and looping
	* rename image unique cooloff to be about overlay
	* ensure that the download bar correctly accounts for all situations
	* C:/My Pictures should be "My Videos" if a video is chosen
	* show a different download button for videos and images
	* Updates TESTS file
	* Update command line api in README
* Add something to README about the configurableness of eog and mpv
* Use a separate setting for bucket size and max run time.
* Change the options at run time from the admin panel
* Make Clippy installable as a Progressive Web App
	* desktop icon is clippy with headphones on
* within a single bucket, user content should be round robin
* Can reorder my uploads
* Clippy should state when the user is not connected to the internet at all
* update the state of the choose music file button when dragging into url box
* playlist upload
* multiple file uploads at once
* empty queue of duplicate files after each thing is remembered
* Allow admins to remove anything before it gets played
* Sometimes unmoved windows move by a small amount when a window above is closed
* Dragging a window when another window resizes, causes the one you're dragging to shift.
	* maybe consider changing the way the layout is done. how often do people resize the browser window anyway? I don't think i need to be account for all that
* Improve the way clippy reconnects the websocket, maybe do it as soon as the tab regains focus and update the queue data at the same time.
* allow downloading of things that have previously played
* dragging and dropping a file/url into anywhere in the upload window should stage the upload
* Put development diagrams in repo
* no suspended id factory implies content manager recovery should be ignored
* no suspended user record found implies content manager should be ignored

---

* allow admins to kill clippy at the end of the next song
* put user nickname in ItemData to remove need to refetch it
* Admins can ban specific songs (even if uniqueness cooloff is disabled) hash checking needs to be applied
* Admins can see a list of all users and can ban directly
* add checkbox to enable instant upload on form input change (for quick pasting and file selecting)
* convert tests to TS
	* need to ensure old tests don't remain in the build folder
* add tests for / and /admin loading
* use pick, exclude etc to corretly type some of the utils
* FileUploadError probably only needs to take file paths and not files
* Make internal errors that aren't user errors get put in the terminal
* Only attach user ids to items belonging to the user the queue is sent to
* Check picture for duplicate again before playing it
* Account for possibility of CDN being down
	* `<script>window.jQuery || document.write('<script src="js/vendor/jquery-1.11.2.min.js"><\/script>')</script>`
* Add all npm scripts like unit-test and ban
* clippy tests have own assertTrue or assertFalse methods
* Replace utils.valList with Object.values
* Remove debug file and commands
* Split up `static/handlers.js`
* Replace array.forEach with something better
* use a custom defer class instead of using q
	* last time I tried using my own implementation, I encounterred an error. I'm not certain it was caused by this though.
* Separate the 3 upload types into separate functions use "type system"
	* There's a lot of checking `isUrl` and `stream` which wildly change the behaviour of a function
* Modernise front end code
	* I wanted to use old JS on the front end for old browsers
	* But I'm using templates which I now know aren't available on old browsers
	* Could use babel or typescript to compile to compatible JS
* Prevent Firefox getting urls that are POST only
	* use 405 Method Not Allowed responses
* Split up HttpService into sub files based on common middleware
* Svelte front end
	* compile time / server side rendering
	* compare bundle size before and after
	* update TODO to remove obsolete ideas after doing this
* keep all windows scroll-to-able when resizing the browser window
* Make it so Clippy can't be dropped in a place that covers the scroll bar partially
* Use consistent "id", "cid", "contentId" / "uid", "userId" properties
* "use strict"
* Split ContentManager into more modules
	* One for playing and one for queuing
* Split up `main.css`
* Remove duplicate code in `static/handlers.js`
* Have a second type of error for things clippy should(n't) say
* Make play queue DOM update more efficiently
* clippy speaking a long url won't fit inside his bubble
* Only try to delete empty files once
* Use a map of content id to item instead of a user queue
* Allow videos to be uploaded by URL that references a file
* Tests should execute in a random order
* Add JSDoc to all functions
* Remove null from codebase
* Truncate file names before sending the files to the server
* Use exponential form for numbers in default_options
* Add integration tests
	* Worth doing before refactors
* Check what method is used for each HTTP endpoint, is there a better one?
* Replace websockets with long poll http

---

* Default nickname is "Anonymous" or configurable
* Windows 2000 cursors (http://telcontar.net/Misc/screeniecursors/)
* Play the Windows 2000 start up sound when visiting the page
* Alternative stylesheet
* Find a unicode remover only for problematic characters
* Admins can toggle a user's ban state from a list of all users
* Continue downloading after the server is suspended
* Use a consistent unit for differet time lengths in options
* Move queueUpdateMaxFreq from consts to options
* Simulate upload time delay for during manual testing
* Include upload type in error (file, yt, stream)
* In WebSocketService take a userId instead of a soc in methods
* Make start and end time boxes adjacent
* Replace utils.spread with modern JS
* Language pack framework for localisation
* Build all error messages on the front end
* Tell the user how long until something is no longer blocked due to the uniqueness constraint
* Use a consistent method for checking for an empty string
* Add a unicode play/pause icon to the play/pause button on the admin panel
* Make quotes consistent around numbers
* Make it so progress items can be passed around the system rather than re-searched for frequently
* Put Clippy in his own window
	* harder than it looks
* Grey bar at the top of unfocused windows
* Nickname uniqueness
* It's not obvious that you can't run tests without an "config.ts".
* Move timer from ContentManager into a stopwatch class
* Check it uses the minimum required JQuery UI
* Reconnect websockets when attempting to perform a websocket action
* use valid http response codes, things such as payload too large
* Factor initial youtube-dl info request factor into total upload percentage
* Factor image url download into total upload percentage
	* can factor in the vid duration to the ratio between the two
* Accidental missile test Easter egg
* Safe Increment i.e. ids start at min safe integer and loop back round if they reach max safe integer
* Command line overrides for options
* Can stream content to the browser for users to watch
* Must give a legal warning at the user's first attempt to download, which prompts the user to confirm their intent
* Works without JavaScript
* Use CSS Preprocessor