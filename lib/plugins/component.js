// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var util = require('util');
var debug = require('debug')('loopback:boot:component');
var PluginBase = require('../plugin-base');

var utils = require('../utils');

var resolveAppScriptPath = utils.resolveAppScriptPath;

module.exports = function(options) {
  return new Component(options);
};

function Component(options) {
  PluginBase.call(this, options, 'components', 'component-config');
}

util.inherits(Component, PluginBase);

Component.prototype.getRootDir =  function() {
  return this.options.componentRootDir || this.options.rootDir;
};

Component.prototype.buildInstructions = function(context, rootDir, config) {
  return Object.keys(config)
    .filter(function(name) {
      return !!config[name];
    }).map(function(name) {
      return {
        sourceFile: resolveAppScriptPath(rootDir, name, {strict: true}),
        config: config[name],
      };
    });
};

Component.prototype.start = function(context) {
  var app = context.app;
  var self = this;
  context.instructions[this.name].forEach(function(data) {
    debug('Configuring component %j', data.sourceFile);
    var configFn = require(data.sourceFile);
    data.config = self.getUpdatedConfigObject(context, data.config,
      {useEnvVars: true});
    configFn(app, data.config);
  });
};
