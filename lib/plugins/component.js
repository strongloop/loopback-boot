// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const util = require('util');
const debug = require('debug')('loopback:boot:component');
const PluginBase = require('../plugin-base');

const utils = require('../utils');

const resolveAppScriptPath = utils.resolveAppScriptPath;

module.exports = function(options) {
  return new Component(options);
};

function Component(options) {
  PluginBase.call(this, options, 'components', 'component-config');
}

util.inherits(Component, PluginBase);

Component.prototype.getRootDir = function() {
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
  const app = context.app;
  const self = this;
  context.instructions[this.name].forEach(function(data) {
    debug('Configuring component %j', data.sourceFile);
    const configFn = require(data.sourceFile);
    data.config = self.getUpdatedConfigObject(context, data.config,
      {useEnvVars: true});
    configFn(app, data.config);
  });
};
