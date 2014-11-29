Doc Meteor
===========

This is a simple CLI for updating documentation.
This tool is optimized code documentation for `Meteor.js` `packages` - *It looks for package.js*

Examples of docmeteor in use:
* [Power-Queue api](https://github.com/CollectionFS/Meteor-powerqueue/blob/master/api.md)
* [Power-Queue internal api](https://github.com/CollectionFS/Meteor-powerqueue/blob/master/internal.api.md)
* [CollectionFS api](https://github.com/CollectionFS/Meteor-CollectionFS/blob/devel-merge-old/api.md)
* [CollectionFS internal api](https://github.com/CollectionFS/Meteor-CollectionFS/blob/devel-merge-old/internal.api.md)

##Installation:
```
$ npm install -g docmeteor
```

##Usage:
```bash
$ docmeteor
```
This creates two files:
* `api.md` - The exported api
* `internal.api.md` - All code documentation

###Inline comments
Inline comments are comments that only last one line.
```js
// Inline comment with no indent is a `Markdown` comment

  // Inline comment with indent is a normal inline comment
  // and will not be considered as documentation.
```

###Markdown comments
A `Markdown comment` is an inline comment with no indent.
Two or more markdown comments will be considered as documentation and will be added. Use it as literal "in code" markdown documentation style.
```
// #Headline markdown documentation
// _This_ is a *document* test
```

###Block comments
Block comments can use annotations. `docmeteor` reads the `package.js` to find the exported scope.
```
/** This is just a simple method // This is inline comment
  * @method ExportedScope.foo
  */
```

###Current annotations
```js
var types = {
  // Basic descriptors
  '@method': ['name', 'comment'],
  '@property': ['name', 'comment'],
  '@callback': ['name', 'comment'],
  '@where': ['where', 'comment'], // {client|server}, {client}, {server}
  
  '@constructor': ['comment'], // Expect `new`
  '@param': ['type', 'name', 'comment'], // Parametres
  '@return': ['type', 'comment'],
  '@returns': ['type', 'comment'],
  '@reactive': ['comment'], // If a reactive method
  '@deprecated': ['comment'], // Display a deprecation note
  '@type': ['type', 'comment'],
  '@namespace': ['name', 'comment'],
  '@private': ['comment'], // Keep in internal.api.md
  '@public': ['comment'], // Add it to api.md
  '@prototype': ['comment'], // Mark as prototype
  '@todo': ['comment'] // Add tasks only visible in internal.api.md
  '@ejsontype': ['name', 'comment'],
  '@remote': ['comment'], // Mark as Meteor.Methods

  // Could deprecate:
  '@this': ['name', 'comment'],
  '@self': ['name', 'comment'],

  // Could be better implemented or deprecated
  '@see': ['comment'], // TODO: Not used
  '@author': ['name'], // TODO: Not used
  '@const': ['comment'], // TODO: Not used
  '@override': ['comment'], // TODO: Not used
  '@throws': ['type', 'comment'], // TODO: Not used
  '@copyright': ['copyrightText'], // TODO: Not used
  '@extends': ['type', 'comment'], // TODO: Not used
  '@exception': ['type', 'comment'], // TODO: Not used
  '@version': ['version', 'comment'], // TODO: Not used
};
```
*Not all are used it the current layout template, others migth deprecate - making this tool more lightweight*

Contributions are welcome,

Kind regards Morten, aka @raix
