// When you create a named function, its name will be used
// as the mixin name - alternatively, set mixin.mixinName.

var mixin = function bar(Model, options) {

  Model.barMixin = true;

};

module.exports = mixin;
