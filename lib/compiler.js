var assert = require('assert');
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
  assertIsValidModelConfig(modelsConfig);

  var dsRootDir = options.dsRootDir || appRootDir;
  var dataSourcesConfig = options.dataSources ||
    ConfigLoader.loadDataSources(dsRootDir, env);
  assertIsValidConfig('data source', dataSourcesConfig);

  // require directories
  var bootScripts = findScripts(path.join(appRootDir, 'boot'));

  return {
    app: appConfig,
    dataSources: dataSourcesConfig,
    models: modelsConfig,
    files: {
      boot: bootScripts
    }
  };
};

function assertIsValidConfig(name, config) {
  if(config) {
    assert(typeof config === 'object',
        name + ' config must be a valid JSON object');
  }
}

function assertIsValidModelConfig(config) {
  assertIsValidConfig('model', config);
  for (var name in config) {
    var entry = config[name];
    var options = entry.options || {};
    var unsupported = entry.properties ||
      entry.base || options.base ||
      entry.plural || options.plural;

    if (unsupported) {
      throw new Error(
        'The data in models.json is in the unsupported 1.x format.');
    }
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
