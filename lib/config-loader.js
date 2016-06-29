// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var cloneDeep = require('lodash').cloneDeep;
var fs = require('fs');
var path = require('path');
var debug = require('debug')('loopback:boot:config-loader');
var assert = require('assert');

var ConfigLoader = exports;

/**
 * Load application config from `config.json` and friends.
 * @param {String} rootDir Directory where to look for files.
 * @param {String} env Environment, usually `process.env.NODE_ENV`
 * @returns {Object}
 */
ConfigLoader.loadAppConfig = function(rootDir, env) {
  return loadNamed(rootDir, env, 'config', mergeAppConfig);
};

/**
 * Load data-sources config from `datasources.json` and friends.
 * @param {String} rootDir Directory where to look for files.
 * @param {String} env Environment, usually `process.env.NODE_ENV`
 * @returns {Object}
 */
ConfigLoader.loadDataSources = function(rootDir, env) {
  return loadNamed(rootDir, env, 'datasources', mergeDataSourceConfig);
};

/**
 * Load model config from `model-config.json` and friends.
 * @param {String} rootDir Directory where to look for files.
 * @param {String} env Environment, usually `process.env.NODE_ENV`
 * @returns {Object}
 */
ConfigLoader.loadModels = function(rootDir, env) {
  return loadNamed(rootDir, env, 'model-config', mergeModelConfig);
};

/**
 * Load middleware config from `middleware.json` and friends.
 * @param {String} rootDir Directory where to look for files.
 * @param {String} env Environment, usually `process.env.NODE_ENV`
 * @returns {Object}
 */
ConfigLoader.loadMiddleware = function(rootDir, env) {
  return loadNamed(rootDir, env, 'middleware', mergeMiddlewareConfig);
};

/**
 * Load component config from `component-config.json` and friends.
 * @param {String} rootDir Directory where to look for files.
 * @param {String} env Environment, usually `process.env.NODE_ENV`
 * @returns {Object}
 */
ConfigLoader.loadComponents = function(rootDir, env) {
  return loadNamed(rootDir, env, 'component-config', mergeComponentConfig);
};

/*-- Implementation --*/

/**
 * Load named configuration.
 * @param {String} rootDir Directory where to look for files.
 * @param {String} env Environment, usually `process.env.NODE_ENV`
 * @param {String} name
 * @param {function(target:Object, config:Object, filename:String)} mergeFn
 * @returns {Object}
 */
function loadNamed(rootDir, env, name, mergeFn) {
  var files = findConfigFiles(rootDir, env, name);
  if (files.length) {
    debug('found %s %s files', env, name);
    files.forEach(function(f) { debug('  %s', f); });
  }
  var configs = loadConfigFiles(files);
  var merged = mergeConfigurations(configs, mergeFn);

  debug('merged %s %s configuration %j', env, name, merged);

  return merged;
}

/**
 * Search `appRootDir` for all files containing configuration for `name`.
 * @param {String} appRootDir
 * @param {String} env Environment, usually `process.env.NODE_ENV`
 * @param {String} name
 * @returns {Array.<String>} Array of absolute file paths.
 */
function findConfigFiles(appRootDir, env, name) {
  var master = ifExists(name + '.json');
  if (!master && (ifExistsWithAnyExt(name + '.local') ||
    ifExistsWithAnyExt(name + '.' + env))) {
    console.warn('WARNING: Main config file "' + name + '.json" is missing');
  }
  if (!master) return [];

  var candidates = [
    master,
    ifExistsWithAnyExt(name + '.local'),
    ifExistsWithAnyExt(name + '.' + env),
  ];

  return candidates.filter(function(c) { return c !== undefined; });

  function ifExists(fileName) {
    var filepath = path.resolve(appRootDir, fileName);
    return fs.existsSync(filepath) ? filepath : undefined;
  }

  function ifExistsWithAnyExt(fileName) {
    return ifExists(fileName + '.js') || ifExists(fileName + '.json');
  }
}

/**
 * Load configuration files into an array of objects.
 * Attach non-enumerable `_filename` property to each object.
 * @param {Array.<String>} files
 * @returns {Array.<Object>}
 */
function loadConfigFiles(files) {
  return files.map(function(f) {
    var config = cloneDeep(require(f));
    Object.defineProperty(config, '_filename', {
      enumerable: false,
      value: f,
    });
    debug('loaded config file %s: %j', f, config);
    return config;
  });
}

