var framework = {
  initialize: function(passport) {
    return function(req, res, next) {
      req._passport = passport;
      res.setHeader('passport', 'initialized');
      next();
    };
  }
};

var Passport = function() {
  this._framework = framework;
};

Passport.prototype.initialize = function() {
  return this._framework.initialize(this);
};

module.exports = new Passport();
