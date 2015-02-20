module.exports = function(app, cb) {
  if (app.booting)
    process.bootingFlagSet = true;

  process.nextTick(cb);
};
