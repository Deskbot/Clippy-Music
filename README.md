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

All available from the links given. In the case of `eog` and `mpv`, it's likely you can get them from your package manager.

* [eog](https://github.com/GNOME/eog)
* [mpv](https://mpv.io/)
* [youtube-dl](https://rg3.github.io/youtube-dl/) (best downloaded via: `pip install youtube-dl`)

```
git clone https://github.com/Deskbot/Clippy-Music
cd Clippy-Music
npm install
```

Run
---

```
sudo node main.js
```

You may have to run `sudo service apache2 stop` because the program serves the webpage on port 80, which is otherwise in use by Apache.

### Options

* `-c --clean`: deletes all stored data that would otherwise be reloaded between runs
* `--no-admin`: removes need for admin password, however users can't be banned

Controls
--------

* End the current song: hit the **'end'** key in the terminal
* Close the server: hit **ctrl+c**

User API
--------

### POST /api/content/upload

Use:
```
curl --form "var1=val1;file1=@/my/file/path" /api/path
```

Variables
* music-file (file)
* music-url
* image-file (file)
* image-url

For all of the following use:

```
curl --data "var1=val1&var2=val2" /api/path
```

### POST /api/content/remove

Variables
* content-id

### POST /api/nickname/set

Variables
* nickname

Admin API
---------

A tool exists for banning and unbanning. Run `node banTool.js`. Otherwise:

### Ban By IP

```
curl --data 'id=[UserToBan]&password=[AdminPassword]' localhost/api/ban/add
```

### Un-Ban By IP
```
curl --data 'id=[UserToBan]&password=[AdminPassword]' localhost/api/ban/remove
```

Contibutions
------------

Please contribute, preferably with code, issues on GitHub is fine.

License
-------

* You must use this music server
* You may not use this software to make money
