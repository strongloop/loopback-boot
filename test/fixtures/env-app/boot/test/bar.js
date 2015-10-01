process.bootFlags.push('barLoadedInTest');
module.exports = function(app, callback) {
  callback();
};
