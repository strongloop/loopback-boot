// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var fs = require('fs');
var path = require('path');
var debug = require('debug')('loopback:boot:plugin');
var assert = require('assert');
var _ = require('lodash');
var util = require('./utils');
var g = require('./globalize');

module.exports = PluginBase;

function PluginBase(options, name, artifact) {
  this.options = options || {};
  this.name = name || options.name;
  this.artifact = artifact || options.artifact;
}

PluginBase.prototype.getRootDir = function() {
  return this.options.rootDir;
};

PluginBase.prototype.load = function(context) {
  var rootDir = this.getRootDir() || this.options.rootDir;
  var env = this.options.env;
  assert(this.name, 'Plugin name must to be set');
  debug('Root dir: %s, env: %s, artifact: %s', rootDir, env, this.artifact);
  var config = {};
  if (this.options[this.name]) {
    // First check if options have the corresponding config object
    debug('Artifact: %s is using provided config obj instead' +
    ' of config file');
    config = this.options[this.name];
  } else {
    if (this.artifact) {
      config = this.loadNamed(rootDir, env, this.artifact);
    }
  }
  // Register as context.configurations.<plugin-name>
  return this.configure(context, config);
};

PluginBase.prototype.configure = function(context, config) {
  config = config || {};
  // Register as context.configurations.<plugin-name>
  if (!context.configurations) {
    context.configurations = {};
  }
  context.configurations[this.name] = config;
  return config;
};

PluginBase.prototype.merge = function(target, config, keyPrefix) {
  return this._mergeObjects(target, config, keyPrefix);
};

/**
 * Load named configuration.
 * @param {String} rootDir Directory where to look for files.
 * @param {String} env Environment, usually `process.env.NODE_ENV`
 * @param {String} name
 * @returns {Object}
 */
PluginBase.prototype.loadNamed = function(rootDir, env, name) {
  var files = this.findConfigFiles(rootDir, env, name);
  debug('Looking in dir %s for %s configs', rootDir, this.name);
  if (files.length) {
    debug('found %s %s files: %j', env, name, files);
    files.forEach(function(f) {
      debug('  %s', f);
    });
  }
  var configs = this._loadConfigFiles(files);
  var merged = this._mergeConfigurations(configs);

  debug('merged %s %s configuration %j', env, name, merged);

  return merged;
};

/**
 * Search `rootDir` for all files containing configuration for `name`.
 * @param {String} rootDir Root directory
 * @param {String} env Environment, usually `process.env.NODE_ENV`
 * @param {String} name Name
 * @param {Array.<String>} exts An array of extension names
 * @returns {Array.<String>} Array of absolute file paths.
 */
PluginBase.prototype.findConfigFiles = function(rootDir, env, name, exts) {
  var master = ifExists(name + '.json');
  if (!master && (ifExistsWithAnyExt(name + '.local') ||
    ifExistsWithAnyExt(name + '.' + env))) {
    g.warn('WARNING: Main config file "%s{{.json}}" is missing', name);
  }
  if (!master) return [];

  var candidates = [
    master,
    ifExistsWithAnyExt(name + '.local'),
    ifExistsWithAnyExt(name + '.' + env),
  ];

  return candidates.filter(function(c) {
    return c !== undefined;
  });

  function ifExists(fileName) {
    var filePath = path.resolve(rootDir, fileName);
    return util.fileExistsSync(filePath) ? filePath : undefined;
  }

  function ifExistsWithAnyExt(fileName) {
    var extensions = exts || ['js', 'json'];
    var file;
    for (var i = 0, n = extensions.length; i < n; i++) {
      file = ifExists(fileName + '.' + extensions[i]);
      if (file) {
        return file;
      }
    }
  }
};

/**
 * Load configuration files into an array of objects.
 * Attach non-enumerable `_filename` property to each object.
 * @param {Array.<String>} files
 * @returns {Array.<Object>}
 */
PluginBase.prototype._loadConfigFiles = function(files) {
  return files.map(function(f) {
    var config = require(f);
    config = _.cloneDeep(config);
    Object.defineProperty(config, '_filename', {
      enumerable: false,
      value: f,
    });
    return config;
  });
};

/**
 * Merge multiple configuration objects into a single one.
 * @param {Array.<Object>} configObjects
 */
