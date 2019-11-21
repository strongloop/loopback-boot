// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const util = require('util');
const PluginBase = require('../plugin-base');

module.exports = function(options) {
  return new Swagger(options);
};

function Swagger(options) {
  PluginBase.call(this, options, 'apis', null);
}

util.inherits(Swagger, PluginBase);

Swagger.prototype.start = function(context) {
  const app = context.app;
  const appConfig = context.instructions.application;
  // disable token requirement for swagger, if available
  const swagger = app.remotes().exports.swagger;
  if (!swagger) return;

  const requireTokenForSwagger = appConfig.swagger &&
    appConfig.swagger.requireToken;
  swagger.requireToken = requireTokenForSwagger || false;
};
