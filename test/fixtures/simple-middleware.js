module.exports = function(params) {
  return function(req, res, next) {
    res.send(params);
  };
};
