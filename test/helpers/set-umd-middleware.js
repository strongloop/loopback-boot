// Copyright IBM Corp. 2017. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

module.exports = {
  default: function(value) {
    return function(req, res, next) {
      res.setHeader('umd', value);
      next();
    };
  },
};
Object.defineProperty(module.exports, '__esModule', { value: true });
