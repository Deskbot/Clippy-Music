const cp = require('child_process');
const prompt = require('./lib/PromptTR.js');
prompt.colors = false;
prompt.message = '';
prompt.delimiter = '';

prompt.start();

prompt.get([
	{
		name: 'addOrRemove',
		message: 'Add a ban / remove a ban (a/r) (default add): '
	},
	{
		name: 'adminPassword',
		message: 'Admin Password (hidden): ',
		hidden: true,
		required: true,
	},
	{
		name: 'userId',
		message: 'User ID of target user: ',
		required: true,
	}
], (err, result) => {
	if (err) throw err;
		   
	const dataArg = curlDataBuilder('password', result.adminPassword, 'id', result.userId);

	let url;
	
	if (result.addOrRemove.length > 0 && result.addOrRemove[0].toLowerCase() == 'r') {
		url = 'localhost/api/ban/remove';
	} else {
		url = 'localhost/api/ban/add';
	}
	
	console.log('Executing curl');
	
	let proc = cp.spawn('curl', ['--data', dataArg, url])
	proc.stdout.pipe(process.stdout);
	proc.stderr.pipe(process.stderr);
});

function curlDataBuilder(...arr) {
	let strs = [];
	
	for (let i = 0; i < arr.length; i += 2) {
		strs.push( arr[i] + '=' + arr[i+1] );
	}
	
	return strs.join('&');
}