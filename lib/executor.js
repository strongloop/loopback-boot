var assert = require('assert');
var _ = require('underscore');
var semver = require('semver');
var debug = require('debug')('loopback:boot:executor');
var async = require('async');

/**
 * Execute bootstrap instructions gathered by `boot.compile`.
 *
 * @options {Object} app The loopback app to boot.
 * @options {Object} instructions Boot instructions.
 *
 * @header boot.execute(instructions)
 */

module.exports = function execute(app, instructions, callback) {
  patchAppLoopback(app);
  assertLoopBackVersion(app);

  setHost(app, instructions);
  setPort(app, instructions);
  setApiRoot(app, instructions);
  applyAppConfig(app, instructions);

  setupDataSources(app, instructions);
  setupModels(app, instructions);

  // Run the boot scripts in series synchronously or asynchronously
  // Please note async supports both styles
  async.series([
    function(done) {
      runBootScripts(app, instructions, done);
    },
    function(done) {
      enableAnonymousSwagger(app, instructions);
      done();
    }], callback);
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
    instructions.config.host ||
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
    instructions.config.port,
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
    instructions.config.restApiRoot ||
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
  var appConfig = instructions.config;
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
  defineMixins(app, instructions);
  defineModels(app, instructions);

  instructions.models.forEach(function(data) {
    // Skip base models that are not exported to the app
    if (!data.config) return;

    app.model(data._model, data.config);
  });
}

function defineMixins(app, instructions) {
  var modelBuilder = app.loopback.modelBuilder;
  var BaseClass = app.loopback.Model;
  var mixins = instructions.mixins || {};
  var mixinNames = Object.keys(mixins);
  if (modelBuilder.mixins && mixinNames.length > 0) {
    mixinNames.forEach(function(name) {
      var mixin = tryRequire(mixins[name]);
      if (typeof mixin === 'function' || mixin.prototype instanceof BaseClass) {
        var mixinName = mixin.name || mixin.mixinName || name;
        debug('Configuring mixin %s', mixinName);
        modelBuilder.mixins.define(mixinName, mixin);
      } else {
        debug('Skipping mixin file %s - `module.exports` is not a function'
          + ' or Loopback model',
          mixins[name]);
      }
    });
  }
}

function defineModels(app, instructions) {
  instructions.models.forEach(function(data) {
    var name = data.name;
    var model;

    if (!data.definition) {
      model = app.loopback.getModel(name);
      if (!model) {
        throw new Error('Cannot configure unknown model ' + name);
      }
      debug('Configuring existing model %s', name);
    } else {
      debug('Creating new model %s %j', name, data.definition);
      model = app.loopback.createModel(data.definition);
      if (data.sourceFile) {
        debug('Loading customization script %s', data.sourceFile);
        var code = require(data.sourceFile);
        if (typeof code === 'function') {
          debug('Customizing model %s', name);
          code(model);
        } else {
          debug('Skipping model file %s - `module.exports` is not a function',
            data.sourceFile);
        }
      }
    }

    data._model = model;
  });
}

function forEachKeyedObject(obj, fn) {
  if(typeof obj !== 'object') return;

  Object.keys(obj).forEach(function(key) {
    fn(key, obj[key]);
  });
}

function runScripts(app, list, callback) {
  list = list || [];
  var functions = [];
  list.forEach(function(filepath) {
    debug('Requiring script %s', filepath);
    var exports = tryRequire(filepath);
    if (typeof exports === 'function') {
      debug('Exported function detected %s', filepath);
      functions.push({
        path: filepath,
        func: exports
      });
    }
  });

  async.eachSeries(functions, function(f, done) {
    debug('Running script %s', f.path);
    if (f.func.length >= 2) {
      debug('Starting async function %s', f.path);
      f.func(app, function(err) {
        debug('Async function finished %s', f.path);
        done(err);
      });
    } else {
      debug('Starting sync function %s', f.path);
      f.func(app);
      debug('Sync function finished %s', f.path);
      done();
    }
  }, callback);
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

function runBootScripts(app, instructions, callback) {
  runScripts(app, instructions.files.boot, callback);
}

function enableAnonymousSwagger(app, instructions) {
  // disable token requirement for swagger, if available
  var swagger = app.remotes().exports.swagger;
  if (!swagger) return;

  var appConfig = instructions.config;
  var requireTokenForSwagger = appConfig.swagger &&
    appConfig.swagger.requireToken;
  swagger.requireToken = requireTokenForSwagger || false;
}
