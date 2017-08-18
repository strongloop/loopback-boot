// Copyright IBM Corp. 2017. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var Promise = require('bluebird');

process.bootFlags.push('promiseLoaded');
module.exports = function(app) {
  process.bootFlags.push('promiseStarted');
  return Promise.resolve({
    then: function(onFulfill, onReject) {
      process.nextTick(function() {
        process.bootFlags.push('promiseFinished');
        onFulfill();
      });
    },
  });
};
