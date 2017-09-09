const ContentManagerClass = require('../lib/ContentManager.js');

const cm = new ContentManagerClass(ContentManagerClass.recover());
cm.start();
module.exports = cm;