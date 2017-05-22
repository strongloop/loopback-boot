// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var _ = require('lodash');
var assert = require('assert');
var async = require('async');
var utils = require('./utils');
var path = require('path');
var pluginLoader = require('./plugin-loader');
var debug = require('debug')('loopback:boot:bootstrapper');
var Promise = require('bluebird');
var arrayToObject = require('./utils').arrayToObject;

module.exports = Bootstrapper;

function createPromiseCallback() {
  var cb;
  var promise = new Promise(function(resolve, reject) {
    cb = function(err, data) {
      if (err) return reject(err);
      return resolve(data);
    };
  });
  cb.promise = promise;
  return cb;
}

var builtinPlugins = [
  'application', 'datasource', 'model', 'mixin',
  'middleware', 'component', 'boot-script', 'swagger',
];

var builtinPhases = [
  'load', 'compile', 'starting', 'start', 'started',
];

function loadAndRegisterPlugins(bootstrapper, options) {
  var loader = pluginLoader(options);
  var loaderContext = {};
  loader.load(loaderContext);
  loader.compile(loaderContext);

  for (var i in loaderContext.instructions.pluginScripts) {
    bootstrapper.use('/boot/' + i, loaderContext.instructions.pluginScripts[i]);
  }
}

/**
 * Create a new Bootstrapper with options
 * @param options
 * @constructor
 */
function Bootstrapper(options) {
  this.plugins = [];
  options = options || {};

  if (typeof options === 'string') {
    options = {appRootDir: options};
  }

  // For setting properties without modifying the original object
  options = Object.create(options);

  var appRootDir = options.appRootDir = options.appRootDir || process.cwd();
  var env = options.env || process.env.NODE_ENV || 'development';
  var scriptExtensions = options.scriptExtensions ?
    arrayToObject(options.scriptExtensions) :
    require.extensions;

  var appConfigRootDir = options.appConfigRootDir || appRootDir;

  options.rootDir = appConfigRootDir;
  options.env = env;
  options.scriptExtensions = scriptExtensions;
  this.options = options;

  this.phases = options.phases || builtinPhases;
  this.builtinPlugins = options.plugins || builtinPlugins;
  assert(Array.isArray(this.phases), 'Invalid phases: ' + this.phases);
  assert(Array.isArray(this.plugins), 'Invalid plugins: ' +
    this.builtinPlugins);

  var self = this;
  self.builtinPlugins.forEach(function(p) {
    var factory = require('./plugins/' + p);
    self.use('/boot/' + p, factory(options));
  });

  try {
    loadAndRegisterPlugins(self, options);
  } catch (err) {
    debug('Cannot load & register plugins: %s', err.stack || err);
  }
}

/**
 * Register a handler to a given path
 * @param {String} path
 * @param {Function} handler
 */
Bootstrapper.prototype.use = function(path, handler) {
  var plugin = {
    path: path,
    handler: handler,
  };
  this.plugins.push(plugin);
};

/**
 * Get a list of plugins for the given path
 * @param {String} path
 * @returns {*}
 */
Bootstrapper.prototype.getPlugins = function(path) {
  if (path[path.length - 1] !== '/') {
    path = path + '/';
  }
  return this.plugins.filter(function(p) {
    return p.path.indexOf(path) === 0;
  });
};

/**
 * Get a list of extensions for the given path
 * @param {String} path
 * @returns {*}
 */
Bootstrapper.prototype.getExtensions = function(path) {
  if (path[path.length - 1] !== '/') {
    path = path + '/';
  }
  return this.plugins.filter(function(p) {
    if (p.path.indexOf(path) === -1) return false;
    var name = p.path.substring(path.length);
    return name && name.indexOf('/') === -1;
  });
};

/**
 * Add more phases. The order of phases is decided by the sequence of phase
 * names
 * @param {String[]} phases An array of phase names
 * @returns {String[]} New list of phases
 */
Bootstrapper.prototype.addPhases = function(phases) {
  this.phases = utils.mergePhaseNameLists(this.phases, phases || []);
  return this.phases;
};

function pluginIteratorFactory(context, phase) {
  return function executePluginPhase(plugin, done) {
    var result;
    if (typeof plugin.handler[phase] !== 'function') {
      debug('Skipping %s.%s', plugin.handler.name, phase);
      return done();
    }
    debug('Invoking %s.%s', plugin.handler.name, phase);
    try {
      if (plugin.handler[phase].length === 2) {
        plugin.handler[phase](context, done);
      } else {
        result = plugin.handler[phase](context);
        Promise.resolve(result)
          .then(function onPluginPhaseResolved(value) {
            done(null, value);
          }, function onPluginPhaseRejected(err) {
            debug('Unable to invoke %s.%s()', plugin.name, phase, err);
            done(err);
          });
      }
    } catch (err) {
      debug('Unable to invoke %s.%s()', plugin.name, phase, err);
      done(err);
    }
  };
}

/**
 * Invoke the plugins phase by phase with the given context
 * @param {Object} context Context object
 * @param {Function} done Callback function. If not provided, a promise will be
 * returned
 * @returns {*}
 */
Bootstrapper.prototype.run = function(context, done) {
  if (!done) {
    done = createPromiseCallback();
  }
  var options = this.options;
  var appRootDir = options.appRootDir = options.appRootDir || process.cwd();
  var env = options.env || process.env.NODE_ENV || 'development';

  var appConfigRootDir = options.appConfigRootDir || appRootDir;

  options.rootDir = appConfigRootDir;
  options.env = env;

  context = context || {};

  var phases = context.phases || this.phases;
  var bootPlugins = this.getExtensions('/boot');
  async.eachSeries(phases, function(phase, done) {
    debug('Phase %s', phase);
    async.eachSeries(bootPlugins, pluginIteratorFactory(context, phase), done);
  }, function(err) {
    return done(err, context);
  });
  return done.promise;
};
