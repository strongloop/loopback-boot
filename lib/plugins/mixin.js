// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const util = require('util');
const fs = require('fs');
const path = require('path');
const PluginBase = require('../plugin-base');
const _ = require('lodash');
const debug = require('debug')('loopback:boot:mixin');
const utils = require('../utils');
const g = require('../globalize');

const tryResolveAppPath = utils.tryResolveAppPath;
const getExcludedExtensions = utils.getExcludedExtensions;
const findScripts = utils.findScripts;
const FILE_EXTENSION_JSON = utils.FILE_EXTENSION_JSON;

module.exports = function(options) {
  return new Mixin(options);
};

function Mixin(options) {
  PluginBase.call(this, options, 'mixins', null);
}

util.inherits(Mixin, PluginBase);

Mixin.prototype.buildInstructions = function(context, rootDir, config) {
  const modelsMeta = context.configurations.mixins._meta || {};
  const modelInstructions = context.instructions.models;
  const mixinSources = this.options.mixinSources || modelsMeta.mixins ||
    ['./mixins'];
  const scriptExtensions = this.options.scriptExtensions || require.extensions;

  const mixinInstructions = buildAllMixinInstructions(
    rootDir, this.options, mixinSources, scriptExtensions, modelInstructions,
  );

  return mixinInstructions;
};

function buildAllMixinInstructions(appRootDir, options, mixinSources,
  scriptExtensions, modelInstructions) {
  // load mixins from `options.mixins`
  let sourceFiles = options.mixins || [];
  const mixinDirs = options.mixinDirs || [];
  const instructionsFromMixins = loadMixins(sourceFiles, options.normalization);

  // load mixins from `options.mixinDirs`
  sourceFiles = findMixinDefinitions(appRootDir, mixinDirs, scriptExtensions);
  if (sourceFiles === undefined) return;
  const instructionsFromMixinDirs = loadMixins(sourceFiles,
    options.normalization);

  /* If `mixinDirs` and `mixinSources` have any directories in common,
   * then remove the common directories from `mixinSources` */
  mixinSources = _.difference(mixinSources, mixinDirs);

  // load mixins from `options.mixinSources`
  sourceFiles = findMixinDefinitions(appRootDir, mixinSources,
    scriptExtensions);
  if (sourceFiles === undefined) return;
  let instructionsFromMixinSources = loadMixins(sourceFiles,
    options.normalization);

  // Fetch unique list of mixin names, used in models
  let modelMixins = fetchMixinNamesUsedInModelInstructions(modelInstructions);
  modelMixins = _.uniq(modelMixins);

  // Filter-in only mixins, that are used in models
  instructionsFromMixinSources = filterMixinInstructionsUsingWhitelist(
    instructionsFromMixinSources, modelMixins,
  );

  const mixins = _.assign(
    instructionsFromMixins,
    instructionsFromMixinDirs,
    instructionsFromMixinSources,
  );

  return _.values(mixins);
}

function findMixinDefinitions(appRootDir, sourceDirs, scriptExtensions) {
  let files = [];
  sourceDirs.forEach(function(dir) {
    const path = tryResolveAppPath(appRootDir, dir);
    if (!path) {
      debug('Skipping unknown module source dir %j', dir);
      return;
    }
    files = files.concat(findScripts(path, scriptExtensions));
  });
  return files;
}

function loadMixins(sourceFiles, normalization) {
  const mixinInstructions = {};
  sourceFiles.forEach(function(filepath) {
    const dir = path.dirname(filepath);
    const ext = path.extname(filepath);
    let name = path.basename(filepath, ext);
    const metafile = path.join(dir, name + FILE_EXTENSION_JSON);

    name = normalizeMixinName(name, normalization);
    const meta = {};
    meta.name = name;
    if (utils.fileExistsSync(metafile)) {
      // May overwrite name, not sourceFile
      _.extend(meta, require(metafile));
    }
    meta.sourceFile = filepath;
    mixinInstructions[meta.name] = meta;
  });

  return mixinInstructions;
}

function fetchMixinNamesUsedInModelInstructions(modelInstructions) {
  return _.flatten(modelInstructions
    .map(function(model) {
      return model.definition && model.definition.mixins ?
        Object.keys(model.definition.mixins) : [];
    }));
}

function filterMixinInstructionsUsingWhitelist(instructions, includeMixins) {
  const instructionKeys = Object.keys(instructions);
  includeMixins = _.intersection(instructionKeys, includeMixins);

  const filteredInstructions = {};
  instructionKeys.forEach(function(mixinName) {
    if (includeMixins.indexOf(mixinName) !== -1) {
      filteredInstructions[mixinName] = instructions[mixinName];
    }
  });
  return filteredInstructions;
}

function normalizeMixinName(str, normalization) {
  switch (normalization) {
    case false:
    case 'none':
      return str;

    case undefined:
    case 'classify':
      str = String(str).replace(/([A-Z]+)/g, ' $1').trim();
      str = String(str).replace(/[\W_]/g, ' ').toLowerCase();
      str = str.replace(/(?:^|\s|-)\S/g, function(c) {
        return c.toUpperCase();
      });
      str = str.replace(/\s+/g, '');
      return str;

    case 'dasherize':
      str = String(str).replace(/([A-Z]+)/g, ' $1').trim();
      str = String(str).replace(/[\W_]/g, ' ').toLowerCase();
      str = str.replace(/\s+/g, '-');
      return str;

    default:
      if (typeof normalization === 'function') {
        return normalization(str);
      }

      const err = new Error(g.f('Invalid normalization format - "%s"',
        normalization));
      err.code = 'INVALID_NORMALIZATION_FORMAT';
      throw err;
  }
}

Mixin.prototype.starting = function(context) {
  const app = context.app;
  const instructions = context.instructions.mixins;

  const modelBuilder = (app.registry || app.loopback).modelBuilder;
  const BaseClass = app.loopback.Model;
  const mixins = instructions || [];

  if (!modelBuilder.mixins || !mixins.length) return;

  mixins.forEach(function(obj) {
    debug('Requiring mixin %s', obj.sourceFile);
    const mixin = require(obj.sourceFile);

    if (typeof mixin === 'function' || mixin.prototype instanceof BaseClass) {
      debug('Defining mixin %s', obj.name);
      modelBuilder.mixins.define(obj.name, mixin); // TODO (name, mixin, meta)
    } else {
      debug('Skipping mixin file %s - `module.exports` is not a function' +
        ' or Loopback model', obj);
    }
  });
};
