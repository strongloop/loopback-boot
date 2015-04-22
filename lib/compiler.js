var assert = require('assert');
var cloneDeep = require('lodash').cloneDeep;
var fs = require('fs');
var path = require('path');
var toposort = require('toposort');
var ConfigLoader = require('./config-loader');
var debug = require('debug')('loopback:boot:compiler');
var Module = require('module');
var _ = require('lodash');

var FILE_EXTENSION_JSON = '.json';

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

  if (typeof options === 'string') {
    options = { appRootDir: options };
  }

  var appRootDir = options.appRootDir = options.appRootDir || process.cwd();
  var env = options.env || process.env.NODE_ENV || 'development';

  var appConfigRootDir = options.appConfigRootDir || appRootDir;
  var appConfig = options.config ||
    ConfigLoader.loadAppConfig(appConfigRootDir, env);
  assertIsValidConfig('app', appConfig);

  var modelsRootDir = options.modelsRootDir || appRootDir;
  var modelsConfig = options.models ||
    ConfigLoader.loadModels(modelsRootDir, env);
  assertIsValidModelConfig(modelsConfig);

  var dsRootDir = options.dsRootDir || appRootDir;
  var dataSourcesConfig = options.dataSources ||
    ConfigLoader.loadDataSources(dsRootDir, env);
  assertIsValidConfig('data source', dataSourcesConfig);

  // not configurable yet
  var middlewareRootDir = appRootDir;

  var middlewareConfig = options.middleware ||
    ConfigLoader.loadMiddleware(middlewareRootDir, env);
  var middlewareInstructions =
    buildMiddlewareInstructions(middlewareRootDir, middlewareConfig);

  var componentRootDir = appRootDir; // not configurable yet
  var componentConfig = options.components ||
      ConfigLoader.loadComponents(componentRootDir, env);
  var componentInstructions =
    buildComponentInstructions(componentRootDir, componentConfig);

  // require directories
  var bootDirs = options.bootDirs || []; // precedence
  bootDirs = bootDirs.concat(path.join(appRootDir, 'boot'));
  resolveRelativePaths(bootDirs, appRootDir);

  var bootScripts = options.bootScripts || [];
  resolveRelativePaths(bootScripts, appRootDir);

  bootDirs.forEach(function(dir) {
    bootScripts = bootScripts.concat(findScripts(dir));
  });

  // de-dedup boot scripts -ERS
  // https://github.com/strongloop/loopback-boot/issues/64
  bootScripts = _.uniq(bootScripts);

  var modelsMeta = modelsConfig._meta || {};
  delete modelsConfig._meta;

  var modelSources = options.modelSources || modelsMeta.sources || ['./models'];
  var modelInstructions = buildAllModelInstructions(
    modelsRootDir, modelsConfig, modelSources);

  // When executor passes the instruction to loopback methods,
  // loopback modifies the data. Since we are loading the data using `require`,
  // such change affects also code that calls `require` for the same file.
  var instructions = {
    config: appConfig,
    dataSources: dataSourcesConfig,
    models: modelInstructions,
    middleware: middlewareInstructions,
    components: componentInstructions,
    files: {
      boot: bootScripts
    }
  };

  if (options.appId)
    instructions.appId = options.appId;

  return cloneDeep(instructions);
};

