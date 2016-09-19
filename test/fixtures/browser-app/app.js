// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var loopback = require('loopback');
var boot = require('../../../');

var app = module.exports = loopback();
app.start = function(done) {
  boot(app, __dirname, done);
};
