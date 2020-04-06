Clippy-Music
============

A music server written in NodeJS. Applicable for LAN parties.

Features
--------

* A queuing system that makes the amount of time each user can play for more evenly distributed.
* Pictures can be displayed over music or video.
* Uniqueness of music and pictures is enforced until after a chosen length of time has passed since it was last played/shown.
* A fragment of a music or video file can be specified to get played
* A nickname can be chosen by each user, which can be changed at any time.
* The server will continue playing the queue from where it was stopped the last time it was closed down.

Installation
------------

### Dependencies:

All available from the links given. It's also likely you can get them from your package manager.

* [curl](https://curl.haxx.se/)
* [eog](https://github.com/GNOME/eog)
* [ffprobe](https://ffmpeg.org/download.html)
* [mpv](https://mpv.io/)
* mv
* [youtube-dl](https://rg3.github.io/youtube-dl/) Especially important that you have the latest version.

```
git clone https://github.com/Deskbot/Clippy-Music
cd Clippy-Music
npm install
npm run build
```

Configuration
-------------

Certain choices about program behaviour can be found in `./config.ts`. If `./config.ts` does not exist, execute `npm run build` and it will create that file from a copy of the default.

After altering `./config.ts`, run `npm run build` to validate your configuration and make it usable the next time the server is started.

The configuration can not be changed at run time.

Program updates may overwrite `default_config.ts` but not `config.ts`.

Run
---

```
npm start -- [...args]
#or
node main.js [...args]
```

To use a port below 1024 you will need to run as root.

If you have a web server installed such as Apache2 and intend to expose the web page on port 80, you may have to run `sudo service apache2 stop` or expose Clippy Music on a different port and [configure your server](https://wiwifos.blogspot.com/2017/09/apache2-port-rerouting.html) to reroute port 80 to Clippy Music's port.

### Arguments

* `-c --clean`: deletes all stored data that would otherwise be reloaded between runs
* `-m --mute`: all media is played muted
* `--no-admin`: removes need for admin password, however users can't be banned
* `-d --debug`: increases the amount of information logged in the terminal

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

Terminal Controls
-----------------

* End the current song: hit the **'end'** key in the terminal
* Close the server: hit **ctrl+c**
* Closing the music player will cause the next track to be played. The music player is `mpv`, which when windowed, is closed by pressing **q** or **alt+f4**.
* If the overlay window is closed, the music will continue. By default `eog` is the image displayer; it can be closed with **'esc'** or **alt-f4**.

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

Method | Path                  | Variables                                                              | Effect
-------|-----------------------|------------------------------------------------------------------------|--------
GET    | /api/wsport           |                                                                        | Gives the web socket port being used for front end communication
POST   | /api/queue/add        | music-file, music-url, overlay-file, overlay-url, start-time, end-time | Add an item to the queue
POST   | /api/queue/remove     | content-id                                                             | Removes an item from the queue
POST   | /api/upload/cancel    | dl-index                                                               | Cancel a download
POST   | /api/nickname/set     | nickname                                                               | Set your nickname
POST   | /api/ban/add          | password, id, nickname                                                 | Ban a specific player by name or id
POST   | /api/ban/remove       | password, id                                                           | Un-Ban a specific player by id
POST   | /api/skip             | password                                                               | Skip the current track
POST   | /api/skipAndBan       | password                                                               | Skip the current track and ban the uploader
GET    | /api/download/music   | id                                                                     | Downloads the music as part of the upload with the given id.
GET    | /api/download/overlay | id                                                                     | Downloads the overlay as part of the upload with the given id.

Contributions
-------------

Contributions are welcome :)

Check out the [todo list](./TODO.md) to see what changes would be good to make.

Language
----------

Initially Clippy-Music was written in JavaScript. I switched to TypeScript long after I thought the project to be finished because I got a new feature request that required very siginificant alterations to the code and I thought type safety would make these changes easier to make. There's a lot of room to improve the TypeScript and use the language to its fullest, but it's not worth the time it would take to update the entire codebase.

The front end code was written to be very compatible with older browsers, however I went over-board with this because Clippy uses websockets which are not compatible with many older browsers anyway. At some point the front end may be converted to TypeScript, or possibly svelte, or both.

License
-------

You must not try or succeed in using any of this software to make any person or entity any money
