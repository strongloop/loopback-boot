process.bootFlags.push('barLoaded');
module.exports = function(app, callback) {
  process.bootFlags.push('barStarted');
  process.nextTick(function() {
    process.bootFlags.push('barFinished');
    callback();
  });
};
