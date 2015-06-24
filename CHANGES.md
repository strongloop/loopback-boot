2015-06-24, Version 2.8.2
=========================

 * Excl. mod. main path from middleware instructions (Miroslav Bajtoš)


2015-06-10, Version 2.8.1
=========================

 * Add more debug info for config loading (Ritchie Martori)

 * use a new variable for better debug output (Bryan Clark)


2015-05-29, Version 2.8.0
=========================

 * Support iisnode using named pipes as PORT value (Jonathan Sheely)

 * support 'mixinsources' option (Pradnya Baviskar)

 * compiler: Simplify verifyModelDefinitions() (Miroslav Bajtoš)

 * Fix coding style issues, add API docs (Miroslav Bajtoš)

 * Extend options arg to support custom model definitions (Shlomi Assaf)

 * add support for mixins  - [mixinDirs]: List of directories to look for files  containing model mixin definition. (Pradnya Baviskar)


2015-04-23, Version 2.7.1
=========================

 * executor: fix port lookup (Miroslav Bajtoš)

 * Clean up compiler.tryResolveAppPath (Miroslav Bajtoš)

 * Configure Travis CI builds (Miroslav Bajtoš)


2015-04-15, Version 2.7.0
=========================

 * Upgrade lodash and drop underscore.string (Bryan Clark)

 * add console.error message to a bad require in a boot script (Bryan Clark)

 * Support per-application registry of models (Miroslav Bajtoš)

 * Use filename as default value for Model name (Pradnya Baviskar)

 * compiler: code cleanup (Miroslav Bajtoš)

 * Improve the resolution of relative paths  - resolve module relative path for component  - prioritize coffeescript over json (Pradnya Baviskar)

 * Resolve module paths as relative to appRootDir - for middleware (Pradnya Baviskar)

 * Support for multiple apps in browserified bundle. (Krishna Raman)

 * Resolve missing file extension for module relative paths (Pradnya Baviskar)

 * Resolve module paths as relative to appRootDir (Pradnya Baviskar)

 * Resolve relative paths in  using appRootDir (Pradnya Baviskar)

 * Add feature to disable component (Pradnya Baviskar)

 * Fix test for different line endings on Windows (Pradnya Baviskar)

 * Refactor unit test assertions to be more specific (Simon Ho)

 * Add unit test to verify `app.booting flag status (Simon Ho)


2015-02-20, Version 2.6.5
=========================

 * Save instructions.json in root dir Saving in node_modules dir causes complaints and missing files fixes https://github.com/strongloop/loopback-boot/issues/94 (Berkeley Martinez)


2015-02-02, Version 2.6.4
=========================

 * executor: pass correct `this` to middleware (Clark Wang)

 * Fix broken links (Rand McKinney)


2015-01-13, Version 2.6.3
=========================



2015-01-13, Version 2.6.2
=========================

 * Don't swallow error when a sub-dependency doesn't resolve. (Samuel Reed)


2015-01-12, Version 2.6.1
=========================

 * Fix "incompatible loopback version" check & msg (Miroslav Bajtoš)


2015-01-08, Version 2.6.0
=========================

 * Add "booting" flag and emit "booted" event (Simon Ho)

 * Configure components via `component-config.json` (Miroslav Bajtoš)

 * Fix bad CLA URL in CONTRIBUTING.md (Ryan Graham)


2014-12-19, Version 2.5.2
=========================

 * Dedupe boot scripts (Eric Satterwhite)


2014-12-08, Version 2.5.1
=========================

 * Replace underscore with lodash (Ryan Graham)


2014-12-02, Version 2.5.0
=========================

 * compiler: resolve paths in middleware params (Miroslav Bajtoš)


2014-11-27, Version 2.4.0
=========================

 * Implement shorthand notation for middleware paths (Raymond Feng)

 * Load middleware and phases from `middleware.json` (Miroslav Bajtoš)

 * Add jscs style check, fix violations found (Miroslav Bajtoš)

 * Clean up .jshintrc (Miroslav Bajtoš)

 * Use `chai` instead of `must` (Miroslav Bajtoš)


2014-11-10, Version 2.3.1
=========================

 * Bump version (Raymond Feng)

 * Fix the test for built-in models on Windows (Raymond Feng)

 * Fix jsdoc (Raymond Feng)


2014-10-27, Version 2.3.0
=========================

 * compiler: fix coding style violations (Miroslav Bajtoš)

 * support coffee-script models and client code (bitmage)


2014-10-22, Version 2.2.0
=========================

 * compiler: support module-relative model sources (Miroslav Bajtoš)

 * Skip definitions of built-in loopback models (Miroslav Bajtoš)

 * package: update dependency versions (Miroslav Bajtoš)

 * Use loopback 2.x in unit tests. (Miroslav Bajtoš)


2014-10-09, Version 2.1.0
=========================

 * Bump version (Raymond Feng)

 * Add support for async boot scripts (Raymond Feng)

 * Clean up jsdoc comments. (Miroslav Bajtoš)

 * Custom rootDir for app config (johnsoftek)

 * compiler: improve merging of Arrays and Objects (Miroslav Bajtoš)

 * config-loader: deeply merge Array and Object vals (Shelby Sanders)

 * gitignore: add Idea's *.iml files (Miroslav Bajtoš)

 * package: Add `jshint` to `devDependencies` (Miroslav Bajtoš)

 * Update contribution guidelines (Ryan Graham)

 * test: ensure sandbox dir is present (Miroslav Bajtoš)

 * test: add `global.navigator` for browser tests (Miroslav Bajtoš)

 * test: increase timeout for browserify (Miroslav Bajtoš)

 * index: fix jshint error (Miroslav Bajtoš)

 * documentation fix (Alex)

 * Fix typo (Fabien Franzen)

 * Implemented modelSources, bootDirs and bootScripts options (Fabien Franzen)


2014-07-22, Version 2.0.0
=========================

 * executor: remove `Base` arg from model function (Miroslav Bajtoš)

 * package: update dependency versions (Miroslav Bajtoš)


2014-07-17, Version v2.0.0-beta3
================================

 * v2.0.0-beta3 (Miroslav Bajtoš)

 * compiler: return a clone of instructions (Miroslav Bajtoš)


2014-07-17, Version 2.0.0-beta2
===============================

 * test: export Int32Array and DataView for browser (Miroslav Bajtoš)

 * v2.0.0-beta2 (Miroslav Bajtoš)

 * Rename `models.json` to `model-config.json` (Miroslav Bajtoš)

 * Remove non-API docs. (Rand McKinney)


2014-06-26, Version 2.0.0-beta1
===============================

 * 2.0.0-beta1 (Miroslav Bajtoš)

 * test: fix jshint warnings (Miroslav Bajtoš)

 * compiler: fix references to loopback (Miroslav Bajtoš)

 * Rename `app.json` to `config.json` (Miroslav Bajtoš)

 * compiler: Sort models topologically (Miroslav Bajtoš)

 * executor: Split model boot into two phases (Miroslav Bajtoš)

 * compiler: Move model-sources cfg to models.json (Miroslav Bajtoš)

 * package: Bump up the version to 2.0.0-dev (Miroslav Bajtoš)

 * Rework model configuration (Miroslav Bajtoš)

 * Remove auto-attach. (Miroslav Bajtoš)

 * Change models.json to configure existing models (Miroslav Bajtoš)


2014-06-26, Version 1.1.0
=========================

 * docs: move hand-written content to README.md (Miroslav Bajtoš)

 * executor: remove direct reference to loopback (Miroslav Bajtoš)

 * Update link to doc (Rand McKinney)

 * package: Fix repository url (Miroslav Bajtoš)

 * Drop peer dep on loopback; add a runtime check (Miroslav Bajtoš)

 * Wrap too long lines (Miroslav Bajtoš)

 * Add disclaimer to JSDoc and small correction. (crandmck)


2014-06-05, Version 1.0.0
=========================

 * First release!
