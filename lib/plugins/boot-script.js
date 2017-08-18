// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var util = require('util');
var utils = require('../utils');
var path = require('path');
var async = require('async');
var debug = require('debug')('loopback:boot:script');
var PluginBase = require('../plugin-base');
var _ = require('lodash');
var g = require('../globalize');

module.exports = function(options) {
  return new Script(options);
};

function Script(options) {
  PluginBase.call(this, options, 'bootScripts', null);
}

util.inherits(Script, PluginBase);

Script.prototype.load = function(context) {
  var options = this.options;
  var appRootDir = options.rootDir;
  // require directories
  var bootDirs = options.bootDirs || []; // precedence
  bootDirs = bootDirs.concat(path.join(appRootDir, 'boot'));
  utils.resolveRelativePaths(bootDirs, appRootDir);

  var bootScripts = options.bootScripts || [];
  utils.resolveRelativePaths(bootScripts, appRootDir);

  bootDirs.forEach(function(dir) {
    bootScripts = bootScripts.concat(
      utils.findScripts(dir, options.scriptExtensions)
    );
    var envdir = dir + '/' + options.env;
    bootScripts = bootScripts.concat(
      utils.findScripts(envdir, options.scriptExtensions)
    );
  });

  // de-dedup boot scripts -ERS
  // https://github.com/strongloop/loopback-boot/issues/64
  bootScripts = _.uniq(bootScripts);
  debug('Boot scripts: %j', bootScripts);
  this.configure(context, bootScripts);
  return bootScripts;
};

Script.prototype.start = function(context, done) {
  var app = context.app;
  var instructions = context.instructions[this.name];
  runScripts(app, instructions, done);
};

function runScripts(app, list, callback) {
  list = list || [];
  var functions = [];
  list.forEach(function(filepath) {
    debug('Requiring script %s', filepath);
    try {
      var exports = require(filepath);
      if (typeof exports === 'function') {
        debug('Exported function detected %s', filepath);
        functions.push({
          path: filepath,
          func: exports,
        });
      }
    } catch (err) {
      g.error('Failed loading boot script: %s\n%s', filepath, err.stack);
      throw err;
    }
  });

  async.eachSeries(functions, function(f, done) {
    debug('Running script %s', f.path);
    var cb = function(err) {
      debug('Async function %s %s', err ? 'failed' : 'finished', f.path);
      done(err);
      // Make sure done() isn't called twice, e.g. if a script returns a
      // thenable object and also calls the passed callback.
      cb = function() {};
    };
    try {
      var result = f.func(app, cb);
      if (result && typeof result.then === 'function') {
        result.then(function() { cb(); }, cb);
      } else if (f.func.length < 2) {
        debug('Sync function finished %s', f.path);
        done();
      }
    } catch (err) {
      debug('Sync function failed %s', f.path, err);
      done(err);
    }
  }, callback);
}
