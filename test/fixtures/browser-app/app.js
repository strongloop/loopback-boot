// Copyright IBM Corp. 2014,2019. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var loopback = require('loopback');
var boot = require('../../../');

var app = module.exports = loopback();
boot(app, __dirname);
