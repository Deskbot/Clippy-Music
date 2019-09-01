What					   | Error causes
---------------------------|----------------------------------------------------
Ban user by IP			 | User doesn't exist
Un-ban user by IP		  | User doesn't exist
Ban user by nickname	   | User doesn't exist
Un-ban user by nickname	| User doesn't exist
Change nickname			| Empty string given; string looks like an IP address
Image url				  | File wrong type; File too big; User is banned; not unique
Upload image file		  | File wrong type; File too big; User is banned; not unique
Upload music file		  | File wrong type; File too big; User is banned; not unique
YouTube upload			 | Video doesn't exist; not unique
Cancel YouTube upload	  |
Remove item from the queue |

All tests need to be done by the web interface and by `curl`.