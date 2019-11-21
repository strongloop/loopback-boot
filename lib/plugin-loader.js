// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const util = require('util');
const utils = require('./utils');
const path = require('path');
const async = require('async');
const debug = require('debug')('loopback:boot:plugin-loader');
const PluginBase = require('./plugin-base');
const _ = require('lodash');

module.exports = function(options) {
  return new PluginScript(options);
};

function PluginScript(options) {
  PluginBase.call(this, options, 'pluginScripts', null);
}

util.inherits(PluginScript, PluginBase);

PluginScript.prototype.load = function(context) {
  const options = this.options;
  const appRootDir = options.rootDir;
  // require directories
  let pluginDirs = options.pluginDirs || []; // precedence
  pluginDirs = pluginDirs.concat(path.join(appRootDir, 'plugins'));
  utils.resolveRelativePaths(pluginDirs, appRootDir);

  let pluginScripts = options.pluginScripts || [];
  utils.resolveRelativePaths(pluginScripts, appRootDir);

  pluginDirs.forEach(function(dir) {
    pluginScripts = pluginScripts.concat(
      utils.findScripts(dir, options.scriptExtensions),
    );
    const envdir = dir + '/' + options.env;
    pluginScripts = pluginScripts.concat(
      utils.findScripts(envdir, options.scriptExtensions),
    );
  });

  pluginScripts = _.uniq(pluginScripts);
  debug('Plugin scripts: %j', pluginScripts);
  this.configure(context, pluginScripts);
  return pluginScripts;
};

PluginScript.prototype.compile = function(context) {
  const pluginScripts = context.configurations.pluginScripts;
  context.instructions = context.instructions || {};
  const plugins = context.instructions.pluginScripts = {};
  const self = this;
  pluginScripts.forEach(function(ps) {
    debug('Loading %s', ps);
    const factory = require(ps);
    const handler = factory(self.options);
    const name = handler.name || path.basename(ps, '.js');
    debug('Loaded plugin name: %s', name);
    plugins[name] = handler;
  });
};
