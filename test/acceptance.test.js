// Copyright IBM Corp. 2015,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var path = require('path');
var loopback = require('loopback');

var chai = require('chai');
var dirtyChai = require('dirty-chai');
var expect = chai.expect;
chai.use(dirtyChai);

const bootLoopBackApp = require('..');

describe('bootLoopBackApp', function() {
  var app;
  beforeEach(function() {
    app = loopback();
  });

  it('sets app.booting immediately', function() {
    const appDir = path.join(__dirname, './fixtures/empty-app');

    // Start the bootstrapper
    const promise = bootLoopBackApp(app, appDir);

    // Still in the original turn of the event loop,
    // verify that the app is signalling "boot in progress"
    expect(app.booting).to.equal(true);

    // Wait for bootstrapper to finish
    return promise.then(() => {
      // Verify that app is signalling "boot has finished"
      expect(app.booting).to.equal(false);
    });
  });
});
