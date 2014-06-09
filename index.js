var ConfigLoader = require('./lib/config-loader');
var compile = require('./lib/compiler');
var execute = require('./lib/executor');
var addInstructionsToBrowserify = require('./lib/bundler');

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
 *  2. Configures Models from the `models.json` file in the application
 *    root directory.
 *
 * If the argument is an object, then it looks for `models`, `dataSources`,
 * and `appRootDir` properties of the object.
 * If the object has no `appRootDir` property then it sets the current working
 * directory as the application root directory.
 * Then it:
 *
 * 1. Creates DataSources from the `options.dataSources` object.
 *
 * 2. Configures Models from the `options.models` object.
 *
 * In both cases, the function loads JavaScript files in the
 * `/boot` subdirectory of the application root directory with `require()`.
 *
 *  **NOTE:** The version 2.0 of loopback-boot changed the way how models
 *  are created. loopback-boot no longer creates the models for you,
 *  the `models.json` file contains only configuration options like
 *  dataSource and extra relations.
 *
 *  **NOTE:** mixing `app.boot()` and `app.model(name, config)` in multiple
 *  files may result in models being **undefined** due to race conditions.
 *  To avoid this when using `app.boot()` make sure all models are passed
 *  as part of the `models` configuration.
 *
 *
 * Throws an error if the config object is not valid or if boot fails.
 *
 * @param app LoopBack application created by `loopback()`.
 * @options {String|Object} options Boot options; If String, this is
 * the application root directory; if object, has below properties.
 * @property {String} [appRootDir] Directory to use when loading JSON and
 * JavaScript files.
 * Defaults to the current directory (`process.cwd()`).
 * @property {Object} [models] Object containing `Model` configurations.
 * @property {Object} [dataSources] Object containing `DataSource` definitions.
 * @property {String} [modelsRootDir] Directory to use when loading
 * `models.json`. Defaults to `appRootDir`.
 * @property {String} [dsRootDir] Directory to use when loading
 * `datasources.json`. Defaults to `appRootDir`.
 * @property {String} [env] Environment type, defaults to `process.env.NODE_ENV`
 * or `development`. Common values are `development`, `staging` and
 * `production`; however the applications are free to use any names.
 * @end
 *
 * @header bootLoopBackApp(app, [options])
 */

exports = module.exports = function bootLoopBackApp(app, options) {
  // backwards compatibility with loopback's app.boot
  options.env = options.env || app.get('env');

  var instructions = compile(options);
  execute(app, instructions);
};

/**
 * Compile boot instructions and add them to a browserify bundler.
 * @param {Object|String} options as described in `bootLoopBackApp` above.
 * @param {Object} bundler A browserify bundler created by `browserify()`.
 *
 * @header boot.compileToBrowserify(options, bundler)
 */
exports.compileToBrowserify = function(options, bundler) {
  addInstructionsToBrowserify(compile(options), bundler);
};

//-- undocumented low-level API --//

exports.ConfigLoader = ConfigLoader;
exports.compile = compile;
exports.execute = execute;
exports.addInstructionsToBrowserify = addInstructionsToBrowserify;
