What                                   | Error causes
---------------------------------------|----------------------------------------------------
Ban user by IP                         | User doesn't exist; No admin password set
Un-ban user by IP                      | User doesn't exist; No admin password set
Ban user by nickname                   | User doesn't exist; No admin password set
Un-ban user by nickname                | User doesn't exist; No admin password set
Skip current music                     | User doesn't exist; No admin password set
Skip current music and ban             | User doesn't exist; No admin password set
Change nickname                        | Empty string given; string looks like an IP address
Image url upload                       | File wrong type; File too big; User is banned; not unique
Upload image file                      | File wrong type; File too big; User is banned; not unique
Upload music file                      | File wrong type; File too big; User is banned; not unique
Music url upload                       | Video doesn't exist; not unique
Cancel in progresss music url download |
Cancel not started music url download  |
Remove item from the queue             |
Can link to music by URL               |
Can not link to file music             |
Restore users on restart               |
Restore queue on restart               |
Restore password on restart            |

All tests need to be done by the web interface and by `curl`.