var assert = require('assert');
var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var ConfigLoader = require('./lib/config-loader');

/**
 * Initialize an application from an options object or
 * a set of JSON and JavaScript files.
 *
 * This function takes an optional argument that is either a string
 * or an object.
 *
 * If the argument is a string, then it sets the application root directory
 * based on the string value. Then it:
 *
 *  1. Creates DataSources from the `datasources.json` file in the application
 *   root directory.
 *
 *  2. Creates Models from the `models.json` file in the application
 *    root directory.
 *
 * If the argument is an object, then it looks for `model`, `dataSources`,
 * and `appRootDir` properties of the object.
 * If the object has no `appRootDir` property then it sets the current working
 * directory as the application root directory.
 * Then it:
 *
 * 1. Creates DataSources from the `options.dataSources` object.
 *
 * 2. Creates Models from the `options.models` object.
 *
 * In both cases, the function loads JavaScript files in the `/models` and
 * `/boot` subdirectories of the application root directory with `require()`.
 *
 *  **NOTE:** mixing `app.boot()` and `app.model(name, config)` in multiple
 *  files may result in models being **undefined** due to race conditions.
 *  To avoid this when using `app.boot()` make sure all models are passed
 *  as part of the `models` definition.
 *
 * Throws an error if the config object is not valid or if boot fails.
 *
 * <a name="model-definition"></a>
 * **Model Definitions**
 *
 * The following is example JSON for two `Model` definitions:
 * "dealership" and "location".
 *
 * ```js
 * {
 *   "dealership": {
 *     // a reference, by name, to a dataSource definition
 *     "dataSource": "my-db",
 *     // the options passed to Model.extend(name, properties, options)
 *     "options": {
 *       "relations": {
 *         "cars": {
 *           "type": "hasMany",
 *           "model": "Car",
 *           "foreignKey": "dealerId"
 *         }
 *       }
 *     },
 *     // the properties passed to Model.extend(name, properties, options)
 *     "properties": {
 *       "id": {"id": true},
 *       "name": "String",
 *       "zip": "Number",
 *       "address": "String"
 *     }
 *   },
 *   "car": {
 *     "dataSource": "my-db"
 *     "properties": {
 *       "id": {
 *         "type": "String",
 *         "required": true,
 *         "id": true
 *       },
 *       "make": {
 *         "type": "String",
 *         "required": true
 *       },
 *       "model": {
 *         "type": "String",
 *         "required": true
 *       }
 *     }
 *   }
 * }
 * ```
 *
 * @param app LoopBack application created by `loopback()`.
 * @options {String|Object} options Boot options; If String, this is
 * the application root directory; if object, has below properties.
 * @property {String} appRootDir Directory to use when loading JSON and
 * JavaScript files (optional).
 * Defaults to the current directory (`process.cwd()`).
 * @property {Object} models Object containing `Model` definitions (optional).
 * @property {Object} dataSources Object containing `DataSource`
 * definitions (optional).
 * @property {String} modelsRootDir Directory to use when loading `models.json`
 * and `models/*.js`. Defaults to `appRootDir`.
 * @property {String} datasourcesRootDir Directory to use when loading
 * `datasources.json`. Defaults to `appRootDir`.
 * @end
 *
 * @header boot(app, [options])
 */

