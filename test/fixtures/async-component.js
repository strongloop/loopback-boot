// Copyright IBM Corp. 2017. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

module.exports = function(app, config, done) {
  process.componentFlags.push('asyncStarted');
  process.nextTick(function() {
    process.componentFlags.push('asyncFinished');
    done();
  });
};
