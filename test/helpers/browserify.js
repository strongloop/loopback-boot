// Copyright IBM Corp. 2015,2019. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var fs = require('fs');
var sandbox = require('./sandbox');

function exportToSandbox(b, fileName, callback) {
  var bundlePath = sandbox.resolve(fileName);
  var out = fs.createWriteStream(bundlePath);
  b.bundle().pipe(out);

  out.on('error', function(err) {
    return callback(err);
  });
  out.on('close', function() {
    callback(null, bundlePath);
  });
}
exports.exportToSandbox = exportToSandbox;

exports.packageFilter = function packageFilter(pkg, dir) {
  // async@3 (used e.g. by loopback-connector) is specifying custom
  // browserify config, in particular it wants to apply transformation
  // `babelify`. We don't have `babelify` installed because we are
  // testing using latest Chrome and thus don't need any transpilation.
  // Let's remove the browserify config from the package and force
  // browserify to use our config instead.
  if (pkg.name === 'async') {
    delete pkg.browserify;
  }
  return pkg;
};
