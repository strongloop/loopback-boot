// Copyright IBM Corp. 2015. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

module.exports = function(Robot) {
  Robot.settings._customized = 'Robot';
  Robot.base.settings._customized = 'Robot';
};
