// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var util = require('util');
var utils = require('./utils');
var path = require('path');
var async = require('async');
var debug = require('debug')('loopback:boot:plugin-loader');
var PluginBase = require('./plugin-base');
var _ = require('lodash');

module.exports = function(options) {
  return new PluginScript(options);
};

function PluginScript(options) {
  PluginBase.call(this, options, 'pluginScripts', null);
}

util.inherits(PluginScript, PluginBase);

PluginScript.prototype.load = function(context) {
  var options = this.options;
  var appRootDir = options.rootDir;
  // require directories
  var pluginDirs = options.pluginDirs || []; // precedence
  pluginDirs = pluginDirs.concat(path.join(appRootDir, 'plugins'));
  utils.resolveRelativePaths(pluginDirs, appRootDir);

  var pluginScripts = options.pluginScripts || [];
  utils.resolveRelativePaths(pluginScripts, appRootDir);

  pluginDirs.forEach(function(dir) {
    pluginScripts = pluginScripts.concat(
      utils.findScripts(dir, options.scriptExtensions)
    );
    var envdir = dir + '/' + options.env;
    pluginScripts = pluginScripts.concat(
      utils.findScripts(envdir, options.scriptExtensions)
    );
  });

  pluginScripts = _.uniq(pluginScripts);
  debug('Plugin scripts: %j', pluginScripts);
  this.configure(context, pluginScripts);
  return pluginScripts;
};

PluginScript.prototype.compile = function(context) {
  var pluginScripts = context.configurations.pluginScripts;
  context.instructions = context.instructions || {};
  var plugins = context.instructions.pluginScripts = {};
  var self = this;
  pluginScripts.forEach(function(ps) {
    debug('Loading %s', ps);
    var factory = require(ps);
    var handler = factory(self.options);
    var name = handler.name || path.basename(ps, '.js');
    debug('Loaded plugin name: %s', name);
    plugins[name] = handler;
  });
};
