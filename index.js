// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

// Strong globalize
var SG = require('strong-globalize');
SG.SetRootDir(__dirname);

var ConfigLoader = require('./lib/config-loader');
var compile = require('./lib/compiler');
var execute = require('./lib/executor');
var addInstructionsToBrowserify = require('./lib/bundler');
var utils = require('./lib/utils');

/**
 * Initialize an application from an options object or
 * a set of JSON and JavaScript files.
 *
 * > **NOTE**: This module is primarily intended for use with LoopBack 2.0.
 * It _does_ work with LoopBack 1.x applications, but
 * none of the LoopBack 1.x examples or generated code (scaffolding) use it.
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
 *  2. Configures Models from the `model-config.json` file in the application
 *    root directory.
 *
 *  3. Configures the LoopBack Application object from the `config.json` file
 *     in the application root directory. These properties can be accessed
 *     using `app.get('propname')`.
 *
 * If the argument is an object, then it looks for `models`, `dataSources`,
 * 'config', `modelsRootDir`, `dsRootDir`, `appConfigRootDir` and `appRootDir`
 * properties of the object.
 *
 * If the object has no `appRootDir` property then it sets the current working
 * directory as the application root directory.
 *
 * The execution environment, {env}, is established from, in order,
 *  - `options.env`
 *  - `process.env.NODE_ENV`,
 *  - the literal `development`.
 *
 * Then it:
 *
 *  1. Creates DataSources from the `options.dataSources` object, if provided;
 *    otherwise, it searches for the files
 *     - `datasources.json`,
 *     - `datasources.local.js` or `datasources.local.json` (only one),
 *     - `datasources.{env}.js` or `datasources.{env}.json` (only one)
 *
 *    in the directory designated by 'options.dsRootDir', if present, or the
 *    application root directory. It merges the data source definitions from
 *    the files found.
 *
 *  2. Creates Models from the `options.models` object, if provided;
 *    otherwise, it searches for the files
 *     - `model-config.json`,
 *     - `model-config.local.js` or `model-config.local.json` (only one),
 *     - `model-config.{env}.js` or `model-config.{env}.json` (only one)
 *
 *    in the directory designated by 'options.modelsRootDir', if present, or
 *    the application root directory. It merges the model definitions from the
 *    files found.
 *
 *  3. Configures the Application object from the `options.config` object,
 *    if provided;
 *    otherwise, it searches for the files
 *     - `config.json`,
 *     - `config.local.js` or `config.local.json` (only one),
 *     - `config.{env}.js` or `config.{env}.json` (only one)
 *
 *    in the directory designated by 'options.appConfigRootDir', if present, or
 *    the application root directory. It merges the properties from the files
 *    found.
 *
 * In both cases, the function loads JavaScript files in the
 * `/boot` subdirectory of the application root directory with `require()`.
 *
 *  **NOTE:** The version 2.0 of loopback-boot changed the way how models
 *  are created. The `model-config.json` file contains only configuration
 *  options like dataSource and extra relations. To define a model,
 *  create a per-model JSON file in `models/` directory.
 *
 *  **NOTE:** Mixing `bootLoopBackApp(app, bootConfig)` and
 *  `app.model(name, modelConfig)` in multiple
 *  files may result in models being undefined due to race conditions.
 *  To avoid this when using `bootLoopBackApp()` make sure all models are passed
 *  as part of the `models` definition.
 *
 * Throws an error if the config object is not valid or if boot fails.
 *
 * @param app LoopBack application created by `loopback()`.
 * @options {String|Object} options Boot options; If String, this is
 * the application root directory; if object, has below properties.
 * @property {String} [appRootDir] Directory to use when loading JSON and
 * JavaScript files.
 * Defaults to the current directory (`process.cwd()`).
 * @property {String} [appConfigRootDir] Directory to use when loading
 * `config.json`. Defaults to `appRootDir`.
 * @property {Object} [models] Object containing `Model` configurations.
 * @property {Array} [modelDefinitions] List of model definitions to use.
 *   When `options.modelDefinitions` is provided, loopback-boot does not
 *   search filesystem and use only the models provided in this argument.
 * @property {Object} [dataSources] Object containing `DataSource` definitions.
 * @property {String} [modelsRootDir] Directory to use when loading
 * `model-config.json`. Defaults to `appRootDir`.
 * @property {String} [dsRootDir] Directory to use when loading
 * `datasources.json`. Defaults to `appRootDir`.
 * @property {String} [middlewareRootDir] Directory to use when loading
 * `middleware.json`. Defaults to `appRootDir`.
 * @property {String} [componentRootDir] Directory to use when loading
 * `component-config.json`. Defaults to `appRootDir`.
 * @property {String} [env] Environment type, defaults to `process.env.NODE_ENV`
 * or `development`. Common values are `development`, `staging` and
 * `production`; however the applications are free to use any names.
 * @property {Array.<String>} [modelSources] List of directories where to look
 * for files containing model definitions.
 * @property {Object} [middleware] Middleware configuration to use instead
 * of `{appRootDir}/middleware.json`
 * @property {Object} [components] Component configuration to use instead
 * of `{appRootDir}/component-config.json`
 * @property {Array.<String>} [mixinDirs] List of directories where to look
 * for files containing model mixin definitions. All files (mixins) found
 * in these directory are loaded.
 * @property {Array.<String>} [mixinSources] List of directories where to look
 * for files containing model mixin definitions. Only mixins used by
 * application models are loaded from these directories.
 * @property {Array.<String>} [bootDirs] List of directories where to look
 * for boot scripts.
 * @property {Array.<String>} [bootScripts] List of script files to execute
 * on boot.
 * @property {String|Function|Boolean} [normalization] Mixin normalization
 * format: false, 'none', 'classify', 'dasherize' - defaults to 'classify'.
 * @end
 * @param {Function} [callback] Callback function.
 *
 * @header boot(app, [options], [callback])
 */

exports = module.exports = function bootLoopBackApp(app, options, callback) {
  // backwards compatibility with loopback's app.boot
  options.env = options.env || app.get('env');

  var instructions = compile(options);
  execute(app, instructions, callback);
};

/**
 * Compile boot instructions and add them to a browserify bundler.
 * @param {Object|String} options as described in `bootLoopBackApp` above.
 * @property {String} [appId] Application identifier used to load the correct
 * boot configuration when building multiple applications using browserify.
 * @end
 * @param {Object} bundler A browserify bundler created by `browserify()`.
 *
 * @header boot.compileToBrowserify(options, bundler)
 */
exports.compileToBrowserify = function(options, bundler) {
  addInstructionsToBrowserify(compile(options), bundler);
};

/* -- undocumented low-level API -- */

exports.ConfigLoader = ConfigLoader;
exports.compile = compile;
exports.execute = execute;
exports.utils = utils;
exports.addInstructionsToBrowserify = addInstructionsToBrowserify;
