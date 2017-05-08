// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var Bootstrapper = require('./lib/bootstrapper');

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

exports = module.exports = function bootBrowserApp(app, options, callback) {
  // Only using options.id to identify the browserified bundle to load for
  // this application. If no Id was provided, load the default bundle.
  var moduleName = 'loopback-boot#instructions';
  var appId = options && typeof options === 'object' && options.appId;
  if (appId)
    moduleName += '-' + appId;

  // The name of the module containing instructions
  // is hard-coded in lib/bundler
  var instructions = require(moduleName);

  var bootstrapper = new Bootstrapper(options);
  bootstrapper.phases = ['starting', 'start', 'started'];
  var context = {
    app: app,
    instructions: instructions,
  };
  return bootstrapper.run(context, callback);
};

