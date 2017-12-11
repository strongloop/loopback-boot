// Copyright IBM Corp. 2017. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

module.exports = function(app) {
  if (process.throwError) {
    throw new Error('throw');
  }
};
