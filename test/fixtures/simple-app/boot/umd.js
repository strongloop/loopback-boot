// Copyright IBM Corp. 2014,2017. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

module.exports = {
  default: function(app) {
    process.bootFlags.push('umdLoaded');
  },
};
Object.defineProperty(module.exports, '__esModule', { value: true });
