// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var execute = require('./lib/executor');

/**
 * The browser version of `bootLoopBackApp`.
 *
 * When loopback-boot is loaded in browser, the module exports this
 * function instead of `bootLoopBackApp`.
 *
 * The function expects the boot instructions to be included in
 * the browser bundle, see `boot.compileToBrowserify`.
 *
 * @param {Object} app The loopback app to boot, as returned by `loopback()`.
 * @param {Object|string} [options] options as described in
 * `boot.compileToBrowserify`.
 *
 * @header boot(app)
 */

exports = module.exports = function bootBrowserApp(app, options) {
  // Only using options.id to identify the browserified bundle to load for
  // this application. If no Id was provided, load the default bundle.
  var moduleName = 'loopback-boot#instructions';
  if (options && typeof options === 'object' && options.appId)
    moduleName += '-' + options.appId;

  // The name of the module containing instructions
  // is hard-coded in lib/bundler
  var instructions = require(moduleName);
  execute(app, instructions);
};

exports.execute = execute;
