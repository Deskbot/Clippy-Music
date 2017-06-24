Clippy-Music
============

Main Features
--------------
* max time in queue
* has picture upload
* attempts to prevent the same thing being uploaded twice in a given time range
* users can choose and change their nickname
* time range of music file to be played
* allows continuation of server from where it was stopped, if the process is killed

Other Features
--------------

* The browser doesn't require JavaScript for file upload

Installation
------------

Dependencies:
* mpv `apt-get install mpv`
* youtube-dl `pip install youtube-dl`

```
git clone https://github.com/Deskbot/Clippy-Music
npm install
```

Run
---

You may have to run `sudo service apache2 stop` because the program serves the webpage on port 80, which is otherwise in use by Apache.

`sudo node main.js`

###Options

* `--clean`: deletes all stored data that would otherwise be reloaded between runs
* `--no-admin`: removes need for admin password, however users can't be banned

Admin Features
--------------

* Banning by ip
* logging everything played by name of track and ip
