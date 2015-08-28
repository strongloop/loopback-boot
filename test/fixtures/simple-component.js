module.exports = function(loopbackApp, params) {

  loopbackApp.use('/component', function(req, res, next) {
    res.send(params);
  });

};
