var util = require('util');
var fs = require('fs');
var path = require('path');
var PluginBase = require('../plugin-base');
var _ = require('lodash');
var debug = require('debug')('loopback:boot:mixin');
var utils = require('../utils');

var tryResolveAppPath = utils.tryResolveAppPath;
var getExcludedExtensions = utils.getExcludedExtensions;
var findScripts = utils.findScripts;
var FILE_EXTENSION_JSON = utils.FILE_EXTENSION_JSON;

module.exports = function(options) {
  return new Mixin(options);
};

function Mixin(options) {
  PluginBase.call(this, options, 'mixins', null);
}

util.inherits(Mixin, PluginBase);

Mixin.prototype.buildInstructions = function(context, rootDir, config) {
  var modelsMeta = context.configurations.mixins._meta || {};
  var modelInstructions = context.instructions.models;
  var mixinDirs = this.options.mixinDirs || [];
  var mixinSources = this.options.mixinSources || modelsMeta.mixins ||
    ['./mixins'];

  var mixinInstructions = buildAllMixinInstructions(
    rootDir, mixinDirs, mixinSources, this.options, modelInstructions);

  return mixinInstructions;
};

function buildAllMixinInstructions(appRootDir, mixinDirs, mixinSources, options,
                                   modelInstructions) {
  var extensions = _.without(_.keys(require.extensions),
    _.keys(getExcludedExtensions()));

  // load mixins from `options.mixins`
  var sourceFiles = options.mixins || [];
  var instructionsFromMixins = loadMixins(sourceFiles, options);

  // load mixins from `options.mixinDirs`
  sourceFiles = findMixinDefinitions(appRootDir, mixinDirs, extensions);
  if (sourceFiles === undefined) return;
  var instructionsFromMixinDirs = loadMixins(sourceFiles, options);

  /* If `mixinDirs` and `mixinSources` have any directories in common,
   * then remove the common directories from `mixinSources` */
  mixinSources = _.difference(mixinSources, mixinDirs);

  // load mixins from `options.mixinSources`
  sourceFiles = findMixinDefinitions(appRootDir, mixinSources, extensions);
  if (sourceFiles === undefined) return;
  var instructionsFromMixinSources = loadMixins(sourceFiles, options);

  // Fetch unique list of mixin names, used in models
  var modelMixins = fetchMixinNamesUsedInModelInstructions(modelInstructions);
  modelMixins = _.uniq(modelMixins);

  // Filter-in only mixins, that are used in models
  instructionsFromMixinSources = filterMixinInstructionsUsingWhitelist(
    instructionsFromMixinSources, modelMixins);

  var mixins = _.assign(
    instructionsFromMixins,
    instructionsFromMixinDirs,
    instructionsFromMixinSources);

  return _.values(mixins);
}

function findMixinDefinitions(appRootDir, sourceDirs, extensions) {
  var files = [];
  sourceDirs.forEach(function(dir) {
    var path = tryResolveAppPath(appRootDir, dir);
    if (!path) {
      debug('Skipping unknown module source dir %j', dir);
      return;
    }
    files = files.concat(findScripts(path, extensions));
  });
  return files;
}

function loadMixins(sourceFiles, options) {
  var mixinInstructions = {};
  sourceFiles.forEach(function(filepath) {
    var dir = path.dirname(filepath);
    var ext = path.extname(filepath);
    var name = path.basename(filepath, ext);
    var metafile = path.join(dir, name + FILE_EXTENSION_JSON);

    name = normalizeMixinName(name, options);
    var meta = {};
    meta.name = name;
    if (fs.existsSync(metafile)) {
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
  var instructionKeys = Object.keys(instructions);
  includeMixins = _.intersection(instructionKeys, includeMixins);

  var filteredInstructions = {};
  instructionKeys.forEach(function(mixinName) {
    if (includeMixins.indexOf(mixinName) !== -1) {
      filteredInstructions[mixinName] = instructions[mixinName];
    }
  });
  return filteredInstructions;
}

function normalizeMixinName(str, options) {
  var normalization = options.normalization;
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

      var err = new Error('Invalid normalization format - "' +
        normalization + '"');
      err.code = 'INVALID_NORMALIZATION_FORMAT';
      throw err;
  }
}

Mixin.prototype.starting = function(context) {
  var app = context.app;
  var instructions = context.instructions.mixins;

  var modelBuilder = (app.registry || app.loopback).modelBuilder;
  var BaseClass = app.loopback.Model;
  var mixins = instructions || [];

  if (!modelBuilder.mixins || !mixins.length) return;

  mixins.forEach(function(obj) {
    debug('Requiring mixin %s', obj.sourceFile);
    var mixin = require(obj.sourceFile);

    if (typeof mixin === 'function' || mixin.prototype instanceof BaseClass) {
      debug('Defining mixin %s', obj.name);
      modelBuilder.mixins.define(obj.name, mixin); // TODO (name, mixin, meta)
    } else {
      debug('Skipping mixin file %s - `module.exports` is not a function' +
        ' or Loopback model', obj);
    }
  });
};
