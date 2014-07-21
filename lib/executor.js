var assert = require('assert');
var _ = require('underscore');
var semver = require('semver');
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
  patchAppLoopback(app);
  assertLoopBackVersion(app);

  setHost(app, instructions);
  setPort(app, instructions);
  setApiRoot(app, instructions);
  applyAppConfig(app, instructions);

  setupDataSources(app, instructions);
  setupModels(app, instructions);
  autoAttach(app);

  runBootScripts(app, instructions);

  enableAnonymousSwagger(app, instructions);
};

function patchAppLoopback(app) {
  if (app.loopback) return;
  // app.loopback was introduced in 1.9.0
  // patch the app object to make loopback-boot work with older versions too
  try {
    app.loopback = require('loopback');
  } catch(err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.error(
          'When using loopback-boot with loopback <1.9, '+
          'the loopback module must be available for `require(\'loopback\')`.');
    }
    throw err;
  }
}

function assertLoopBackVersion(app) {
  var RANGE = '1.x || 2.x';

  var loopback = app.loopback;
  if (!semver.satisfies(loopback.version || '1.0.0', RANGE)) {
    throw new Error(
        'The `app` is powered by an incompatible loopback version %s. ' +
        'Supported versions: %s',
        loopback.version || '(unknown)',
      RANGE);
  }
}

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
    app.model(key, obj);
  });

  runScripts(app, instructions.files.models);
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
    if (isFunctionNotModelCtor(exports, app.loopback.Model))
      exports(app);
  });
}

function isFunctionNotModelCtor(fn, Model) {
  return typeof fn === 'function' &&
    !(fn.prototype instanceof Model);
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

function autoAttach(app) {
  var loopback = app.loopback;
  var modelBuilder = loopback.modelBuilder || loopback.Model.modelBuilder;
  var models = modelBuilder.models || {};

  Object.keys(models).forEach(function(modelName) {
    var ModelCtor = models[modelName];
    if (!ModelCtor || !ModelCtor.autoAttach) return;

    // Do not auto attach models with an explicit data source
    if (ModelCtor.dataSource instanceof loopback.DataSource) return;

    var ds = loopback.getDefaultDataSourceForType(ModelCtor.autoAttach);
    if (ds instanceof loopback.DataSource) {
      ModelCtor.attachTo(ds);
    } else {
      console.warn(
        'Cannot autoAttach model "%s". No dataSource found of type %s.',
        ModelCtor.modelName,
        ModelCtor.autoAttach);
    }
  });
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
