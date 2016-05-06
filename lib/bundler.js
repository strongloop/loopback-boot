// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var fs = require('fs');
var path = require('path');
var commondir = require('commondir');
var cloneDeep = require('lodash').cloneDeep;

/**
 * Add boot instructions to a browserify bundler.
 * @param {Object} instructions Boot instructions.
 * @param {Object} bundler A browserify object created by `browserify()`.
 */

module.exports = function addInstructionsToBrowserify(instructions, bundler) {
  bundleModelScripts(instructions, bundler);
  bundleMixinScripts(instructions, bundler);
  bundleComponentScripts(instructions, bundler);
  bundleOtherScripts(instructions, bundler);
  bundleInstructions(instructions, bundler);
};

function bundleOtherScripts(instructions, bundler) {
  for (var key in instructions.files) {
    addScriptsToBundle(key, instructions.files[key], bundler);
  }
}

function bundleModelScripts(instructions, bundler) {
  bundleSourceFiles(instructions, 'models', bundler);
}

function bundleMixinScripts(instructions, bundler) {
  bundleSourceFiles(instructions, 'mixins', bundler);
}

function bundleComponentScripts(instructions, bundler) {
  bundleSourceFiles(instructions, 'components', bundler);
}

function bundleSourceFiles(instructions, type, bundler) {
  var files = instructions[type]
    .map(function(m) { return m.sourceFile; })
    .filter(function(f) { return !!f; });

  var instructionToFileMapping = instructions[type]
    .map(function(m) { return files.indexOf(m.sourceFile); });

  addScriptsToBundle(type, files, bundler);

  // Update `sourceFile` properties with the new paths
  instructionToFileMapping.forEach(function(fileIx, sourceIx) {
    if (fileIx === -1) return;
    instructions[type][sourceIx].sourceFile = files[fileIx];
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
    bundler.require(filepath, { expose: fileid });

    // Rewrite the instructions entry with the new id that will be
    // used to load the file via `require(fileid)`.
    list[ix] = fileid;
  }
}

function bundleInstructions(instructions, bundler) {
  instructions = cloneDeep(instructions);

  var hasMiddleware = instructions.middleware.phases.length ||
    instructions.middleware.middleware.length;
  if (hasMiddleware) {
    console.warn(
      'Discarding middleware instructions,' +
      ' loopback client does not support middleware.');
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
  bundler.require(instructionsFile, { expose: moduleName });
}
