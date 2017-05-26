// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var util = require('util');
var PluginBase = require('../plugin-base');

module.exports = function(options) {
  return new Swagger(options);
};

function Swagger(options) {
  PluginBase.call(this, options, 'apis', null);
}

util.inherits(Swagger, PluginBase);

Swagger.prototype.start = function(context) {
  var app = context.app;
  var appConfig = context.instructions.application;
  // disable token requirement for swagger, if available
  var swagger = app.remotes().exports.swagger;
  if (!swagger) return;

  var requireTokenForSwagger = appConfig.swagger &&
    appConfig.swagger.requireToken;
  swagger.requireToken = requireTokenForSwagger || false;
};