exports = module.exports = function bootLoopBackApp(app, options) {
  /*jshint camelcase:false */
  options = options || {};

  if(typeof options === 'string') {
    options = { appRootDir: options };
  }
  var appRootDir = options.appRootDir = options.appRootDir || process.cwd();
  var env = app.get('env');

  var appConfig = options.app || ConfigLoader.loadAppConfig(appRootDir, env);

  var modelsRootDir = options.modelsRootDir || appRootDir;
  var modelConfig = options.models ||
    ConfigLoader.loadModels(modelsRootDir, env);

  var dsRootDir = options.dsRootDir || appRootDir;
  var dataSourceConfig = options.dataSources ||
    ConfigLoader.loadDataSources(dsRootDir, env);

  assertIsValidConfig('app', appConfig);
  assertIsValidConfig('model', modelConfig);
  assertIsValidConfig('data source', dataSourceConfig);

  appConfig.host =
    process.env.npm_config_host ||
    process.env.OPENSHIFT_SLS_IP ||
    process.env.OPENSHIFT_NODEJS_IP ||
    process.env.HOST ||
    appConfig.host ||
    process.env.npm_package_config_host ||
    app.get('host');

  appConfig.port = _.find([
    process.env.npm_config_port,
    process.env.OPENSHIFT_SLS_PORT,
    process.env.OPENSHIFT_NODEJS_PORT,
    process.env.PORT,
    appConfig.port,
    process.env.npm_package_config_port,
    app.get('port'),
    3000
  ], _.isFinite);

  appConfig.restApiRoot =
    appConfig.restApiRoot ||
    app.get('restApiRoot') ||
    '/api';

  if(appConfig.host !== undefined) {
    assert(typeof appConfig.host === 'string', 'app.host must be a string');
    app.set('host', appConfig.host);
  }

  if(appConfig.port !== undefined) {
    var portType = typeof appConfig.port;
    assert(portType === 'string' || portType === 'number',
      'app.port must be a string or number');
    app.set('port', appConfig.port);
  }

  assert(appConfig.restApiRoot !== undefined, 'app.restBasePath is required');
  assert(typeof appConfig.restApiRoot === 'string',
    'app.restBasePath must be a string');
  assert(/^\//.test(appConfig.restApiRoot),
    'app.restBasePath must start with "/"');
  app.set('restApiRoot', appConfig.restBasePath);

  for(var configKey in appConfig) {
    var cur = app.get(configKey);
    if(cur === undefined || cur === null) {
      app.set(configKey, appConfig[configKey]);
    }
  }

  // instantiate data sources
  forEachKeyedObject(dataSourceConfig, function(key, obj) {
    app.dataSource(key, obj);
  });

  // instantiate models
  forEachKeyedObject(modelConfig, function(key, obj) {
    app.model(key, obj);
  });

  // try to attach models to dataSources by type
  try {
    require('loopback').autoAttach();
  } catch(e) {
    if(e.name === 'AssertionError') {
      console.warn(e);
    } else {
      throw e;
    }
  }

  // disable token requirement for swagger, if available
  var swagger = app.remotes().exports.swagger;
  var requireTokenForSwagger = appConfig.swagger &&
    appConfig.swagger.requireToken;
  if(swagger) {
    swagger.requireToken = requireTokenForSwagger || false;
  }

  // require directories
  requireDir(path.join(modelsRootDir, 'models'));
  requireDir(path.join(appRootDir, 'boot'));
};

function assertIsValidConfig(name, config) {
  if(config) {
    assert(typeof config === 'object',
        name + ' config must be a valid JSON object');
  }
}

function forEachKeyedObject(obj, fn) {
  if(typeof obj !== 'object') return;

  Object.keys(obj).forEach(function(key) {
    fn(key, obj[key]);
  });
}

function requireDir(dir, basenames) {
  assert(dir, 'cannot require directory contents without directory name');

  var requires = {};

  if (arguments.length === 2) {
    // if basenames argument is passed, explicitly include those files
    basenames.forEach(function (basename) {
      var filepath = path.resolve(path.join(dir, basename));
      requires[basename] = tryRequire(filepath);
    });
  } else if (arguments.length === 1) {
    // if basenames arguments isn't passed, require all javascript
    // files (except for those prefixed with _) and all directories

    var files = tryReadDir(dir);

    // sort files in lowercase alpha for linux
    files.sort(function (a,b) {
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

    files.forEach(function (filename) {
      // ignore index.js and files prefixed with underscore
      if ((filename === 'index.js') || (filename[0] === '_')) { return; }

      var filepath = path.resolve(path.join(dir, filename));
      var ext = path.extname(filename);
      var stats = fs.statSync(filepath);

      // only require files supported by require.extensions (.txt .md etc.)
      if (stats.isFile() && !(ext in require.extensions)) { return; }

      var basename = path.basename(filename, ext);

      requires[basename] = tryRequire(filepath);
    });

  }

  return requires;
}

function tryRequire(modulePath) {
  try {
    return require.apply(this, arguments);
  } catch(e) {
    console.error('failed to require "%s"', modulePath);
    throw e;
  }
}

function tryReadDir() {
  try {
    return fs.readdirSync.apply(fs, arguments);
  } catch(e) {
    return [];
  }
}

exports.ConfigLoader = ConfigLoader;
