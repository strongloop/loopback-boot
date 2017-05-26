// Copyright IBM Corp. 2015,2016. All Rights Reserved.
// Node module: loopback-boot
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var framework = {
  initialize: function(passport) {
    return function(req, res, next) {
      req._passport = passport;
      res.setHeader('passport', 'initialized');
      next();
    };
  },
};

var Passport = function() {
  this._framework = framework;
};

Passport.prototype.initialize = function() {
  return this._framework.initialize(this);
};

module.exports = new Passport();
