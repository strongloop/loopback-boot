// Copyright IBM Corp. 2015,2019. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const loopback = require('loopback');
const boot = require('../../../');

const app = module.exports = loopback();
boot(app, {
  appId: 'browserApp2',
  appRootDir: __dirname,
});
