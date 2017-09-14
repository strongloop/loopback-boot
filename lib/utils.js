// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var debug = require('debug')('loopback:boot');
var path = require('path');
var Module = require('module');
var fs = require('fs');
var assert = require('assert');
var _ = require('lodash');
var g = require('./globalize');

exports.arrayToObject = arrayToObject;
exports.tryReadDir = tryReadDir;
exports.resolveRelativePaths = resolveRelativePaths;
exports.assertIsValidConfig = assertIsValidConfig;
exports.fileExistsSync = fileExistsSync;
exports.fixFileExtension = fixFileExtension;
exports.findScripts = findScripts;
exports.resolveAppScriptPath = resolveAppScriptPath;
exports.getExcludedExtensions = getExcludedExtensions;
exports.tryResolveAppPath = tryResolveAppPath;
exports.forEachKeyedObject = forEachKeyedObject;
exports.mergePhaseNameLists = mergePhaseNameLists;

var FILE_EXTENSION_JSON = exports.FILE_EXTENSION_JSON = '.json';
/**
 * Find all javascript files (except for those prefixed with _)
 * and all directories.
 * @param {String} dir Full path of the directory to enumerate.
 * @return {Array.<String>} A list of absolute paths to pass to `require()`.
 */

function findScripts(dir, scriptExtensions) {
  assert(dir, 'cannot require directory contents without directory name');

  var files = tryReadDir(dir);
  scriptExtensions = scriptExtensions || require.extensions;

  // sort files in lowercase alpha for linux
  files.sort(function(a, b) {
    a = a.toLowerCase();
    b = b.toLowerCase();

    if (a < b) {
      return -1;
    } else if (b < a) {
      return 1;
    } else {
      return 0;
    }
  });

  var results = [];
  files.forEach(function(filename) {
    // ignore index.js and files prefixed with underscore
    if (filename === 'index.js' || filename[0] === '_') {
      return;
    }

    var filepath = path.resolve(path.join(dir, filename));
    var stats = fs.statSync(filepath);

    // only require files supported by specified extensions
    if (stats.isFile()) {
      if (scriptExtensions && isPreferredExtension(filename, scriptExtensions))
        results.push(filepath);
      else
        debug('Skipping file %s - unknown extension', filepath);
    } else {
      debug('Skipping directory %s', filepath);
    }
  });

  return results;
}

function tryReadDir() {
  try {
    return fs.readdirSync.apply(fs, arguments);
  } catch (e) {
    return [];
  }
}

function resolveRelativePaths(relativePaths, appRootDir) {
  var resolveOpts = {strict: false};
  relativePaths.forEach(function(relativePath, k) {
    var resolvedPath = tryResolveAppPath(appRootDir, relativePath, resolveOpts);
    if (resolvedPath !== undefined) {
      relativePaths[k] = resolvedPath;
    } else {
      debug('skipping boot script %s - unknown file', relativePath);
    }
  });
}

function getExcludedExtensions() {
  return {
    '.json': '.json',
    '.node': 'node',
   /**
     * This is a temporary workaround for #246
     * See discussion here for full description of the underlying issue
     * https://github.com/strongloop/loopback-boot/pull/245#issuecomment-311052798
     */
    '.map': 'map',
  };
}

function arrayToObject(array) {
  return array.reduce(function(obj, val) {
    obj[val] = val;
    return obj;
  }, {});
}

function isPreferredExtension(filename, includeExtensions) {
  assert(!!includeExtensions, '"includeExtensions" argument is required');

  var ext = path.extname(filename);
  return (ext in includeExtensions) && !(ext in getExcludedExtensions());
}

function fixFileExtension(filepath, files, scriptExtensions) {
  var results = [];
  var otherFile;

  /* Prefer coffee scripts over json */
  if (scriptExtensions && isPreferredExtension(filepath, scriptExtensions)) {
    return filepath;
  }

  var basename = path.basename(filepath, FILE_EXTENSION_JSON);
  var sourceDir = path.dirname(filepath);

  files.forEach(function(f) {
    otherFile = path.resolve(sourceDir, f);

    var stats = fs.statSync(otherFile);
    if (stats.isFile()) {
      var otherFileExtension = path.extname(f);

      if (!(otherFileExtension in getExcludedExtensions()) &&
        path.basename(f, otherFileExtension) == basename) {
        if (!scriptExtensions || otherFileExtension in scriptExtensions) {
          results.push(otherFile);
        }
      }
    }
  });
  return results.length > 0 ? results[0] : undefined;
}

function resolveAppPath(rootDir, relativePath, resolveOptions) {
  var resolvedPath = tryResolveAppPath(rootDir, relativePath, resolveOptions);
  if (resolvedPath === undefined && !resolveOptions.optional) {
    var err = new Error(g.f('Cannot resolve path "%s"', relativePath));
    err.code = 'PATH_NOT_FOUND';
    throw err;
  }
  return resolvedPath;
}

function resolveAppScriptPath(rootDir, relativePath, resolveOptions) {
  var resolvedPath = resolveAppPath(rootDir, relativePath, resolveOptions);
  if (!resolvedPath) {
    return false;
  }
  var sourceDir = path.dirname(resolvedPath);
  var files = tryReadDir(sourceDir);
  var fixedFile = fixFileExtension(resolvedPath, files);
  return (fixedFile === undefined ? resolvedPath : fixedFile);
}

