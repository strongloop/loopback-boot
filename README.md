# LoopBack Boot

LoopBack Boot is a convention-based bootstrapper for LoopBack applications.

**For full documentation, see the official StrongLoop documentation:**

 * [Creating a LoopBack application](http://docs.strongloop.com/display/DOC/Creating+a+LoopBack+application)

## Installation

    npm install loopback-boot

## Usage

```js
var loopback = require('loopback');
var boot = require('loopback-boot');

var app = loopback();
boot(app, __dirname);

app.use(loopback.rest());
app.listen();
```

See [API docs](http://apidocs.strongloop.com/loopback-boot/) for
complete API reference.
