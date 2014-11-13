process.bootFlags.push('barSyncLoaded');
module.exports = function(app) {
  process.bootFlags.push('barSyncExecuted');
};
