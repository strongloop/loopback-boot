// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var assert = require('assert');
var semver = require('semver');
var debug = require('debug')('loopback:boot:executor');
var async = require('async');
var path = require('path');
var format = require('util').format;
var g = require('strong-globalize')();

/**
 * Execute bootstrap instructions gathered by `boot.compile`.
 *
 * @param {Object} app The loopback app to boot.
 * @options {Object} instructions Boot instructions.
 * @param {Function} [callback] Callback function.
 *
 * @header boot.execute(instructions)
 */

module.exports = function execute(app, instructions, callback) {
  callback = callback || function() {};

  app.booting = true;

  patchAppLoopback(app);
  assertLoopBackVersion(app);

  setEnv(app, instructions);
  setHost(app, instructions);
  setPort(app, instructions);
  setApiRoot(app, instructions);
  applyAppConfig(app, instructions);

  setupDataSources(app, instructions);
  setupModels(app, instructions);
  setupMiddleware(app, instructions);
  setupComponents(app, instructions);

  // Run the boot scripts in series synchronously or asynchronously
  // Please note async supports both styles
  async.series([
    function(done) {
      runBootScripts(app, instructions, done);
    },
    function(done) {
      enableAnonymousSwagger(app, instructions);
      done();
    },
    // Ensure both the "booted" event and the callback are always called
    // in the next tick of the even loop.
    // See http://blog.izs.me/post/59142742143/designing-apis-for-asynchrony
    process.nextTick,
  ], function(err) {
    app.booting = false;

    if (err) return callback(err);

    app.emit('booted');

    callback();
  });
};

function patchAppLoopback(app) {
  if (app.loopback) return;
  // app.loopback was introduced in 1.9.0
  // patch the app object to make loopback-boot work with older versions too
  try {
    app.loopback = require('loopback');
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      g.error(
          'When using {{loopback-boot}} with {{loopback}} <1.9, ' +
          'the {{loopback}} module must be available ' +
          'for `{{require(\'loopback\')}}`.');
    }
    throw err;
  }
}

function assertLoopBackVersion(app) {
  var RANGE = '1.x || 2.x || ^3.0.0-alpha';

  var loopback = app.loopback;
  // remove any pre-release tag from the version string,
  // because semver has special treatment of pre-release versions,
  // while loopback-boot treats pre-releases the same way as regular versions
  var version = (loopback.version || '1.0.0').replace(/-.*$/, '');
  if (!semver.satisfies(version, RANGE)) {
    var msg = g.f(
      'The `{{app}}` is powered by an incompatible {{loopback}} version %s. ' +
      'Supported versions: %s',
      loopback.version || '(unknown)',
      RANGE);
    throw new Error(msg);
  }
}

function setEnv(app, instructions) {
  var env = instructions.env;
  if (env !== undefined)
    app.set('env', env);
}

function setHost(app, instructions) {
  // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
  var host =
    process.env.npm_config_host ||
    process.env.OPENSHIFT_SLS_IP ||
    process.env.OPENSHIFT_NODEJS_IP ||
    process.env.HOST ||
    process.env.VCAP_APP_HOST ||
    instructions.config.host ||
    process.env.npm_package_config_host ||
    app.get('host');

  if (host !== undefined) {
    assert(typeof host === 'string', g.f('{{app.host}} must be a {{string}}'));
    app.set('host', host);
  }
}

function setPort(app, instructions) {
  // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
  var port = find([
    process.env.npm_config_port,
    process.env.OPENSHIFT_SLS_PORT,
    process.env.OPENSHIFT_NODEJS_PORT,
    process.env.PORT,
    process.env.VCAP_APP_PORT,
    instructions.config.port,
    process.env.npm_package_config_port,
    app.get('port'),
    3000,
  ], function(p) {
    return p != null;
  });

  if (port !== undefined) {
    var portType = typeof port;
    assert(portType === 'string' || portType === 'number',
      g.f('{{app.port}} must be a {{string}} or {{number}}'));
    app.set('port', port);
  }
}

