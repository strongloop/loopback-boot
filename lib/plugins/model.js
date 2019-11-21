// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const assert = require('assert');
const util = require('util');
const PluginBase = require('../plugin-base');
const path = require('path');
const debug = require('debug')('loopback:boot:model');
const _ = require('lodash');
const toposort = require('toposort');
const utils = require('../utils');

const tryReadDir = utils.tryReadDir;
const assertIsValidConfig = utils.assertIsValidConfig;
const tryResolveAppPath = utils.tryResolveAppPath;
const fixFileExtension = utils.fixFileExtension;
const g = require('../globalize');

module.exports = function(options) {
  return new Model(options);
};

function Model(options) {
  PluginBase.call(this, options, 'models', 'model-config');
}

util.inherits(Model, PluginBase);

Model.prototype.getRootDir = function() {
  return this.options.modelsRootDir;
};

Model.prototype.load = function(context) {
  const config = PluginBase.prototype.load.apply(this, arguments);
  assertIsValidModelConfig(config);
  return config;
};

Model.prototype.buildInstructions = function(context, rootDir, modelsConfig) {
  const modelsMeta = modelsConfig._meta || {};
  delete modelsConfig._meta;
  context.configurations.mixins._meta = modelsMeta;

  const modelSources = this.options.modelSources || modelsMeta.sources ||
    ['./models'];
  const modelInstructions = buildAllModelInstructions(
    rootDir, modelsConfig, modelSources, this.options.modelDefinitions,
    this.options.scriptExtensions,
  );
  return modelInstructions;
};

function buildAllModelInstructions(rootDir, modelsConfig, sources,
  modelDefinitions, scriptExtensions) {
  let registry = verifyModelDefinitions(rootDir, modelDefinitions,
    scriptExtensions);
  if (!registry) {
    registry = findModelDefinitions(rootDir, sources, scriptExtensions);
  }

  const modelNamesToBuild = addAllBaseModels(
    registry,
    Object.keys(modelsConfig),
  );

  const instructions = modelNamesToBuild
    .map(function createModelInstructions(name) {
      const config = modelsConfig[name];
      const definition = registry[name] || {};

      debug('Using model "%s"\nConfiguration: %j\nDefinition %j',
        name, config, definition.definition);

      return {
        name: name,
        config: config,
        definition: definition.definition,
        sourceFile: definition.sourceFile,
      };
    });

  return sortByInheritance(instructions);
}

