var loopback = require('loopback');
var boot = require('../../../');

var app = module.exports = loopback();

boot(app, {
  appId: 'browserApp2',
  appRootDir: __dirname
});
