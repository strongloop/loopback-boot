// Copyright IBM Corp. 2015,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var loopback = require('loopback');
var boot = require('../../../');

var app = module.exports = loopback();
boot(app, {
  appId: 'browserApp2',
  appRootDir: __dirname,
});
