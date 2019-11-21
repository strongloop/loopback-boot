// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

const path = require('path');
const loopback = require('loopback');

const chai = require('chai');
const dirtyChai = require('dirty-chai');
const expect = chai.expect;
chai.use(dirtyChai);

const bootLoopBackApp = require('..');

describe('bootLoopBackApp', function() {
  let app;
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
