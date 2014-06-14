## Running in a browser

The bootstrap process is implemented in two steps that can be called
independently.

### Build

The first step loads all configuration files, merges values from additional
config files like `app.local.js` and produces a set of instructions
that can be used to boot the application.

These instructions must be included in the browser bundle together
with all configuration scripts from `models/` and `boot/`.

Don't worry, you don't have to understand these details.
Just call `boot.compileToBrowserify`, it will take care of everything for you.

```js
/*-- build file --*/
var browserify = require('browserify');
var boot = require('loopback-boot');

var b = browserify({
  basedir: appDir,
});

// add the main application file
b.require('./app.js', { expose: 'loopback-app' });

// add boot instructions
boot.compileToBrowserify(appDir, b);

// create the bundle
var out = fs.createWriteStream('app.bundle.js');
b.bundle().pipe(out);
// handle out.on('error') and out.on('close')
```

### Run

In the browser, the main application file should call loopback-boot
to setup the loopback application by executing the instructions
contained in the browser bundle:

```js
/*-- app.js --*/
var loopback = require('loopback');
var boot = require('loopback-boot');

var app = module.exports = loopback();
boot(app);
```

The app object created above can be accessed via `require('loopback-app')`,
where `loopback-app` is the identifier used for the main app file in
the browserify build shown above.

Here is a simple example demonstrating the concept:

```xml
<script src="app.bundle.js"></script>
<script>
var app = require('loopback-app');
var User = app.models.User;

User.login({ email: 'test@example.com', password: '12345', function(err, res) {
  if (err) {
    console.error('Login failed: ', err);
  } else {
    console.log('Logged in.');
  }
});
</script>
```