function find(array, predicate) {
  return array.filter(predicate)[0];
}

function setApiRoot(app, instructions) {
  var restApiRoot =
    instructions.config.restApiRoot ||
    app.get('restApiRoot') ||
    '/api';

  assert(restApiRoot !== undefined, g.f('{{app.restBasePath}} is required'));
  assert(typeof restApiRoot === 'string',
    g.f('{{app.restApiRoot}} must be a {{string}}'));
  assert(/^\//.test(restApiRoot),
    g.f('{{app.restApiRoot}} must start with "/"'));
  app.set('restApiRoot', restApiRoot);
}

function applyAppConfig(app, instructions) {
  var appConfig = instructions.config;
  for (var configKey in appConfig) {
    var cur = app.get(configKey);
    if (cur === undefined || cur === null) {
      app.set(configKey, appConfig[configKey]);
    }
  }
}

function setupDataSources(app, instructions) {
  forEachKeyedObject(instructions.dataSources, function(key, obj) {
    var opts = {
      useEnvVars: true,
    };
    obj = getUpdatedConfigObject(app, obj, opts);
    var lazyConnect = process.env.LB_LAZYCONNECT_DATASOURCES;
    if (lazyConnect) {
      obj.lazyConnect =
        lazyConnect === 'false' || lazyConnect === '0' ? false : true;
    }
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
  var modelBuilder = (app.registry || app.loopback).modelBuilder;
  var BaseClass = app.loopback.Model;
  var mixins = instructions.mixins || [];

  if (!modelBuilder.mixins || !mixins.length) return;

  mixins.forEach(function(obj) {
    var mixin = require(obj.sourceFile);

    if (typeof mixin === 'function' || mixin.prototype instanceof BaseClass) {
      debug('Defining mixin %s', obj.name);
      modelBuilder.mixins.define(obj.name, mixin); // TODO (name, mixin, meta)
    } else {
      debug('Skipping mixin file %s - `module.exports` is not a function' +
        ' or Loopback model', obj);
    }
  });
}

function defineModels(app, instructions) {
  var registry = app.registry || app.loopback;
  instructions.models.forEach(function(data) {
    var name = data.name;
    var model;

    if (!data.definition) {
      model = registry.getModel(name);
      if (!model) {
        throw new Error(g.f('Cannot configure unknown model %s', name));
      }
      debug('Configuring existing model %s', name);
    } else if (isBuiltinLoopBackModel(app, data)) {
      model = registry.getModel(name);
      assert(model, g.f('Built-in model %s should have been defined', name));
      debug('Configuring built-in LoopBack model %s', name);
    } else {
      debug('Creating new model %s %j', name, data.definition);
      model = registry.createModel(data.definition);
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

// Regular expression to match built-in loopback models
var LOOPBACK_MODEL_REGEXP = new RegExp(
  ['', 'node_modules', 'loopback', '[^\\/\\\\]+', 'models', '[^\\/\\\\]+\\.js$']
    .join('\\' + path.sep));

function isBuiltinLoopBackModel(app, data) {
  // 1. Built-in models are exposed on the loopback object
  if (!app.loopback[data.name]) return false;

  // 2. Built-in models have a script file `loopback/{facet}/models/{name}.js`
  var srcFile = data.sourceFile;
  return srcFile &&
    LOOPBACK_MODEL_REGEXP.test(srcFile);
}

function forEachKeyedObject(obj, fn) {
  if (typeof obj !== 'object') return;

  Object.keys(obj).forEach(function(key) {
    fn(key, obj[key]);
  });
}

function runScripts(app, list, callback) {
  list = list || [];
  var functions = [];
  list.forEach(function(filepath) {
    debug('Requiring script %s', filepath);
    try {
      var exports = require(filepath);
      if (typeof exports === 'function') {
        debug('Exported function detected %s', filepath);
        functions.push({
          path: filepath,
          func: exports,
        });
      }
    } catch (err) {
      g.error('Failed loading boot script: %s\n%s', filepath, err.stack);
      throw err;
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

function setupMiddleware(app, instructions) {
  if (!instructions.middleware) {
    // the browserified client does not support middleware
    return;
  }

  // Phases can be empty
  var phases = instructions.middleware.phases || [];
  assert(Array.isArray(phases),
    g.f('{{instructions.middleware.phases}} must be an {{array}}'));

  var middleware = instructions.middleware.middleware;
  assert(Array.isArray(middleware),
    'instructions.middleware.middleware must be an object');

  debug('Defining middleware phases %j', phases);
  app.defineMiddlewarePhases(phases);

  middleware.forEach(function(data) {
    debug('Configuring middleware %j%s', data.sourceFile,
        data.fragment ? ('#' + data.fragment) : '');
    var factory = require(data.sourceFile);
    if (data.fragment) {
      factory = factory[data.fragment].bind(factory);
    }
    assert(typeof factory === 'function',
      'Middleware factory must be a function');
    var opts = {
      useEnvVars: true,
    };
    data.config = getUpdatedConfigObject(app, data.config, opts);
    app.middlewareFromConfig(factory, data.config);
  });
}

function getUpdatedConfigObject(app, config, opts) {
  var DYNAMIC_CONFIG_PARAM = /\$\{(\w+)\}$/;
  var useEnvVars = opts && opts.useEnvVars;

  function getConfigVariable(param) {
    var configVariable = param;
    var match = configVariable.match(DYNAMIC_CONFIG_PARAM);
    if (match) {
      var varName = match[1];
      if (useEnvVars && process.env[varName] !== undefined) {
        debug('Dynamic Configuration: Resolved via process.env: %s as %s',
          process.env[varName], param);
        configVariable = process.env[varName];
      } else if (app.get(varName) !== undefined) {
        debug('Dynamic Configuration: Resolved via app.get(): %s as %s',
          app.get(varName), param);
        var appValue = app.get(varName);
        configVariable = appValue;
      } else {
        // previously it returns the original string such as "${restApiRoot}"
        // it will now return `undefined`, for the use case of
        // dynamic datasources url:`undefined` to fallback to other parameters
        configVariable = undefined;
        g.warn('%s does not resolve to a valid value, returned as %s. ' +
        '"%s" must be resolvable in Environment variable or by app.get().',
          param, configVariable, varName);
        debug('Dynamic Configuration: Cannot resolve variable for `%s`, ' +
          'returned as %s', varName, configVariable);
      }
    }
    return configVariable;
  }

  function interpolateVariables(config) {
    // config is a string and contains a config variable ('${var}')
    if (typeof config === 'string')
      return getConfigVariable(config);

    // anything but an array or object
    if (typeof config !== 'object' || config == null)
      return config;

    // recurse into array elements
    if (Array.isArray(config))
      return config.map(interpolateVariables);

    // Not a plain object. Examples: RegExp, Date,
    if (!config.constructor || config.constructor !== Object)
      return config;

    // recurse into object props
    var interpolated = {};
    Object.keys(config).forEach(function(configKey) {
      var value = config[configKey];
      if (Array.isArray(value)) {
        interpolated[configKey] = value.map(interpolateVariables);
      } else if (typeof value === 'string') {
        interpolated[configKey] = getConfigVariable(value);
      } else if (value === null) {
        interpolated[configKey] = value;
      } else if (typeof value === 'object' && Object.keys(value).length) {
        interpolated[configKey] = interpolateVariables(value);
      } else {
        interpolated[configKey] = value;
      }
    });
    return interpolated;
  }

  return interpolateVariables(config);
}

function setupComponents(app, instructions) {
  instructions.components.forEach(function(data) {
    debug('Configuring component %j', data.sourceFile);
    var configFn = require(data.sourceFile);
    var opts = {
      useEnvVars: true,
    };
    data.config = getUpdatedConfigObject(app, data.config, opts);
    configFn(app, data.config);
  });
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
