// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var boot = require('../');
var expect = require('chai').expect;
var sandbox = require('./helpers/sandbox');
var appdir = require('./helpers/appdir');

// add coffee-script to require.extensions
require('coffee-script/register');

describe('utils', function() {
  beforeEach(sandbox.reset);
  beforeEach(function(done) {
    appdir.init(done);
  });
  describe('fileExists', function() {
    it('returns false when a file does not exist', function() {
      var doesNotExist = sandbox.resolve('does-not-exist.json');
      expect(boot.utils.fileExists(doesNotExist))
        .to.equal(false);
    });

    it('returns true when a file does exist', function() {
      var doesExist = appdir.writeConfigFileSync('does-exist.json', {
        exists: true,
      });
      expect(boot.utils.fileExists(doesExist))
        .to.equal(true);
    });
  });
});
