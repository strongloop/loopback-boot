// Copyright IBM Corp. 2015. All Rights Reserved.
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
