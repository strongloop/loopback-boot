// Copyright IBM Corp. 2015,2017. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

module.exports = function requireNodeOrEsModule(sourceFile) {
  var exports = require(sourceFile);
  return exports && exports.__esModule ? exports.default : exports;
};