function assertIsValidConfig(name, config) {
  if (config) {
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
        'The data in model-config.json is in the unsupported 1.x format.');
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
    if (filename === 'index.js' || filename[0] === '_') {
      return;
    }

    var filepath = path.resolve(path.join(dir, filename));
    var stats = fs.statSync(filepath);

    // only require files supported by require.extensions (.txt .md etc.)
    if (stats.isFile()) {
      if (isPreferredExtension(filename))
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

function buildAllModelInstructions(rootDir, modelsConfig, sources) {
  var registry = findModelDefinitions(rootDir, sources);

  var modelNamesToBuild = addAllBaseModels(registry, Object.keys(modelsConfig));

  var instructions = modelNamesToBuild
    .map(function createModelInstructions(name) {
      var config = modelsConfig[name];
      var definition = registry[name] || {};

      debug('Using model "%s"\nConfiguration: %j\nDefinition %j',
        name, config, definition.definition);

      return {
        name: name,
        config: config,
        definition: definition.definition,
        sourceFile: definition.sourceFile
      };
    });

  return sortByInheritance(instructions);
}

function addAllBaseModels(registry, modelNames) {
  var result = [];
  var visited = {};

  while (modelNames.length) {
    var name = modelNames.shift();

    if (visited[name]) continue;
    visited[name] = true;
    result.push(name);

    var definition = registry[name] && registry[name].definition;
    if (!definition) continue;

    var base = getBaseModelName(definition);

    // ignore built-in models like User
    if (!registry[base]) continue;

    modelNames.push(base);
  }

  return result;
}

function getBaseModelName(modelDefinition) {
  if (!modelDefinition)
    return undefined;

  return modelDefinition.base ||
    modelDefinition.options && modelDefinition.options.base;
}

function sortByInheritance(instructions) {
  // create edges Base name -> Model name
  var edges = instructions
    .map(function(inst) {
      return [getBaseModelName(inst.definition), inst.name];
    });

  var sortedNames = toposort(edges);

  var instructionsByModelName = {};
  instructions.forEach(function(inst) {
    instructionsByModelName[inst.name] = inst;
  });

  return sortedNames
    // convert to instructions
    .map(function(name) {
      return instructionsByModelName[name];
    })
    // remove built-in models
    .filter(function(inst) {
      return !!inst;
    });
}

function findModelDefinitions(rootDir, sources) {
  var registry = {};

  sources.forEach(function(src) {
    var srcDir = tryResolveAppPath(rootDir, src, { strict: false });
    if (!srcDir) {
      debug('Skipping unknown module source dir %j', src);
      return;
    }

    var files = tryReadDir(srcDir);

    files
      .filter(function(f) {
        return f[0] !== '_' && path.extname(f) === '.json';
      })
      .forEach(function(f) {
        var fullPath = path.resolve(srcDir, f);
        var entry = loadModelDefinition(rootDir, fullPath, files);
        var modelName = entry.definition.name;
        if (!modelName) {
          debug('Skipping model definition without Model name: %s',
            path.relative(srcDir, fullPath));
          return;
        }
        registry[modelName] = entry;
      });
  });

  return registry;
}

function resolveAppPath(rootDir, relativePath, resolveOptions) {
  var resolvedPath = tryResolveAppPath(rootDir, relativePath, resolveOptions);
  if (resolvedPath === undefined) {
    var err = new Error('Cannot resolve path "' + relativePath + '"');
    err.code = 'PATH_NOT_FOUND';
    throw err;
  }
  return resolvedPath;
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
  resolveOptions = resolveOptions || { strict: true };

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
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }

    try {
      fullPath = require.resolve(fullPath);
      return fullPath;
    } catch (err) {
      if (!isModuleRelative) {
        debug ('Skipping %s - %s', fullPath, err);
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
      try {
        var filePath = path.join(candidateDir, relativePath);
        filePath = require.resolve(filePath);
        return filePath;
      } catch (err) {
        return filePath;
      }
    })
    .filter(function(candidate) {
      return fs.existsSync(candidate);
    })
    [0];

  if (fullPath)
    return fullPath;

  debug ('Skipping %s - module not found', fullPath);
  return undefined;
}

function loadModelDefinition(rootDir, jsonFile, allFiles) {
  var definition = require(jsonFile);
  var basename = path.basename(jsonFile, path.extname(jsonFile));
  definition.name = definition.name || _.capitalize(_.camelCase(basename));

  // find a matching file with a supported extension like `.js` or `.coffee`
  var sourceFile = fixFileExtension(jsonFile, allFiles, true);

  if (sourceFile === undefined) {
    debug('Model source code not found: %s', sourceFile);
  }

  debug('Found model "%s" - %s %s', definition.name,
    path.relative(rootDir, jsonFile),
    sourceFile ? path.relative(rootDir, sourceFile) : '(no source file)');

  return {
    definition: definition,
    sourceFile: sourceFile
  };
}

function buildMiddlewareInstructions(rootDir, config) {
  var phasesNames = Object.keys(config);
  var middlewareList = [];
  phasesNames.forEach(function(phase) {
    var phaseConfig = config[phase];
    Object.keys(phaseConfig).forEach(function(middleware) {
      var allConfigs = phaseConfig[middleware];
      if (!Array.isArray(allConfigs))
        allConfigs = [allConfigs];

      allConfigs.forEach(function(config) {
        var resolved = resolveMiddlewarePath(rootDir, middleware);

        var middlewareConfig = cloneDeep(config);
        middlewareConfig.phase = phase;

        if (middlewareConfig.params) {
          middlewareConfig.params = resolveMiddlewareParams(
            rootDir, middlewareConfig.params);
        }

        var item = {
          sourceFile: resolved.sourceFile,
          config: middlewareConfig
        };
        if (resolved.fragment) {
          item.fragment = resolved.fragment;
        }
        middlewareList.push(item);
      });
    });
  });

  var flattenedPhaseNames = phasesNames
    .map(function getBaseName(name) {
      return name.replace(/:[^:]+$/, '');
    })
    .filter(function differsFromPreviousItem(value, ix, source) {
      // Skip duplicate entries. That happens when
      // `name:before` and `name:after` are both translated to `name`
      return ix === 0 || value !== source[ix - 1];
    });

  return {
    phases: flattenedPhaseNames,
    middleware: middlewareList
  };
}

function resolveMiddlewarePath(rootDir, middleware) {
  var resolved = {};

  var segments = middleware.split('#');
  var pathName = segments[0];
  var fragment = segments[1];
  var middlewarePath = pathName;
  var opts = { strict: true };

  if (fragment) {
    resolved.fragment = fragment;
  }

  if (pathName.indexOf('./') === 0 || pathName.indexOf('../') === 0) {
    // Relative path
    pathName = path.resolve(rootDir, pathName);
  }

  if (!fragment) {
    resolved.sourceFile = resolveAppScriptPath(rootDir, middlewarePath, opts);
    return resolved;
  }

  var err;

  // Try to require the module and check if <module>.<fragment> is a valid
  // function
  var m = require(pathName);
  if (typeof m[fragment] === 'function') {
    resolved.sourceFile = resolveAppScriptPath(rootDir, middlewarePath, opts);
    return resolved;
  }

  /*
   * module/server/middleware/fragment
   * module/middleware/fragment
   */
  var candidates = [
    pathName + '/server/middleware/' + fragment,
    pathName + '/middleware/' + fragment,
    // TODO: [rfeng] Should we support the following flavors?
    // pathName + '/lib/' + fragment,
    // pathName + '/' + fragment
  ];

  for (var ix in candidates) {
    try {
      resolved.sourceFile = resolveAppScriptPath(rootDir, candidates[ix], opts);
      delete resolved.fragment;
      return resolved;
    }
    catch (e) {
      // Report the error for the first candidate when no candidate matches
      if (!err) err = e;
    }
  }
  throw err;
}

// Match values starting with `$!./` or `$!../`
var MIDDLEWARE_PATH_PARAM_REGEX = /^\$!(\.\/|\.\.\/)/;

function resolveMiddlewareParams(rootDir, params) {
  return cloneDeep(params, function resolvePathParam(value) {
    if (typeof value === 'string' && MIDDLEWARE_PATH_PARAM_REGEX.test(value)) {
      return path.resolve(rootDir, value.slice(2));
    } else {
      return undefined; // no change
    }
  });
}

function buildComponentInstructions(rootDir, componentConfig) {
  return Object.keys(componentConfig)
    .filter(function(name) { return !!componentConfig[name]; })
    .map(function(name) {
      return {
        sourceFile: resolveAppScriptPath(rootDir, name, { strict: true }),
        config: componentConfig[name]
      };
    });
}

function resolveRelativePaths(relativePaths, appRootDir) {
  var resolveOpts = { strict: false };
  relativePaths.forEach(function(relativePath, k) {
    var resolvedPath = tryResolveAppPath(appRootDir, relativePath, resolveOpts);
    if (resolvedPath !== undefined) {
      relativePaths[k] = resolvedPath;
    } else {
      debug ('skipping boot script %s - unknown file', relativePath);
    }
  });
}

function getExcludedExtensions() {
  return {
    '.json': '.json',
    '.node': 'node'
  };
}

function isPreferredExtension (filename) {
  var includeExtensions = require.extensions;

  var ext = path.extname(filename);
  return (ext in includeExtensions) && !(ext in getExcludedExtensions());
}

function fixFileExtension(filepath, files, onlyScriptsExportingFunction) {
  var results = [];
  var otherFile;

  /* Prefer coffee scripts over json */
  if (isPreferredExtension(filepath)) return filepath;

  var basename = path.basename(filepath, FILE_EXTENSION_JSON);
  var sourceDir = path.dirname(filepath);

  files.forEach(function(f) {
    otherFile = path.resolve(sourceDir, f);

    var stats = fs.statSync(otherFile);
    if (stats.isFile()) {
      var otherFileExtension = path.extname(f);

      if (!(otherFileExtension in getExcludedExtensions()) &&
        path.basename(f, otherFileExtension) == basename) {
        if (!onlyScriptsExportingFunction)
          results.push(otherFile);
        else if (onlyScriptsExportingFunction &&
          (typeof require.extensions[otherFileExtension]) === 'function') {
          results.push(otherFile);
        }
      }
    }
  });
  return (results.length > 0 ? results[0] : undefined);
}

function resolveAppScriptPath(rootDir, relativePath, resolveOptions) {
  var resolvedPath = resolveAppPath(rootDir, relativePath, resolveOptions);
  var sourceDir = path.dirname(resolvedPath);
  var files = tryReadDir(sourceDir);
  var fixedFile = fixFileExtension(resolvedPath, files, false);
  return (fixedFile === undefined ? resolvedPath : fixedFile);
}