function tryResolveAppPath(rootDir, relativePath, resolveOptions) {
  var fullPath;
  var start = relativePath.substring(0, 2);

  /* In order to retain backward compatibility, we need to support
   * two ways how to treat values that are not relative nor absolute
   * path (e.g. `relativePath = 'foobar'`)
   *  - `resolveOptions.strict = true` searches in `node_modules` only
   *  - `resolveOptions.strict = false` attempts to resolve the value
   *     as a relative path first before searching `node_modules`
   */
  resolveOptions = resolveOptions || {strict: true};

  var isModuleRelative = false;
  if (relativePath[0] === '/') {
    fullPath = relativePath;
  } else if (start === './' || start === '..') {
    fullPath = path.resolve(rootDir, relativePath);
  } else if (!resolveOptions.strict) {
    isModuleRelative = true;
    fullPath = path.resolve(rootDir, relativePath);
  }

  if (fullPath) {
    // This check is needed to support paths pointing to a directory
    if (fileExistsSync(fullPath)) {
      return fullPath;
    }

    try {
      fullPath = require.resolve(fullPath);
      return fullPath;
    } catch (err) {
      if (!isModuleRelative) {
        debug('Skipping %s - %s', fullPath, err);
        return undefined;
      }
    }
  }

  // Handle module-relative path, e.g. `loopback/common/models`

  // Module.globalPaths is a list of globally configured paths like
  //   [ env.NODE_PATH values, $HOME/.node_modules, etc. ]
  // Module._nodeModulePaths(rootDir) returns a list of paths like
  //   [ rootDir/node_modules, rootDir/../node_modules, etc. ]
  var modulePaths = Module.globalPaths
    .concat(Module._nodeModulePaths(rootDir));

  fullPath = modulePaths
    .map(function(candidateDir) {
      var absPath = path.join(candidateDir, relativePath);
      try {
        // NOTE(bajtos) We need to create a proper String object here,
        // otherwise we can't attach additional properties to it
        /* jshint -W053 */
        var filePath = new String(require.resolve(absPath));
        filePath.unresolvedPath = absPath;
        return filePath;
      } catch (err) {
        return absPath;
      }
    })
    .filter(function(candidate) {
      return fileExistsSync(candidate.toString());
    })
    [0];

  if (fullPath) {
    if (fullPath.unresolvedPath && resolveOptions.fullResolve === false)
      return fullPath.unresolvedPath;
    // Convert String object back to plain string primitive
    return fullPath.toString();
  }

  debug('Skipping %s - module not found', fullPath);
  return undefined;
}

function assertIsValidConfig(name, config) {
  if (config) {
    assert(typeof config === 'object',
      name + ' config must be a valid JSON object');
  }
}

function forEachKeyedObject(obj, fn) {
  if (typeof obj !== 'object') return;

  Object.keys(obj).forEach(function(key) {
    fn(key, obj[key]);
  });
}

/**
 * Extend the list of builtin phases by merging in an array of phases
 * requested by a user while preserving the relative order of phases
 * as specified by both arrays.
 *
 * If the first new name does not match any existing phase, it is inserted
 * as the first phase in the new list. The same applies for the second phase,
 * and so on, until an existing phase is found.
 *
 * Any new names in the middle of the array are inserted immediatelly after
 * the last common phase. For example, extending
 * `["initial", "session", "auth"]` with `["initial", "preauth", "auth"]`
 * results in `["initial", "preauth", "session", "auth"]`.
 *
 *
 * **Example**
 *
 * ```js
 * var result = mergePhaseNameLists(
 *   ['initial', 'session', 'auth', 'routes', 'files', 'final'],
 *   ['initial', 'postinit', 'preauth', 'auth',
 *     'routes', 'subapps', 'final', 'last']
 * );
 *
 * // result: [
 * //   'initial', 'postinit', 'preauth', 'session', 'auth',
 * //   'routes', 'subapps', 'files', 'final', 'last'
 * // ]
 * ```
 *
 * @param {Array} currentNames The current list of phase names.
 * @param {Array} namesToMerge The items to add (zip merge) into the target
 *   array.
 * @returns {Array} A new array containing combined items from both arrays.
 *
 * @header mergePhaseNameLists
 */
function mergePhaseNameLists(currentNames, namesToMerge) {
  if (!namesToMerge.length) return currentNames.slice();

  var targetArray = currentNames.slice();
  var targetIx = targetArray.indexOf(namesToMerge[0]);

  if (targetIx === -1) {
    // the first new item does not match any existing one
    // start adding the new items at the start of the list
    targetArray.splice(0, 0, namesToMerge[0]);
    targetIx = 0;
  }

  // merge (zip) two arrays
  for (var sourceIx = 1; sourceIx < namesToMerge.length; sourceIx++) {
    var valueToAdd = namesToMerge[sourceIx];
    var previousValue = namesToMerge[sourceIx - 1];
    var existingIx = targetArray.indexOf(valueToAdd, targetIx);

    if (existingIx === -1) {
      // A new phase - try to add it after the last one,
      // unless it was already registered
      if (targetArray.indexOf(valueToAdd) !== -1) {
        var errMsg = g.f('Ordering conflict: cannot add "%s' +
          '" after "%s", because the opposite order was ' +
          ' already specified', valueToAdd, previousValue);
        throw new Error(errMsg);
      }
      var previousIx = targetArray.indexOf(previousValue);
      targetArray.splice(previousIx + 1, 0, valueToAdd);
    } else {
      // An existing phase - move the pointer
      targetIx = existingIx;
    }
  }

  return targetArray;
}

/**
 * Check synchronously if a filepath points to an existing file.
 * Replaces calls to fs.existsSync, which is deprecated (see:
 * https://github.com/nodejs/node/pull/166).
 *
 * @param   {String} filepath The absolute path to check
 * @returns {Boolean}  True if the file exists
 */
function fileExistsSync(filepath) {
  try {
    fs.statSync(filepath);
    return true;
  } catch (e) {
    return false;
  }
}
