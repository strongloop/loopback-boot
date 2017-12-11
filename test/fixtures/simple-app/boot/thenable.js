// Copyright IBM Corp. 2017. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

process.bootFlags.push('thenableLoaded');
module.exports = function(app) {
  process.bootFlags.push('thenableStarted');
  return {
    then: function(onFulfill, onReject) {
      process.nextTick(function() {
        process.bootFlags.push('thenableFinished');
        onFulfill();
      });
    },
  };
};
