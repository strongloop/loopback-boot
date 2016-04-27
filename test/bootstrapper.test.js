var path = require('path');
var loopback = require('loopback');
var expect = require('chai').expect;
var Bootstrapper = require('../lib/bootstrapper').Bootstrapper;

describe('Bootstrapper', function() {
  var app;
  beforeEach(function() {
    app = loopback();
    process.bootFlags = [];
  });

  it('should honor options.phases', function(done) {
    var options = {
      app: app,
      appRootDir: path.join(__dirname, './fixtures/simple-app'),
      phases: ['load'],
    };

    var bootstrapper = new Bootstrapper(options);

    var context = {
      app: app,
    };

    bootstrapper.run(context, function(err) {
      if (err) return done(err);
      expect(context.configurations.application).to.be.object;
      expect(context.configurations.bootScripts).to.be.object;
      expect(context.configurations.middleware).to.be.object;
      expect(context.configurations.models).to.be.object;
      expect(context.instructions).to.be.undefined;
      expect(process.bootFlags.length).to.eql(0);
      done();
    });
  });

  it('should honor options.plugins', function(done) {
    var options = {
      app: app,
      appRootDir: path.join(__dirname, './fixtures/simple-app'),
      plugins: ['application', 'boot-script'],
    };

    var bootstrapper = new Bootstrapper(options);

    var context = {
      app: app,
    };

    bootstrapper.run(context, function(err) {
      if (err) return done(err);
      expect(context.configurations.application).to.be.object;
      expect(context.configurations.middleware).to.be.undefined;
      expect(context.configurations.models).to.be.undefined;
      expect(context.configurations.bootScripts).to.be.object;
      expect(context.instructions.application).to.be.object;
      expect(process.bootFlags).to.eql(['barLoaded',
        'barSyncLoaded',
        'fooLoaded',
        'barStarted',
        'barFinished',
        'barSyncExecuted',
      ]);
      done();
    });
  });

  afterEach(function() {
    delete process.bootFlags;
  });
});
