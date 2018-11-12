Clippy-Music
============

A music server written in NodeJS. Applicable for LAN parties.

Features
--------

* A priority queue is used to give a lower priority to users who've played more content recently.
* Pictures can be displayed over music or video.
* Uniqueness of music and pictures is enforced until after a chosen length of time has passed since it was last played/shown.
* A time range within the music file can be chosen for playing
* A nickname can be chosen by each user, which can be changed at any time.
* The process continues from where it was stopped the last time it was closed down.

Other Features
--------------

* A detailed log file of each item played, containing the IP address, file names, and the time at which the content was played.

Installation
------------

### Dependencies:

All available from the links given. It's also likely you can get them from your package manager.

* [curl](https://curl.haxx.se/)
* [eog](https://github.com/GNOME/eog)
* [mpv](https://mpv.io/)
* mv
* [youtube-dl](https://rg3.github.io/youtube-dl/) Especially important that you have the latest version.

```
git clone https://github.com/Deskbot/Clippy-Music
cd Clippy-Music
npm install
```

Configuration
-------------

Certain choices about program behaviour can be found in `options.js`. If `options.js` does not exist, run the program and it will create that file from a copy of `default_options.js`.

The configuration can not be changed at run time.

Program updates may overwrite `default_options.js` but not `options.js`.

Run
---

```
npm start -- [...args]
#or
node main.js [...args]
```

To use a port below 1024 you will need to run as root.

If you have a web server installed such as Apache2 and intend to expose the web page on port 80, you may have to run `sudo service apache2 stop` or expose Clippy Music on a different port and [configure your server](https://wiwifos.blogspot.com/2017/09/apache2-port-rerouting.html) to reroute port 80 to Clippy Music's port.

### Options

* `-c --clean`: deletes all stored data that would otherwise be reloaded between runs
* `-m --mute`: all media is played muted
* `--no-admin`: removes need for admin password, however users can't be banned

Update
------

```
./update.sh
```

This should work. Essentially it does a `git pull` and uses `pip` or `youtube-dl` to update `youtube-dl`.

Admin
-----

Admin controls are available in browser by visiting any of:

* /admin
* #admin
* ?admin

An admin API is also availabled as detailed below.

Controls
--------

* End the current song: hit the **'end'** key in the terminal
* Close the server: hit **ctrl+c**
* Closing an instance of `mpv` instantiated by the server (such as by pressing **q** in the mpv window) will cause the next track to be played.

User API
--------

To use the API from the terminal use the following command:

```
curl --data "field1=value1&field2=value2" [url]/api/path
```

Except when submitting to `/api/queue/add`, in which case use the following command whether or not you are uploading a file:

```
curl --form "field1=@/my/file/path;field2=value2" [url]/api/content/upload
```

Please note the difference in term separator: `&` vs `;`.

Method | Path                 | Variables                                                          | Effect |
-------|----------------------|--------------------------------------------------------------------|--------|
GET    | /api/wsport          |                                                                    | Gives the web socket port being used for front end communication
POST   | /api/queue/add       | music-file, music-url, image-file, image-url, start-time, end-time | Add an item to the queue
POST   | /api/queue/remove    | content-id                                                         | Removes an item from the queue
POST   | /api/download/cancel | dl-index                                                           | Cancel a download
POST   | /api/nickname/set    | nickname                                                           | Set your nickname
POST   | /api/ban/add         | password, id, nickname                                             | Ban a specific player by name or id
POST   | /api/ban/remove      | password, id                                                       | Un-Ban a specific player by id
POST   | /api/skip            | password                                                           | Skip the current track
POST   | /api/skipAndPenalise | password                                                           | Skip the current track and add a send the uploader to the back of the queue
POST   | /api/skipAndBan      | password                                                           | Skip the current track and ban the uploader

Contributions
-------------

Please contribute, preferably with code, issues on GitHub is fine.

Check out the [todo list](./TODO.md) to see what changes would be good to make.

License
-------

* You must use this music server
* You may not try or succeed in using any of this software to make any person or entity any money
