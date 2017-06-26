// Copyright IBM Corp. 2015,2017. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

module.exports = {
  default: function(app, options) {
    app.dummyComponentUmdOptions = options;
  },
};
Object.defineProperty(module.exports, '__esModule', { value: true });
