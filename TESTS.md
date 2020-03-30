## General Functions

What                                   | Error causes
---------------------------------------|----------------------------------------------------
Ban user by IP                         | User doesn't exist; No admin password set
Un-ban user by IP                      | User doesn't exist; No admin password set
Ban user by nickname                   | User doesn't exist; No admin password set
Un-ban user by nickname                | User doesn't exist; No admin password set
Skip my current music                  | Not actually me whose music is playing
Skip current music as admin            | User doesn't exist; No admin password set
Skip current music and ban as admin    | User doesn't exist; No admin password set
Change nickname                        | Empty string given; string looks like an IP address
Overlay direct url upload              | File wrong type; File too big; User is banned; not unique
Overlay youtube-dl upload              | File wrong type; File too big; User is banned; not unique
Upload overlay file                    | File wrong type; File too big; User is banned; not unique
Upload music file                      | File wrong type; File too big; User is banned; not unique
Music url upload                       | Video doesn't exist; not unique
Download current music                 |
Download current picture               |
Download queued music                  |
Download queued picture                |
Cancel in progresss music url download |
Cancel not started music url download  |
Remove item from the queue             |
Can link to music by URL               |
Can not link to file music             |
Restore users on restart               |
Restore queue on restart               |
Restore password on restart            |
Whatever the noscript application says |

All tests need to be done by the web interface and by `curl`.

## File Upload Method Combinations

Musc | Overlay
-----|---------
file | none
file | file
file | url
file | ytdl
ytdl | none
ytdl | file
ytdl | url
ytdl | ytdl
