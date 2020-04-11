TODO
====

This list is in a rough order of priority.

List
----

* duplicate ytdls should be named by clippy instead of clippy stating the url
* Choosing a file with a long name should make it show ellipsis (a literal ... not the unicode …)
* Uploading a video as music should say my videos
* replace request (https://github.com/request/request/issues/3142)
* Use a separate setting for bucket size and max run time.
* Change the options at run time from the admin panel
* Make Clippy installable as a Progressive Web App
	* desktop icon is clippy with headphones on
* long text comes out of clippy's bubble. If the width is known, artifical \n could be added or zero width spaces.
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
* during overlay download if no content length is given and the we read more bytes than the allowed amount, no more data should be downloaded and the process should reject
* dragging and dropping a file/url into anywhere in the upload window should stage the upload
* no suspended id factory implies content manager recovery should be ignored
* no suspended user record found implies content manager should be ignored
* subtitles

---

* clean up part files when cancelling a ytdl
* clean up overlays for cancelled uploads
* clean up music files from httpUploads when there is an error during upload
* can cancel raw url downloads
* can cancel file uploads
* can cancel at any point in an upload i.e. before adding to content manager
* treat ytdl downloads that don't have 2 components as 100%
	* need to figure out before the second phase appears whether that will happen
* allow admins to kill clippy at the end of the next song
* put user nickname in ItemData to remove need to refetch it
* is canDownloadOverlayFromRawUrl needed? those checks can be done in the actual download
* Admins can ban specific songs (even if uniqueness cooloff is disabled) hash checking needs to be applied
* Admins can see a list of all users and can ban directly
* add checkbox to enable instant upload on form input change (for quick pasting and file selecting)
* convert tests to TS
	* need to ensure old tests don't remain in the build folder
* add tests for / and /admin loading
* use pick, exclude etc to corretly type some of the utils
* FileUploadError probably only needs to take file paths and not files
* Only attach user ids to items belonging to the user the queue is sent to
* Account for possibility of CDN being down
	* `<script>window.jQuery || document.write('<script src="js/vendor/jquery-1.11.2.min.js"><\/script>')</script>`
* clippy tests have own assertTrue or assertFalse methods
* Split up `static/handlers.js`
* use a lightweight front end framework
* turn front end into typescript
	* modularise front end JS
* Replace array.forEach with something better
* use a custom defer class instead of using q
	* last time I tried using my own implementation, I encounterred an error. I'm not certain it was caused by this though.
* Modernise front end code
	* I wanted to use old JS on the front end for old browsers
	* But I'm using templates which I now know aren't available on old browsers
	* Could use babel or typescript to compile to compatible JS
* keep all windows scroll-to-able when resizing the browser window
* Make it so Clippy can't be dropped in a place that covers the scroll bar partially
* Use consistent "id", "cid", "contentId" / "uid", "userId" properties
* Split ContentManager into more modules
	* One for playing and one for queuing
* Split up `main.css`
* Remove duplicate code in `static/handlers.js`
* Tests should execute in a random order
* Add JSDoc to all functions
* Truncate file names before sending the files to the server
* Use exponential form for numbers in default_options
* Add integration tests
	* Worth doing before refactors

---

* Default nickname is "Anonymous" or configurable
* Windows 2000 cursors (http://telcontar.net/Misc/screeniecursors/)
* Play the Windows 2000 start up sound when visiting the page
* Alternative stylesheet
* Find a unicode remover only for problematic characters
* Admins can toggle a user's ban state from a list of all users
* Use a consistent unit for differet time lengths in options
* Move queueUpdateMaxFreq from consts to options
* Simulate upload time delay for during manual testing
* Language pack framework for localisation
* Tell the user how long until something is no longer blocked due to the uniqueness constraint
* Add a unicode play/pause icon to the play/pause button on the admin panel
* Put Clippy in his own window
	* harder than it looks
* Grey bar at the top of unfocused windows
* It's not obvious that you can't run tests without a "config.ts".
* Move timer from ContentManager into a stopwatch class
* Check it uses the minimum required JQuery UI
* Reconnect websockets when attempting to perform a websocket action
* use valid http response codes, things such as payload too large
* Factor initial youtube-dl info request factor into total upload percentage
* Accidental missile test Easter egg
* Safe Increment i.e. ids start at min safe integer and loop back round if they reach max safe integer
* Command line overrides for options
* Can stream content to the browser for users to watch
* Use CSS Preprocessor
