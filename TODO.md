TODO
====

Each sub-list is in a rough order of priority.

Music Server Features
---------------------

* Use a separate setting for bucket size and max run time.
* Allow admins to remove anything before it gets played
* Change the options at run time from the admin panel
* playlist upload
	* not sure what this means for the quality of content
	* it's definitely very convenient and I would use it
	* youtube-dl can get a list of everything in a playlist, then the queue them individually
	* the one youtube-dl at a time per user pays off here
	* overlays will probably not be displayable here
* multiple file uploads at once
* Add a unicode play/pause icon to the play/pause button on the admin panel
* allow downloading of things that have previously played
* within a single bucket, user content should be round robin
* Admins can ban specific songs (even if uniqueness cooloff is disabled) hash checking needs to be applied
* admins can specified a whitelist of domains for url downloads
	* sensible matching of hostnames with regards to matching subdomains
	* have sensible default
	* can config anything goes
* vote skip
* can disable file uploads
* let non-unique content be queued but just not played. By the time your thing is played, the time period may be up.
* allow admins to kill clippy at the end of the next song
* add checkbox to enable instant upload on form input change (for quick pasting and file selecting)
* can cancel raw url downloads
* can cancel file uploads
* can cancel at any point in an upload i.e. before adding to content manager
* Default nickname is "Anonymous" or configurable
* Can reorder my uploads (hard, might be easier to have a button to send to back of queue, which just removes everything and re-adds in the new order)
* Admins can toggle a user's ban state from a list of all users
* Can stream content to the browser for users to watch
	* streaming files with caching to multiple destinations may already exist in npm
	* can't stream from any website except youtube, which means streaming would probably have to be removed
	* node has some multi processing that would reduce delay on the main process
	* accessible by separate url
	* controls on hover for pause/play/volume/download
	* music has to start part way through when a user enters
* subtitles
* deb/snap install

User Interface
--------------

* Sometimes unmoved windows move by a small amount when a window above is closed
* Windows 2000 cursors (http://telcontar.net/Misc/screeniecursors/)
* black dotted line on the inside of buttons should be in the correct place in all browsers
	* firefox has it but it's slightly in the wrong place
* dragging and dropping a file/url into anywhere in the upload window should stage the upload
* Dragging a window when another window resizes, causes the one you're dragging to shift.
	* maybe consider changing the way the layout is done. how often do people resize the browser window anyway? I don't think i need to be account for all that
* keep all windows scroll-to-able when resizing the browser window
* update the state of the choose music file button when dragging into url box
* Put Clippy in his own window
	* harder than it looks
	* not x-able
* Grey bar at the top of unfocused windows
	* probably looks bad even though it's authentic
* put field names on the same line as the inputs https://forum.winworldpc.com/uploads/editor/td/kwk99aehv1xl.png
* Make Clippy installable as a Progressive Web App
	* desktop icon is clippy with headphones on
	* Clippy should state when the user is not connected to the internet at all
* Play the Windows 2000 start up sound when visiting the page
* Alternative stylesheet

User Experience
---------------

* Improve the way clippy reconnects the websocket, maybe do it as soon as the tab regains focus and update the queue data at the same time.
* Can't clear a file field in Firefox
* Choosing a file with a long name should make it show ellipsis (a literal ... not the unicode …)
* Make it so Clippy can't be dropped in a place that covers the scroll bar partially
* Tell the user how long until something is no longer blocked due to the uniqueness constraint
* duplicate ytdls should be named by clippy instead of clippy stating the url
* long text comes out of clippy's bubble. If the width is known, artifical \n could be added or zero width spaces.
* Command line overrides for options
* Use a consistent unit for differet time lengths in options
* Use exponential form for numbers in default_options
* Language pack framework for localisation

Technical Cleanliness
---------------------

* clean up part files when cancelling a ytdl
* clean up overlays for cancelled uploads
* clean up music files from httpUploads when there is an error during upload
* Reconnect websockets when attempting to perform a websocket action
* Only attach user ids to items belonging to the user the queue is sent to
* empty queue of duplicate files after each thing is remembered
* during overlay download if no content length is given and the we read more bytes than the allowed amount, no more data should be downloaded and the process should reject
* no suspended id factory implies content manager recovery should be ignored
* no suspended user record found implies content manager should be ignored
* treat ytdl downloads that don't have 2 components as 100%
	* need to figure out before the second phase appears whether that will happen
* Factor initial youtube-dl info request factor into total upload percentage
* Simulate upload time delay for during manual testing
* It's not obvious that you can't run tests without a "config.ts".
* clippy tests have own assertTrue or assertFalse methods
* Account for possibility of CDN being down
	* `<script>window.jQuery || document.write('<script src="js/vendor/jquery-1.11.2.min.js"><\/script>')</script>`
* Truncate file names before sending the files to the server
* Move queueUpdateMaxFreq from consts to options
* use valid http response codes, things such as payload too large
* Safe Increment i.e. ids start at min safe integer and loop back round if they reach max safe integer

Technical Debt
--------------

* Add JSDoc to all files and some functions
* FileUploadError probably only needs to take file paths and not files
* convert tests to TS
	* need to ensure old tests don't remain in the build folder
* add tests for / and /admin loading
* put user nickname in ItemData to remove need to refetch it
* Split ContentManager into more modules
	* One for playing and one for queuing
* replace deprecated library: request (https://github.com/request/request/issues/3142)
* is canDownloadOverlayFromRawUrl needed? those checks can be done in the actual download
* Modernise front end code
	* I wanted to use old JS on the front end for old browsers
	* But I'm using templates which I now know aren't available on old browsers
	* turn front end into typescript
		* modularise front end JS
	* Split up `main.css`
	* Split up `static/handlers.js`
	* Remove duplicate code in `static/handlers.js`
	* use a lightweight front end framework
	* Use CSS Preprocessor
* Check it uses the minimum required JQuery UI
* Move timer from ContentManager into a stopwatch class
* Use consistent "id", "cid", "contentId" / "uid", "userId" properties
* use a custom defer class instead of using q
	* last time I tried using my own implementation, I encounterred an error. I'm not certain it was caused by this though.
* Find a unicode remover only for problematic characters
* Replace array.forEach with something better
* Tests should execute in a random order
* Add integration tests
	* Worth doing before refactors
