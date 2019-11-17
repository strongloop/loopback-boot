// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const utils = require('../lib/utils');
const expect = require('chai').expect;
const sandbox = require('./helpers/sandbox');
const appdir = require('./helpers/appdir');

describe('utils', function() {
  beforeEach(sandbox.reset);
  beforeEach(function(done) {
    appdir.init(done);
  });
  describe('fileExistsSync', function() {
    it('returns false when a file does not exist', function() {
      const doesNotExist = sandbox.resolve('does-not-exist.json');
      expect(utils.fileExistsSync(doesNotExist))
        .to.equal(false);
    });

    it('returns true when a file does exist', function() {
      const doesExist = appdir.writeConfigFileSync('does-exist.json', {
        exists: true,
      });
      expect(utils.fileExistsSync(doesExist))
        .to.equal(true);
    });
  });
});
