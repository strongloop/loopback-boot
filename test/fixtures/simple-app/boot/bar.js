// Copyright IBM Corp. 2014. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

process.bootFlags.push('barLoaded');
module.exports = function(app, callback) {
  process.bootFlags.push('barStarted');
  process.nextTick(function() {
    process.bootFlags.push('barFinished');
    callback();
  });
};
