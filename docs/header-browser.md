## Browser API

Use this API in the `app.js` file that you process by browserify and run in the browser.

```js
var loopback = require('loopback');
var boot = require('loopback-boot');

var app = module.exports = loopback();
boot(app);
```

### Browserify Note

Loopback-boot will *not work correctly* with `fullpaths` option set in browserify/watchify.
