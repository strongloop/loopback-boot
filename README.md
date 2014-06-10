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

## Versions

The version range `1.x` is backwards compatible with `app.boot` provided
by LoopBack 1.x versions and the project layout scaffolded by `slc lb project`
up to slc version 2.5.

The version range `2.x` supports the new project layout as scaffolded by
`yo loopback`.
