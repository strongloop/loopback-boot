var assert = require('assert');
var cloneDeep = require('lodash.clonedeep');
var fs = require('fs');
var path = require('path');
var ConfigLoader = require('./config-loader');
var debug = require('debug')('loopback:boot:compiler');

/**
 * Gather all bootstrap-related configuration data and compile it into
 * a single object containing instruction for `boot.execute`.
 *
 * @options {String|Object} options Boot options; If String, this is
 * the application root directory; if object, has the properties
 * described in `bootLoopBackApp` options above.
 * @return {Object}
 *
 * @header boot.compile(options)
 */

module.exports = function compile(options) {
  options = options || {};

  if(typeof options === 'string') {
    options = { appRootDir: options };
  }

  var appRootDir = options.appRootDir = options.appRootDir || process.cwd();
  var env = options.env || process.env.NODE_ENV || 'development';

  var appConfig = options.app || ConfigLoader.loadAppConfig(appRootDir, env);
  assertIsValidConfig('app', appConfig);

  var modelsRootDir = options.modelsRootDir || appRootDir;
  var modelsConfig = options.models ||
    ConfigLoader.loadModels(modelsRootDir, env);
  assertIsValidConfig('model', modelsConfig);

  var dsRootDir = options.dsRootDir || appRootDir;
  var dataSourcesConfig = options.dataSources ||
    ConfigLoader.loadDataSources(dsRootDir, env);
  assertIsValidConfig('data source', dataSourcesConfig);

  // require directories
  var modelsScripts = findScripts(path.join(modelsRootDir, 'models'));
  var bootScripts = findScripts(path.join(appRootDir, 'boot'));

  // When executor passes the instruction to loopback methods,
  // loopback modifies the data. Since we are loading the data using `require`,
  // such change affects also code that calls `require` for the same file.
  return cloneDeep({
    app: appConfig,
    dataSources: dataSourcesConfig,
    models: modelsConfig,
    files: {
      models: modelsScripts,
      boot: bootScripts
    }
  });
};

function assertIsValidConfig(name, config) {
  if(config) {
    assert(typeof config === 'object',
        name + ' config must be a valid JSON object');
  }
}

/**
 * Find all javascript files (except for those prefixed with _)
 * and all directories.
 * @param {String} dir Full path of the directory to enumerate.
 * @return {Array.<String>} A list of absolute paths to pass to `require()`.
 * @private
 */

function findScripts(dir) {
  assert(dir, 'cannot require directory contents without directory name');

  var files = tryReadDir(dir);

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
    if ((filename === 'index.js') || (filename[0] === '_')) {
      return;
    }

    var filepath = path.resolve(path.join(dir, filename));
    var ext = path.extname(filename);
    var stats = fs.statSync(filepath);

    // only require files supported by require.extensions (.txt .md etc.)
    if (stats.isFile()) {
      if (ext in require.extensions)
        results.push(filepath);
      else
        debug('Skipping file %s - unknown extension', filepath);
    } else {
      try {
        path.join(require.resolve(filepath));
      } catch(err) {
        debug('Skipping directory %s - %s', filepath, err.code || err);
      }
    }
  });

  return results;
}

function tryReadDir() {
  try {
    return fs.readdirSync.apply(fs, arguments);
  } catch(e) {
    return [];
  }
}
