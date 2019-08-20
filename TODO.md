TODO
====

This list is in a rough order of priority.

List
----

* extracting picname from downloaded pic could be better
* Barringer's Bucketing system
    * add bucketing type to options
    * integrate the new bucketing object in every location with an if to decide which queue
    * send bucket type to front end
    * render new kind of bucketing on the front
    * refactor to not use ifs everywhere
    * when using ClippyQueue see if we can avoid getting the duration before playing with or just don't count the seconds actually played
* add strictness
    * "noImplicitAny": true,
* add eog command to options and its arguments
    * rename existing path options with "???command"
* Reddit support
    * youtube-dl does it
    * mpv can stream it but it takes ages
* Vimeo support
    * youtube-dl does it
    * mpv can stream it
* Basically every other youtube-dl source including bandcamp and archive.org
* Improve the way clippy reconnects the websocket, maybe do it as soon as the tab regains focus and update the queue data at the same time.
* Is the behaviour of forgetting an item when it is removed from the queue correct?
* Change the "Progress" label to "Upload Progress"
* Silent looping Video overlay
    * Then rename image/pic variables to overlay everywhere
    * These need making consistent anyway
* Gifv support
* update the state of the choose music file button when pasting into youtube url box
* playlist upload
* multiple file uploads at once
* Allow admins to remove anything before it gets played
* Allow downloading of content
    * Must give a legal warning at the user's first attempt, which prompts the user to confirm their intent
    * Only allow downloading of the currently playing content. I hate seeing people waste their time looking ahead. It ruins the fun.
    * allow downloading of things that have just played
    * image download
* Allow killing the thing you yourself are playing
* Put development diagrams in repo
* Sometimes unmoved windows move by a small amount when a window above is closed
* Dragging a window when another window resizes, causes the one you're dragging to shift.
    * maybe consider changing the way the layout is done. how often do people resize the browser window anyway? I don't think i need to be account for all that

---

* Cancelling an upload shouldn't put an error in the console
* Improve FileUploadError to be spoken as Clippy
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
* Use more modern JS features on the back end
    * things have changed a lot in nodejs since the birth of this project
* Separate the 3 upload types into separate functions use "type system"
    * There's a lot of checking `isUrl` and `stream` which wildly change the behaviour of a function
* Modernise front end code
    * I wanted to use old JS on the front end for old browsers
    * But I'm using templates which I now know aren't available on old browsers
    * Could use babel or typescript to compile to compatible JS
* Prevent Firefox getting urls that are POST only
    * use 405 Method Not Allowed responses
* Split up HttpService into sub files based on common middleware
* Use consistent "id", "cid", "contentId" / "uid", "userId" properties
* "use strict"
* Split ContentManager into more modules
    * One for playing and one for queuing
* Split up `main.css`
* Remove duplicate code in `static/handlers.js`
* Make play queue DOM update more efficiently
* Only try to delete empty files once
* sort out the fact that the user sees "The admin controls can not be used because no admin password was set." for any unfound endpoint
* Use a map of content id to item instead of a user queue
* Allow videos to be uploaded by URL that references a file
* Tests should execute in a random order
* Add JSDoc to all functions
* Remove null from codebase
* Truncate file names before sending the files to the server
* Use exponential form for numbers in default_options
* both cancel and dismiss show when there is a downlod error from youtube
* Add unit tests
    * Worth doing before refactors
* Add integration tests
    * Worth doing before refactors
* Check what method is used for each HTTP endpoint, is there a better one?
* Replace websockets with long poll http

---

* Default nickname is "Anonymous" or configurable
* Windows 2000 cursors (http://telcontar.net/Misc/screeniecursors/)
* Play the Windows 2000 start up sound when visiting the page
* Drag windows by their outline, which is more authentic
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
* Change the options at run time from the admin panel
* Reconnect websockets when attempting to perform a websocket action
* use valid http response codes, things such as payload too large
* Factor initial youtube-dl info request factor into total upload percentage
* Factor image url download into total upload percentage
    * can factor in the vid duration to the ratio between the two
* Accidental missile test Easter egg
* Safe Increment i.e. ids start at min safe integer and loop back round if they reach max safe integer
* Command line overrides for options
* Can stream content to the browser for users to watch
* Convert to TypeScript
* Works without JavaScript
* Use CSS Preprocessor