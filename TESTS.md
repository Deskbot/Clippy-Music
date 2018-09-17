What                    | Error causes
------------------------|----------------------------------------------------
Ban user by IP          | User doesn't exist
Un-ban user by IP       | User doesn't exist
Ban user by nickname    | User doesn't exist
Un-ban user by nickname | User doesn't exist
Change nickname         | Empty string given
Image url               | File wrong type; File too big; User is banned
Upload image file       | File wrong type; File too big; User is banned
Upload music file       | File wrong type; File too big; User is banned
Youtube upload          | Video doesn't exist

All tests need to be done by the web interface and by `curl`.