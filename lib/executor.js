var assert = require('assert');
var _ = require('underscore');
var loopback = require('loopback');
var debug = require('debug')('loopback:boot:executor');

/**
 * Execute bootstrap instructions gathered by `boot.compile`.
 *
 * @options {Object} app The loopback app to boot.
 * @options {Object} instructions Boot instructions.
 *
 * @header boot.execute(instructions)
 */

module.exports = function execute(app, instructions) {
  setHost(app, instructions);
  setPort(app, instructions);
  setApiRoot(app, instructions);
  applyAppConfig(app, instructions);

  setupDataSources(app, instructions);
  setupModels(app, instructions);

  runBootScripts(app, instructions);

  enableAnonymousSwagger(app, instructions);
};

function setHost(app, instructions) {
  //jshint camelcase:false
  var host =
    process.env.npm_config_host ||
    process.env.OPENSHIFT_SLS_IP ||
    process.env.OPENSHIFT_NODEJS_IP ||
    process.env.HOST ||
    instructions.app.host ||
    process.env.npm_package_config_host ||
    app.get('host');

  if(host !== undefined) {
    assert(typeof host === 'string', 'app.host must be a string');
    app.set('host', host);
  }
}

function setPort(app, instructions) {
  //jshint camelcase:false
  var port = _.find([
    process.env.npm_config_port,
    process.env.OPENSHIFT_SLS_PORT,
    process.env.OPENSHIFT_NODEJS_PORT,
    process.env.PORT,
    instructions.app.port,
    process.env.npm_package_config_port,
    app.get('port'),
    3000
  ], _.isFinite);

  if(port !== undefined) {
    var portType = typeof port;
    assert(portType === 'string' || portType === 'number',
      'app.port must be a string or number');
    app.set('port', port);
  }
}

function setApiRoot(app, instructions) {
  var restApiRoot =
    instructions.app.restApiRoot ||
    app.get('restApiRoot') ||
    '/api';

  assert(restApiRoot !== undefined, 'app.restBasePath is required');
  assert(typeof restApiRoot === 'string',
    'app.restApiRoot must be a string');
  assert(/^\//.test(restApiRoot),
    'app.restApiRoot must start with "/"');
  app.set('restApiRoot', restApiRoot);
}

function applyAppConfig(app, instructions) {
  var appConfig = instructions.app;
  for(var configKey in appConfig) {
    var cur = app.get(configKey);
    if(cur === undefined || cur === null) {
      app.set(configKey, appConfig[configKey]);
    }
  }
}

function setupDataSources(app, instructions) {
  forEachKeyedObject(instructions.dataSources, function(key, obj) {
    app.dataSource(key, obj);
  });
}

function setupModels(app, instructions) {
  forEachKeyedObject(instructions.models, function(key, obj) {
    var model = loopback.getModel(key);
    if (!model) {
      throw new Error('Cannot configure unknown model ' + key);
    }
    app.model(model, obj);
  });
}

function forEachKeyedObject(obj, fn) {
  if(typeof obj !== 'object') return;

  Object.keys(obj).forEach(function(key) {
    fn(key, obj[key]);
  });
}

function runScripts(app, list) {
  if (!list || !list.length) return;
  list.forEach(function(filepath) {
    var exports = tryRequire(filepath);
    if (typeof exports === 'function')
      exports(app);
  });
}

function tryRequire(modulePath) {
  try {
    return require.apply(this, arguments);
  } catch(e) {
    if(e.code === 'MODULE_NOT_FOUND') {
      debug('Warning: cannot require %s - module not found.', modulePath);
      return undefined;
    }
    console.error('failed to require "%s"', modulePath);
    throw e;
  }
}

function runBootScripts(app, instructions) {
  runScripts(app, instructions.files.boot);
}

function enableAnonymousSwagger(app, instructions) {
  // disable token requirement for swagger, if available
  var swagger = app.remotes().exports.swagger;
  if (!swagger) return;

  var appConfig = instructions.app;
  var requireTokenForSwagger = appConfig.swagger &&
    appConfig.swagger.requireToken;
  swagger.requireToken = requireTokenForSwagger || false;
}
