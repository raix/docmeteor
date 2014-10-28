// Filesystem
var fs = require('fs');
// Path
var path = require('path');
// Get current path
var currentPath = path.resolve();
// Path of this script - Used by creating app from templates
var scriptPath = path.dirname(require.main.filename);

var packageFolder = fs.existsSync('package.js');

var parseSource = require('./parseSource.js');
// TODO: make markdown files for api - internal/exported...
var parseElementsMD = require('./parseElementsMD.js');

var packageJS = {};


// If the package.js is found then load and use it to create internal and
// exported markdown file api's
//
// If package.js is not found the we should scan the folder at fire the parser
// up...
// but for now we simply message the user that we need the package.js



if (packageFolder) {
  console.log('Package.js found, parsing...');
  // Prepare the package.js for node.js docmeteor...
  var prependJS = 'var exportObject = { npmDepend: [] }, Npm = {depends: exportObject.npmDepend.push }; Package = {describe: function(obj) {exportObject.describe = obj;},on_use: function(fn) {exportObject.on_use = fn;},onUse: function(fn) {exportObject.onUse = fn;},on_test: function(fn) {exportObject.on_test = fn;}};\n';
  var appendJS = '\nmodule.exports = exportObject;';

  var homepath = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;

  var destinationFilename = path.join(homepath, '.codepackage.js');
  // Ok we are in a package folder, we try to load the package.js...
  var code = fs.readFileSync('package.js', 'utf8');
  // Load the code and append a simple export
  code = prependJS + code + appendJS;
  // Copy the package.js into the scriptPath + 'codepackage.js'
  fs.writeFileSync(destinationFilename, code, 'utf8');
  // Load the codepackage.js
  packageJS = require(destinationFilename);

  // This object will contain the package information as an object
  var packageObject = {};

  // Expects a string or array - returns array
  var toArray = function(textArray) {
    if (textArray === ''+textArray) {
      return [textArray];
    }
    return textArray;
  };

  // Extends where - unifying multiple file uses
  var extendWhere = function(current, where) {
    var result = (current)?current:[];
    for (var b = 0; b < where.length; b++) {
      result.push(where[b]);
    }
    return result;
  };

  // Add deps to the package object
  var addToPackageObject = function(name, deps, where) {
    var deps = toArray(deps);
    var where = (where)?toArray(where):['client', 'server'];
    // Make sure name is created
    packageObject[name] = (packageObject[name])?packageObject[name]:{};
    for (var i = 0; i < deps.length; i++) {
      packageObject[name][deps[i]] = extendWhere(packageObject[name][deps[i]], where);
    }
  };

  // Package js will use this api to fill the package object
  meteorPackageApi = {
    use: function(packages, where) {
      addToPackageObject('use', packages, where);
    },
    add_files: function(files, where) {
      addToPackageObject('files', files, where);
    },
    addFiles: function(files, where) {
      addToPackageObject('files', files, where);
    },
    export: function(symbols, where) {
      addToPackageObject('exports', symbols, where);
    },
    imply: function(packages, where) {
      addToPackageObject('imply', packages, where);
    },
    versionsFrom: function() { /* NOOP */ }
  };

  // Get the setup for usage
  var packageOnUse = (packageJS.on_use || packageJS.onUse);
  packageOnUse(meteorPackageApi);

  packageObject.describe = packageJS.describe;

  // Uncomment if you want to see the package object
  //console.log(packageObject);

  documentElements = [];

  if (packageObject.files) {
    for (var filename in packageObject.files) {
      var where = packageObject.files[filename];
      if (packageObject.files.hasOwnProperty(filename)) {
        documentElements.push(parseSource(filename, where));
      }
    }
    // Uncomment to see the document element tree
    // console.log('DOCUMENT ELEMENTS:___________');
    // console.log(JSON.stringify(documentElements, null, ' '));

    // Create the exported api.md
    parseElementsMD('api.md', documentElements, packageObject);
    // Create the internal api markdown
    parseElementsMD('internal.api.md', documentElements);
  } else {
    console.log('No files in package.js');
    process.exit();
  }

} else {
  // Load all js files into parseSource - should we do a recursive search excluding .* folders and files?
  // TODO: Add source files etc. for apps... At the moment we require package.js
  console.log('Sorry, I dont work outside Meteor.js package folders yet..');
}

module.exports = {};