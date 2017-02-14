// Copyright IBM Corp. 2014,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

var boot = require('../');
var fs = require('fs-extra');
var path = require('path');
var expect = require('chai').expect;
var loadConfig = require('load-config-file');
var yaml  = require('js-yaml');

loadConfig.register(['.yaml', '.yml'], yaml.safeLoad);

// add coffee-script to require.extensions
require('coffee-script/register');

var COFFEE_APP = path.join(__dirname, 'fixtures', 'coffee-app');

describe('compiler', function() {
  function getModelByName(aModels, aName) {
    for (let model of aModels) {
      if (model.name === aName) return model;
    }
  }
  describe('from directory', function() {
    it('loads Model yaml config files', function(done) {
      boot.compile(COFFEE_APP, function(err, context) {
        if (err) return done(err);
        var instructions = context.instructions;

        var model = getModelByName(instructions.models, 'Order');
        expect(model).to.be.exist;
        expect(model.sourceFile).to.be.exist;
        done();
      });
    });
  });
});

