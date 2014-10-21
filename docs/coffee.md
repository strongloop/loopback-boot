## Server Files in Coffee-Script

In order to create application files in coffee-script, you'll need to register the coffee-script extension:

```javascript
require('coffee-script/register');
```

You'll need to do this at any entry points for the app (e.g. the server.js file, mocha.opts, and gulp/grunt).  It is recommended to leave the entry point of the app (server.js by default, specified as 'main' in package.json) as a javascript file, and then register coffee-script, and proceed with any coffee-requires.

## Client Files in Coffee-Script

You can use the Coffeeify module to include Coffee files in your browser package.  Use a build script like this:


```javascript
// assuming you haven't done so already
require('coffee-script/register');

var b = browserify({
  basedir: appDir,
  extensions: ['.coffee'], //causes browserify to look for this extension
  debug: true
});

b.transform('coffeeify'); //adds coffee compiler to the build pipeline

b.require('./app.coffee', { expose: 'browser-app' }); //requiring your file will set the entry point
boot.compileToBrowserify(appDir, b);

var bundlePath = sandbox.resolve('browser-app-bundle.js'); //remember, the final result is still '.js'
var out = fs.createWriteStream(bundlePath);

b.bundle().pipe(out);
```
