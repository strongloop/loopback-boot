// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var fs = require('fs');
var path = require('path');
var commondir = require('commondir');
var cloneDeep = require('lodash').cloneDeep;
var g = require('./globalize');

/**
 * Add boot instructions to a browserify bundler.
 * @param {Object} instructions Boot instructions.
 * @param {Object} bundler A browserify object created by `browserify()`.
 */
module.exports = function addInstructionsToBrowserify(context, bundler) {
  addPlugins(bundler);
  // bundlePluginScripts(context, bundler);
  bundleModelScripts(context, bundler);
  bundleMixinScripts(context, bundler);
  bundleComponentScripts(context, bundler);
  bundleOtherScripts(context, bundler);
  bundleInstructions(context, bundler);
};

function addPlugins(bundler) {
  var dir = path.join(__dirname, './plugins');
  var files = fs.readdirSync(dir);
  files.forEach(function(f) {
    bundler.require(path.join(dir, f),
      {expose: './plugins/' + path.basename(f, '.js')});
  });
}

function bundleOtherScripts(context, bundler) {
  var list = context.instructions.bootScripts;
  addScriptsToBundle('boot', list, bundler);
}

function bundlePluginScripts(context, bundler) {
  var list = context.instructions.pluginScripts;
  addScriptsToBundle('plugins', list, bundler);
}

function bundleModelScripts(context, bundler) {
  bundleSourceFiles(context, 'models', bundler);
}

function bundleMixinScripts(context, bundler) {
  bundleSourceFiles(context, 'mixins', bundler);
}

function bundleComponentScripts(context, bundler) {
  bundleSourceFiles(context, 'components', bundler);
}

function bundleSourceFiles(context, type, bundler) {
  var files = context.instructions[type]
    .map(function(m) { return m.sourceFile; })
    .filter(function(f) { return !!f; });

  var instructionToFileMapping = context.instructions[type]
    .map(function(m) { return files.indexOf(m.sourceFile); });

  addScriptsToBundle(type, files, bundler);

  // Update `sourceFile` properties with the new paths
  instructionToFileMapping.forEach(function(fileIx, sourceIx) {
    if (fileIx === -1) return;
    context.instructions[type][sourceIx].sourceFile = files[fileIx];
  });
}

function addScriptsToBundle(name, list, bundler) {
  if (!list.length) return;

  var root = commondir(list.map(path.dirname));

  for (var ix in list) {
    var filepath = list[ix];

    // Build a short unique id that does not expose too much
    // information about the file system, but still preserves
    // useful information about where is the file coming from.
    var fileid = 'loopback-boot#' + name + '#' + path.relative(root, filepath);

    // Add the file to the bundle.
    bundler.require(filepath, {expose: fileid});

    // Rewrite the context entry with the new id that will be
    // used to load the file via `require(fileid)`.
    list[ix] = fileid;
  }
}

function bundleInstructions(context, bundler) {
  var instructions = cloneDeep(context.instructions);

  var hasMiddleware = instructions.middleware.phases.length ||
    instructions.middleware.middleware.length;
  if (hasMiddleware) {
    g.warn(
      'Discarding {{middleware}} instructions,' +
      ' {{loopback}} client does not support {{middleware}}.');
  }
  delete instructions.middleware;

  var instructionsString = JSON.stringify(instructions, null, 2);

  /* The following code does not work due to a bug in browserify
   * https://github.com/substack/node-browserify/issues/771
   var instructionsStream = require('resumer')()
     .queue(instructionsString);
   instructionsStream.path = 'boot-instructions';
   b.require(instructionsStream, { expose: 'loopback-boot#instructions' });
   */

  var instructionId = 'instructions';
  // Create an unique instruction identifier using the application ID.
  // This is only useful when multiple loopback applications are being bundled
  // together.
  if (instructions.appId)
    instructionId += '-' + instructions.appId;

  // Write the instructions to a file in our node_modules folder.
  // The location should not really matter as long as it is .gitignore-ed
  var instructionsFile = path.resolve(__dirname,
    '..', 'generated-' + instructionId + '.json');
  fs.writeFileSync(instructionsFile, instructionsString, 'utf-8');

  var moduleName = 'loopback-boot#' + instructionId;
  bundler.require(instructionsFile, {expose: moduleName});
}