/**
 * Merge multiple configuration objects into a single one.
 * @param {Array.<Object>} configObjects
 * @param {function(target:Object, config:Object, filename:String)} mergeFn
 */
function mergeConfigurations(configObjects, mergeFn) {
  var result = configObjects.shift() || {};
  while (configObjects.length) {
    var next = configObjects.shift();
    mergeFn(result, next, next._filename);
  }
  return result;
}

function mergeDataSourceConfig(target, config, fileName) {
  var err = mergeObjects(target, config);
  if (err) {
    throw new Error('Cannot apply ' + fileName + ': ' + err);
  }
}

function mergeModelConfig(target, config, fileName) {
  var err = mergeObjects(target, config);
  if (err) {
    throw new Error('Cannot apply ' + fileName + ': ' + err);
  }
}

function mergeAppConfig(target, config, fileName) {
  var err = mergeObjects(target, config);
  if (err) {
    throw new Error('Cannot apply ' + fileName + ': ' + err);
  }
}

function mergeMiddlewareConfig(target, config, fileName) {
  var err = undefined; // see https://github.com/eslint/eslint/issues/5744
  for (var phase in config) {
    if (phase in target) {
      err = mergePhaseConfig(target[phase], config[phase], phase);
    } else {
      err = 'The phase "' + phase + '" is not defined in the main config.';
    }
    if (err)
      throw new Error('Cannot apply ' + fileName + ': ' + err);
  }
}

function mergeNamedItems(arr1, arr2, key) {
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
          mergeObjects(result[j], item);
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
}

function mergePhaseConfig(target, config, phase) {
  var err = undefined; // see https://github.com/eslint/eslint/issues/5744
  for (var mw in config) {
    if (mw in target) {
      var targetMiddleware = target[mw];
      var configMiddleware = config[mw];
      if (Array.isArray(targetMiddleware) && Array.isArray(configMiddleware)) {
        // Both are arrays, combine them
        target[mw] = mergeNamedItems(targetMiddleware, configMiddleware);
      } else if (Array.isArray(targetMiddleware)) {
        if (typeof configMiddleware === 'object' &&
          Object.keys(configMiddleware).length) {
          // Config side is an non-empty object
          target[mw] = mergeNamedItems(targetMiddleware, [configMiddleware]);
        }
      } else if (Array.isArray(configMiddleware)) {
        if (typeof targetMiddleware === 'object' &&
          Object.keys(targetMiddleware).length) {
          // Target side is an non-empty object
          target[mw] = mergeNamedItems([targetMiddleware], configMiddleware);
        } else {
          // Target side is empty
          target[mw] = configMiddleware;
        }
      } else {
        err = mergeObjects(targetMiddleware, configMiddleware);
      }
    } else {
      err = 'The middleware "' + mw + '" in phase "' + phase + '"' +
        'is not defined in the main config.';
    }
    if (err) return err;
  }
}

function mergeComponentConfig(target, config, fileName) {
  var err = mergeObjects(target, config);
  if (err) {
    throw new Error('Cannot apply ' + fileName + ': ' + err);
  }
}

function mergeObjects(target, config, keyPrefix) {
  for (var key in config) {
    var fullKey = keyPrefix ? keyPrefix + '.' + key : key;
    var err = mergeSingleItemOrProperty(target, config, key, fullKey);
    if (err) return err;
  }
  return null; // no error
}

function mergeSingleItemOrProperty(target, config, key, fullKey) {
  var origValue = target[key];
  var newValue = config[key];

  if (!hasCompatibleType(origValue, newValue)) {
    return 'Cannot merge values of incompatible types for the option `' +
      fullKey + '`.';
  }

  if (Array.isArray(origValue)) {
    return mergeArrays(origValue, newValue, fullKey);
  }

  if (newValue !== null && typeof origValue === 'object') {
    return mergeObjects(origValue, newValue, fullKey);
  }

  target[key] = newValue;
  return null; // no error
}

function mergeArrays(target, config, keyPrefix) {
  if (target.length !== config.length) {
    return 'Cannot merge array values of different length' +
      ' for the option `' + keyPrefix + '`.';
  }

  // Use for(;;) to iterate over undefined items, for(in) would skip them.
  for (var ix = 0; ix < target.length; ix++) {
    var fullKey = keyPrefix + '[' + ix + ']';
    var err = mergeSingleItemOrProperty(target, config, ix, fullKey);
    if (err) return err;
  }

  return null; // no error
}

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