PluginBase.prototype._mergeConfigurations = function(configObjects) {
  var result = configObjects.shift() || {};
  while (configObjects.length) {
    var next = configObjects.shift();
    this.merge(result, next, next._filename);
  }
  return result;
};

PluginBase.prototype._mergeObjects = function(target, config, keyPrefix) {
  for (var key in config) {
    var fullKey = keyPrefix ? keyPrefix + '.' + key : key;
    var err = this._mergeSingleItemOrProperty(target, config, key, fullKey);
    if (err) throw err;
  }
  return null; // no error
};

PluginBase.prototype._mergeNamedItems = function(arr1, arr2, key) {
  assert(Array.isArray(arr1), 'invalid array: ' + arr1);
  assert(Array.isArray(arr2), 'invalid array: ' + arr2);
  key = key || 'name';
  var result = [].concat(arr1);
  for (var i = 0, n = arr2.length; i < n; i++) {
    var item = arr2[i];
    var found = false;
    if (item[key]) {
      for (var j = 0, k = result.length; j < k; j++) {
        if (result[j][key] === item[key]) {
          this._mergeObjects(result[j], item);
          found = true;
          break;
        }
      }
    }
    if (!found) {
      result.push(item);
    }
  }
  return result;
};

PluginBase.prototype._mergeSingleItemOrProperty =
  function(target, config, key, fullKey) {
    var origValue = target[key];
    var newValue = config[key];

    if (!hasCompatibleType(origValue, newValue)) {
      return 'Cannot merge values of incompatible types for the option `' +
        fullKey + '`.';
    }

    if (Array.isArray(origValue)) {
      return this._mergeArrays(origValue, newValue, fullKey);
    }

    if (newValue !== null && typeof origValue === 'object') {
      return this._mergeObjects(origValue, newValue, fullKey);
    }

    target[key] = newValue;
    return null; // no error
  };

PluginBase.prototype._mergeArrays = function(target, config, keyPrefix) {
  if (target.length !== config.length) {
    return 'Cannot merge array values of different length' +
      ' for the option `' + keyPrefix + '`.';
  }

  // Use for(;;) to iterate over undefined items, for(in) would skip them.
  for (var ix = 0; ix < target.length; ix++) {
    var fullKey = keyPrefix + '[' + ix + ']';
    var err = this._mergeSingleItemOrProperty(target, config, ix, fullKey);
    if (err) return err;
  }

  return null; // no error
};

function hasCompatibleType(origValue, newValue) {
  if (origValue === null || origValue === undefined)
    return true;

  if (Array.isArray(origValue))
    return Array.isArray(newValue);

  if (typeof origValue === 'object')
    return typeof newValue === 'object';

  // Note: typeof Array() is 'object' too,
  // we don't need to explicitly check array types
  return typeof newValue !== 'object';
}

PluginBase.prototype.compile = function(context) {
  var instructions;
  if (typeof this.buildInstructions === 'function') {
    var rootDir = this.options.rootDir;
    var config = context.configurations[this.name] || {};
    instructions = this.buildInstructions(context, rootDir, config);
  } else {
    instructions = context.configurations[this.name];
  }

  // Register as context.instructions.<plugin-name>
  if (!context.instructions) {
    context.instructions = {};
    if (this.options.appId) {
      context.instructions.appId = this.options.appId;
    }
  }
  context.instructions[this.name] = instructions;

  return undefined;
};

var DYNAMIC_CONFIG_PARAM = /\$\{(\w+)\}$/;
function getConfigVariable(app, param, useEnvVars) {
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
        '"%s" must be resolvable in Environment variable or by {{app.get()}}.',
        param, configVariable, varName);
      debug('Dynamic Configuration: Cannot resolve variable for `%s`, ' +
        'returned as %s', varName, configVariable);
    }
  }
  return configVariable;
}

PluginBase.prototype.getUpdatedConfigObject = function(context, config, opts) {
  var app = context.app;
  var useEnvVars = opts && opts.useEnvVars;

  function interpolateVariables(config) {
    // config is a string and contains a config variable ('${var}')
    if (typeof config === 'string')
      return getConfigVariable(app, config, useEnvVars);

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
        interpolated[configKey] = getConfigVariable(app, value, useEnvVars);
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
};
