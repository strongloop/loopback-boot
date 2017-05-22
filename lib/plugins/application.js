// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var util = require('util');
var assert = require('assert');
var semver = require('semver');
var PluginBase = require('../plugin-base');
var g = require('../globalize');

module.exports = function(options) {
  return new Application(options);
};

function Application(options) {
  PluginBase.call(this, options, 'application', 'config');
}

util.inherits(Application, PluginBase);

function assertLoopBackVersion(app) {
  var RANGE = '2.x || 3.x';

  var loopback = app.loopback;
  // remove any pre-release tag from the version string,
  // because semver has special treatment of pre-release versions,
  // while loopback-boot treats pre-releases the same way as regular versions
  var version = (loopback.version || '1.0.0').replace(/-.*$/, '');
  if (!semver.satisfies(version, RANGE)) {
    var msg = g.f(
      'The `app` is powered by an incompatible loopback version %s. ' +
      'Supported versions: %s',
      loopback.version || '(unknown)',
      RANGE);
    throw new Error(msg);
  }
}

function setEnv(app, env) {
  if (env !== undefined)
    app.set('env', env);
}

function setHost(app, appConfig) {
  // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
  var host =
    process.env.npm_config_host ||
    process.env.OPENSHIFT_SLS_IP ||
    process.env.OPENSHIFT_NODEJS_IP ||
    process.env.HOST ||
    process.env.VCAP_APP_HOST ||
    appConfig.host ||
    process.env.npm_package_config_host ||
    app.get('host');

  if (host !== undefined) {
    assert(typeof host === 'string', 'app.host must be a string');
    app.set('host', host);
  }
}

function setPort(app, appConfig) {
  // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
  var port = find([
    process.env.npm_config_port,
    process.env.OPENSHIFT_SLS_PORT,
    process.env.OPENSHIFT_NODEJS_PORT,
    process.env.PORT,
    process.env.VCAP_APP_PORT,
    appConfig.port,
    process.env.npm_package_config_port,
    app.get('port'),
    3000,
  ], function(p) {
    return p != null;
  });

  if (port !== undefined) {
    var portType = typeof port;
    assert(portType === 'string' || portType === 'number',
      'app.port must be a string or number');
    app.set('port', port);
  }
}

function find(array, predicate) {
  return array.filter(predicate)[0];
}

function setApiRoot(app, appConfig) {
  var restApiRoot =
    appConfig.restApiRoot ||
    app.get('restApiRoot') ||
    '/api';

  assert(restApiRoot !== undefined, 'app.restBasePath is required');
  assert(typeof restApiRoot === 'string',
    'app.restApiRoot must be a string');
  assert(/^\//.test(restApiRoot),
    'app.restApiRoot must start with "/"');
  app.set('restApiRoot', restApiRoot);
}

function applyAppConfig(app, appConfig) {
  for (var configKey in appConfig) {
    var cur = app.get(configKey);
    if (cur === undefined || cur === null) {
      app.set(configKey, appConfig[configKey]);
    }
  }
}

Application.prototype.starting = function(context) {
  var app = context.app;
  app.booting = true;
  assertLoopBackVersion(app);

  var appConfig = context.instructions.application;
  setEnv(app, context.instructions.env || this.options.env);
  setHost(app, appConfig);
  setPort(app, appConfig);
  setApiRoot(app, appConfig);
  applyAppConfig(app, appConfig);
};

Application.prototype.started = function(context, done) {
  var app = context.app;
  app.booting = false;
  process.nextTick(function() {
    app.emit('booted');
    done();
  });
};