function addAllBaseModels(registry, modelNames) {
  const result = [];
  const visited = {};

  while (modelNames.length) {
    const name = modelNames.shift();

    if (visited[name]) continue;
    visited[name] = true;
    result.push(name);

    const definition = registry[name] && registry[name].definition;
    if (!definition) continue;

    const base = getBaseModelName(definition);

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
  const edges = instructions
    .map(function(inst) {
      return [getBaseModelName(inst.definition), inst.name];
    });

  const sortedNames = toposort(edges);

  const instructionsByModelName = {};
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

function verifyModelDefinitions(rootDir, modelDefinitions, scriptExtensions) {
  if (!modelDefinitions || modelDefinitions.length < 1) {
    return undefined;
  }

  const registry = {};
  modelDefinitions.forEach(function(definition, idx) {
    if (definition.sourceFile) {
      const fullPath = path.resolve(rootDir, definition.sourceFile);
      definition.sourceFile = fixFileExtension(
        fullPath,
        tryReadDir(path.dirname(fullPath)),
        scriptExtensions,
      );

      if (!definition.sourceFile) {
        debug('Model source code not found: %s - %s', definition.sourceFile);
      }
    }

    debug('Found model "%s" - %s %s',
      definition.definition.name,
      'from options',
      definition.sourceFile ?
        path.relative(rootDir, definition.sourceFile) :
        '(no source file)');

    const modelName = definition.definition.name;
    if (!modelName) {
      debug('Skipping model definition without Model name ' +
        '(from options.modelDefinitions @ index %s)',
      idx);
      return;
    }
    registry[modelName] = definition;
  });

  return registry;
}

function findModelDefinitions(rootDir, sources, scriptExtensions) {
  const registry = {};

  sources.forEach(function(src) {
    const srcDir = tryResolveAppPath(rootDir, src, {strict: false});
    if (!srcDir) {
      debug('Skipping unknown module source dir %j', src);
      return;
    }

    const files = tryReadDir(srcDir);

    files
      .filter(function(f) {
        return f[0] !== '_' && path.extname(f) === '.json';
      })
      .forEach(function(f) {
        const fullPath = path.resolve(srcDir, f);
        const entry = loadModelDefinition(rootDir, fullPath, files,
          scriptExtensions);
        const modelName = entry.definition.name;
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

function loadModelDefinition(rootDir, jsonFile, allFiles, scriptExtensions) {
  const definition = require(jsonFile);
  const basename = path.basename(jsonFile, path.extname(jsonFile));
  definition.name = definition.name || _.upperFirst(_.camelCase(basename));

  // find a matching file with a supported extension like `.js` or `.coffee`
  const sourceFile = fixFileExtension(jsonFile, allFiles, scriptExtensions);

  if (sourceFile === undefined) {
    debug('Model source code not found: %s', sourceFile);
  }

  debug('Found model "%s" - %s %s', definition.name,
    path.relative(rootDir, jsonFile),
    sourceFile ? path.relative(rootDir, sourceFile) : '(no source file)');

  return {
    definition: definition,
    sourceFile: sourceFile,
  };
}

function assertIsValidModelConfig(config) {
  assertIsValidConfig('model', config);
  for (const name in config) {
    const entry = config[name];
    const options = entry.options || {};
    const unsupported = entry.properties ||
      entry.base || options.base ||
      entry.plural || options.plural;

    if (unsupported) {
      throw new Error(g.f(
        'The data in {{model-config.json}} ' +
        'is in the unsupported {{1.x}} format.',
      ));
    }
  }
}

// Regular expression to match built-in loopback models
const LOOPBACK_MODEL_REGEXP = new RegExp(
  ['', 'node_modules', 'loopback', '[^\\/\\\\]+', 'models', '[^\\/\\\\]+\\.js$']
    .join('\\' + path.sep),
);

function isBuiltinLoopBackModel(app, data) {
  // 1. Built-in models are exposed on the loopback object
  if (!app.loopback[data.name]) return false;

  // 2. Built-in models have a script file `loopback/{facet}/models/{name}.js`
  const srcFile = data.sourceFile;
  return srcFile &&
    LOOPBACK_MODEL_REGEXP.test(srcFile);
}

Model.prototype.start = function(context) {
  const app = context.app;
  const instructions = context.instructions[this.name];

  const registry = app.registry || app.loopback;
  instructions.forEach(function(data) {
    const name = data.name;
    let model;

    if (!data.definition) {
      model = registry.getModel(name);
      if (!model) {
        throw new Error(g.f('Cannot configure unknown model %s', name));
      }
      debug('Configuring existing model %s', name);
    } else if (isBuiltinLoopBackModel(app, data)) {
      model = registry.getModel(name);
      assert(model, 'Built-in model ' + name + ' should have been defined');
      debug('Configuring built-in LoopBack model %s', name);
    } else {
      debug('Creating new model %s %j', name, data.definition);
      model = registry.createModel(data.definition);
      if (data.sourceFile) {
        debug('Loading customization script %s', data.sourceFile);
        const code = require(data.sourceFile);
        if (typeof code === 'function') {
          debug('Customizing model %s', name);
          code(model);
        } else {
          debug('Skipping model file %s - `module.exports` is not a function',
            data.sourceFile);
        }
      }
    }
    data._model = model;
  });

  instructions.forEach(function(data) {
    // Skip base models that are not exported to the app
    if (!data.config) return;

    app.model(data._model, data.config);
  });
};
