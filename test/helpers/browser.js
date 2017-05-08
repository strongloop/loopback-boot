// Copyright IBM Corp. 2015,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var vm = require('vm');

function createContext() {
  var context = {
    // required by browserify
    XMLHttpRequest: function() { throw new Error('not implemented'); },
    FormData: function() { throw new Error('not implemented'); },

    localStorage: {
      // used by `debug` module
      debug: process.env.DEBUG,
    },

    // used by DataSource.prototype.ready
    setTimeout: setTimeout,

    // used by `debug` module
    document: {documentElement: {style: {}}},

    // used by `debug` module
    navigator: {userAgent: 'sandbox'},

    // used by crypto-browserify & friends
    Int32Array: Int32Array,
    DataView: DataView,
    crypto: {
      getRandomValues: function(typedArray) {
        var randomBuffer = require('crypto').randomBytes(typedArray.length);
        // This implementation is not secure: we take random 8bit values
        // and assign them to 8/16/32bit values, leaving high-order bits
        // filled with zeroes.
        // Fortunately, the bootstrapping process does not rely on secure
        // random numbers, therefore we can afford such shortcut.
        typedArray.set(randomBuffer);
      },
    },

    // allow the browserified code to log messages
    // call `printContextLogs(context)` to print the accumulated messages
    console: {
      log: function() {
        this._logs.log.push(Array.prototype.slice.call(arguments));
      },
      warn: function() {
        this._logs.warn.push(Array.prototype.slice.call(arguments));
      },
      error: function() {
        this._logs.error.push(Array.prototype.slice.call(arguments));
      },
      _logs: {
        log: [],
        warn: [],
        error: [],
      },
    },

    ArrayBuffer: ArrayBuffer,
  };

  // `window` is used by loopback to detect browser runtime
  context.window = context;

  return vm.createContext(context);
}
exports.createContext = createContext;

function printContextLogs(context) {
  var k, ix; // see https://github.com/eslint/eslint/issues/5744
  for (k in context.console._logs) {
    var items = context.console._logs[k];
    for (ix in items) {
      console[k].apply(console, items[ix]);
    }
  }
}
exports.printContextLogs = printContextLogs;
