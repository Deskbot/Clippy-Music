Music LAN 2000
==============

Main Features
--------------
* max time in queue
* has picture upload
* attempts to prevent the same thing being uploaded twice in a given time range
* users can choose and change their nickname

Other Features
--------------

* The browser doesn't require JavaScript for file upload
* The browser doesn't need to load resources from the world wide web

Set Up
------


Start up
--------

You may have to run `sudo service apache2 stop` because the program serves the webpage on port 80, which is otherwise in use by Apache.

```
sudo npm start 2> /dev/null
```

Admin Features
--------------

* Banning by ip
* logging everything played by name of track and ip
