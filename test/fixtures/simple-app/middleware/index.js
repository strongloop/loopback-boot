exports.myMiddleware = function(name) {
  return function(req, res, next) {
    req._names = req._names || [];
    req._names.push(name);
    res.setHeader('names', req._names.join(','));
    next();
  };
};
