clippy.load({ name: 'Clippy', path: 'js/agents/' }, function(agent) {
	agent.show();
});

function setKonamiCode() {
	let easterEgg = new Konami();
	easterEgg.code = partyMode;
	easterEgg.load();
}