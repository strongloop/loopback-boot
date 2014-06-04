var fs = require('fs');
var path = require('path');
var commondir = require('commondir');

/**
 * Add boot instructions to a browserify bundler.
 * @param {Object} instructions Boot instructions.
 * @param {Object} bundler A browserify object created by `browserify()`.
 */

module.exports = function addInstructionsToBrowserify(instructions, bundler) {
  bundleScripts(instructions.files, bundler);
  bundleInstructions(instructions, bundler);
};

function bundleScripts(files, bundler) {
  for (var key in files) {
    var list = files[key];
    if (!list.length) continue;

    var root = commondir(files[key].map(path.dirname));

    for (var ix in list) {
      var filepath = list[ix];

      // Build a short unique id that does not expose too much
      // information about the file system, but still preserves
      // useful information about where is the file coming from.
      var fileid = 'loopback-boot#' + key + '#' + path.relative(root, filepath);

      // Add the file to the bundle.
      bundler.require(filepath, { expose: fileid });

      // Rewrite the instructions entry with the new id that will be
      // used to load the file via `require(fileid)`.
      list[ix] = fileid;
    }
  }
}

function bundleInstructions(instructions, bundler) {
  var instructionsString = JSON.stringify(instructions, null, 2);

  /* The following code does not work due to a bug in browserify
   * https://github.com/substack/node-browserify/issues/771
   var instructionsStream = require('resumer')()
     .queue(instructionsString);
   instructionsStream.path = 'boot-instructions';
   b.require(instructionsStream, { expose: 'loopback-boot#instructions' });
   */

  // Write the instructions to a file in our node_modules folder.
  // The location should not really matter as long as it is .gitignore-ed
  var instructionsFile = path.resolve(__dirname,
    '..', 'node_modules', 'instructions.json');

  fs.writeFileSync(instructionsFile, instructionsString, 'utf-8');
  bundler.require(instructionsFile, { expose: 'loopback-boot#instructions' });
}
