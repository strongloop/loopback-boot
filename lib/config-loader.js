var fs = require('fs');
var path = require('path');
var debug = require('debug')('loopback:boot:config-loader');

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
  /*jshint unused:false */
  return tryReadJsonConfig(rootDir, 'model-config') || {};
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
  if (!master) return [];

  var candidates = [
    master,
    ifExistsWithAnyExt(name + '.local'),
    ifExistsWithAnyExt(name + '.' + env)
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
    var config = require(f);
    Object.defineProperty(config, '_filename', {
      enumerable: false,
      value: f
    });
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
  for (var ds in target) {
    var err = mergeObjects(target[ds], config[ds]);
    if (err) {
      throw new Error('Cannot apply ' + fileName + ' to `'  + ds + '`: ' + err);
    }
  }
}

function mergeAppConfig(target, config, fileName) {
  var err = mergeObjects(target, config);
  if (err) {
    throw new Error('Cannot apply ' + fileName + ': ' + err);
  }
}

function mergeMiddlewareConfig(target, config, fileName) {
  var err;
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

function mergePhaseConfig(target, config, phase) {
  var err;
  for (var middleware in config) {
    if (middleware in target) {
      err = mergeObjects(target[middleware], config[middleware]);
    } else {
      err = 'The middleware "' + middleware + '" in phase "' + phase + '"' +
        'is not defined in the main config.';
    }
    if (err) return err;
  }
}

function mergeComponentConfig(target, config, fileName) {
  for (var c in target) {
    var err = mergeObjects(target[c], config[c]);
    if (err) {
      throw new Error('Cannot apply ' + fileName + ' to `'  + c + '`: ' + err);
    }
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

  if (typeof origValue === 'object') {
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

/**
 * Try to read a config file with .json extension
 * @param {string} cwd Dirname of the file
 * @param {string} fileName Name of the file without extension
 * @returns {Object|undefined} Content of the file, undefined if not found.
 */
function tryReadJsonConfig(cwd, fileName) {
  try {
    return require(path.join(cwd, fileName + '.json'));
  } catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') {
      throw e;
    }
  }
}
