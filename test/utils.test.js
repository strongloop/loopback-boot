// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var utils = require('../lib/utils');
var expect = require('chai').expect;
var sandbox = require('./helpers/sandbox');
var appdir = require('./helpers/appdir');

describe('utils', function() {
  beforeEach(sandbox.reset);
  beforeEach(function(done) {
    appdir.init(done);
  });
  describe('fileExistsSync', function() {
    it('returns false when a file does not exist', function() {
      var doesNotExist = sandbox.resolve('does-not-exist.json');
      expect(utils.fileExistsSync(doesNotExist))
        .to.equal(false);
    });

    it('returns true when a file does exist', function() {
      var doesExist = appdir.writeConfigFileSync('does-exist.json', {
        exists: true,
      });
      expect(utils.fileExistsSync(doesExist))
        .to.equal(true);
    });
  });
});
