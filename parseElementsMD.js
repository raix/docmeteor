// Filesystem
var fs = require('fs');

var annotator = require('./annotations.js').annotator;

module.exports = function(filename, documentElements, packageObject) {
  // filename where the md should be saved...
  // documentElements is the parsed tree
  // packageObject is from the package.js - if found then only show the public
  // exported api...

  var sourceFileCount = documentElements.length;
  var exported = packageObject && packageObject.exports || {};

  var fileText = '';

  var nbsp = function(len) {
    var text = '';
    for (var i=0; i < len; i++) {
      text += '&nbsp;';
    }
    return text;
  };

  var knownTypes = {
    'number': true,
    'boolean': true,
    'string': true,
    'object': true,
    'function': true,
    'null': true,
    'any': true,
    'array': true,
    'binary': true,
    'arraybuffer': true,
    'float32array': true,
    'float64array': true,
    'int32array': true,
    'uint8array': true,
    'buffer': true
  };

  var resolveTypeReference = function(ref) {
    // TODO: Do a real lookup for other types of documentation
    return '#' + ref;
  };

  var linkToType = function(t) {
    var types = (t || '').replace('{', '').replace('}', '').split('|');
    var output = [];
    for (var ti = 0; ti < types.length; ti++) {
      var oneType = types[ti].toLowerCase();
      if (!knownTypes[oneType] && oneType[0] !== '[') { // not [To](link)
        // We have to link to this object? but allow user to do linking
        output.push('[' + types[ti] + '](' + resolveTypeReference(types[ti]) + ')'); 
      } else {
        // We return the original
        output.push(types[ti]);
      }
    }
    return '{' + output.join('|') + '}';
  };

  var renderAST = function(ast, sourceFilename) {
    var headline = '';
    var body = '';
    var reference = '';
    var level1 = '###';

    var name = ast['@callback'] && ast['@callback'].name ||
            ast['@method'] && ast['@method'].name ||
            ast['@property'] && ast['@property'].name || '';

    var scopes = name.split('.');
    var prettyName = '';
    var classNames = [];
    var isPrototype = (scopes.length > 1) ? scopes[scopes.length-2] == 'prototype' : false;
    for (var p = 0; p < scopes.length-1; p++) {
      if (scopes[p] !== 'prototype') {
        if (!isPrototype) {
          prettyName += scopes[p];
        } else if (p === 0) {
          prettyName += scopes[p].toLowerCase();
        } else {
          prettyName += scopes[p][0] + scopes[p].substr(1).toLowerCase();
        }
        classNames.push(scopes[p]);
      }
    }
    protoName = scopes.pop();
    if (ast['@remote']) {
      prettyName = 'Meteor.method:' + prettyName;
    } else {
      prettyName = (prettyName)? '*' + prettyName + '*.' + protoName : name;
    }

    // Title can be a method or variable?
    headline += '-\n\n' + level1 + ' ';

    headline += '<a name="' + name + '"></a>';

    if (ast['@constructor']) headline += 'new ';
    headline += prettyName;
    if (ast['@method']) {
      headline += '(';
      if (ast['@param']) {
        var paramList = [];
        for (var i = 0; i < ast['@param'].length; i++) {
          if (ast['@param'][i].optional || ast['@param'][i].default) {
            var def = ''; // (ast['@param'][i].default) ? '=' + ast['@param'][i].default : '';
            paramList.push('[' + ast['@param'][i].name + def + ']');
          } else {
            paramList.push(ast['@param'][i].name);
          }
        }
        headline += paramList.join(', ');
      }
      headline += ')';
    }

    if (ast['@property']) {
      headline += ' ' + ast['@type'].name;
    }

    headline += nbsp(2) + '<sub><i>' + ast['@where'] + '</i></sub>';

    headline += ' ' + level1 + '\n\n';
    
    var typeName = (ast['@method']?'method':(ast['@callback'])?'callback':'property');

    if (ast['@deprecated']) {
      body += '> __Warning!__\n';
      body += '> This ' + typeName + ' "' + name + '" has deprecated from the API\n';
      // add note from dev
      if (ast['@deprecated'] !== true && ast['@deprecated'].length) {
        body += '> ' + ast['@deprecated'] + '\n\n';
      }
    }

    if (ast['@private']) {
      body += '*This ' + typeName + ' is private*\n';
    }
    
    if (ast['@remote']) {
      body += '*This ' + typeName + ' is a remote method*\n';
    }

    if (classNames.length > 0) {
      var prototypeText = (ast['@prototype'] || isPrototype)? '`prototype` of ':'';
      body += '*This ' + typeName + ' __' + protoName + '__ is defined in ' + prototypeText + '`' + classNames.join('.') + '`*\n';
    }
    
    var ref = ast['@reference'];
    if (ref) {
      reference += '\n';
      reference += '> ```';
      reference += '' + ref.text + '';
      reference += '```';
      // Make a small link to the actual source
      reference += ' [' + sourceFilename + ':' + ref.line + '](' + sourceFilename + '#L' + ref.line + ')\n';
    }

    if (ast['@ejsontype']) {
      body += 'Adds custom EJSON-type: `' + ast['@ejsontype'].name + '` ';
      body += ast['@ejsontype'].comment || '';
      body += '\n';
    }

    if (ast['@param']) {
      body += '\n__Arguments__\n\n';

      for (var i = 0; i < ast['@param'].length; i++) {
        var param = ast['@param'][i];
        // paramList.push(ast['@param'][i].name);

        body += '* __' + param.name + '__';

        body += ' *' + linkToType(param.type || '{any}') + '*  ';

        if (param.default) {
          body += '(Optional, Default = ' + param.default + ')';
        } else if (param.optional) { 
          body += '(Optional)';
        }  
        
        body += '\n';

        if (param.comment) {
          if (param.comment.slice(0, 1) === '-') {
            param.comment = param.comment.slice(1);
          }
          if (param.comment.slice(0, 1) !== ' ') {
            param.comment = ' ' + param.comment;
          }
          body += '\n' + param.comment + '\n\n';
        }

        if (param.children) {
          var children = param.children;
          for (var c = 0; c < children.length; c++) {
            var child = children[c];
            
            body += '    * __' + child.name + '__';

            body += ' *' + linkToType(child.type || '{any}') + '*  ';

            if (child.default) {
              body += '(Optional, Default = ' + child.default + ')';
            } else if (child.optional) {
              body += '(Optional)';
            }
            
            body += '\n';
            
            if (child.comment) {
              if (child.comment.slice(0, 1) === '-') {
                child.comment = child.comment.slice(1);
              }
              body += '\n    ' + child.comment + '\n\n';
            }
          }
        }

      }

      if (returns ||
              (todo && !packageObject && todo.length > 0)) {
        body += '\n-\n';
      }
    }

    var returns = ast['@return'] || ast['@returns'];
    if (returns) {
      body += '\n';
      body += '__Returns__';
      body += '  ';
      body += '*' + (returns.type || '{any}') + '*';
      if (ast['@reactive']) body += '  __(is reactive)__';
      body += '\n';
      if (returns.comment) body += returns.comment + '\n';
      if ((todo && !packageObject && todo.length > 0)) {
        body += '\n-\n';
      }
    }

    // If in the internal documentation show the todo list
    var todo = ast['@todo'];
    if (todo && !packageObject && todo.length > 0) {
      body += '\n__TODO__\n';
      body += '```\n';
      for (var ti = 0; ti < todo.length; ti++) {
        if (todo[ti].comment) body += '* ' + todo[ti].comment + '\n';
      }
      body += '```\n';
    }

    return {
      headline: headline,
      body: body,
      reference: reference
    };
  };

  for (var currentFileIndex = 0; currentFileIndex < sourceFileCount; currentFileIndex++) {
    var fileElements = documentElements[currentFileIndex];
    var sourceFilename = fileElements.filename;
    var sourceWhere = fileElements.where;
    var elements = fileElements.elements;


    // console.log('FILE: ' + currentFileIndex);
    var countExported = 0;
    var textResult = '';

    var anno = new annotator(sourceFilename, sourceWhere);

    for (var currentElementIndex = 0; currentElementIndex < elements.length; currentElementIndex++) {
      var statements = elements[currentElementIndex];
      if (statements['block-comment'] && statements['block-comment'].length > 1) {
        anno.reset();
        var getNextCodeElement = function() {
          var i = currentElementIndex+1;
          while (i < elements.length && !elements[i]['code']) {
            i++;
          }
          return elements[i];
        };

        var getCodeReference = function() {
          var next = getNextCodeElement(); // elements[currentElementIndex+1];
          if (next && next['code']) {
            var nextLines = next['code'];
            if (nextLines.length) {
              var text = nextLines[0].text;
              // function foo();
              text = text.split('function ')[0].split('(')[0];
              // var bar = function()
              text = text.replace(' =', '=').replace('= ', '=');
              var equal = text.split('=');
              var name = equal[0];
              return {
                name: name,
                text: nextLines[0].text,
                line: nextLines[0].line
              };
            }
          }
        };

        var before = '';
        var after = '';
        var doAfter = false;
        var lines = statements['block-comment'];
        for (var l = 0; l < lines.length; l++) {
          var line = lines[l];
          var text = line.text;

          // Remove the * and posible whitespace
          var endOfJunk = 0;

          // Pass by the whitespaces
          while (text[endOfJunk] === ' ' || text[endOfJunk] === '*')
            endOfJunk++;

          // Remove any junk
          text = text.substr(endOfJunk);

          if (line.annotations) {
            doAfter = true;
            for (var a in line.annotations) {
              if (line.annotations.hasOwnProperty(a)) {
                anno.add(a, line.annotations[a], line.line);
              }
            }
          } else if (text.length) {
            if (doAfter) {
              after += text + '\n';
            } else {
              before += text + '\n';
            }
          } else {
            after += '\n';
          }
        }

        var ref = getCodeReference();
        if (!ref) {
          // This is a standalone comment...
          //
          // console.log('Filename: ' + sourceFilename);
          // console.log(elements[currentElementIndex+1]);
        } else {
          anno.addName(ref.name);
          anno.addReference(ref.line, ref.text);            
        }

        var ast = anno.getAST();
        // If we have a package object we only show the exported api...
        var isExported = ast['@namespace'] && exported[ast['@namespace'].name] || ast['@public'];
        var isPrivate = ast['@private'];
        
        if ((isExported && !isPrivate)|| !packageObject) {
          var rendered = renderAST(ast, sourceFilename);
          var text = rendered.headline;
          text += (before)? '```\n' + before + '```\n' : '';
          text += rendered.body + after + rendered.reference + '\n\n';

          countExported++;
          textResult += text;
        } else {
          // console.log('NAMESPACE: ' + ast['@namespace'].name);
        }
        // TODO check if the name is in the exported scope
        // If none is exported from this file we return an empty string - not
        // even a single comment.
        // If a just a single method is exported all md inline is also returned
        // but none of the not exported symbol comments...
      }
      if (statements['markdown-comment']) {
        var lines = statements['markdown-comment'];
        // We skip single line markdown comments
        if (lines.length > 1) {
          if (textResult.length) textResult += '\n-\n';
          for (var l = 0; l < lines.length; l++) {
            var line = lines[l] || { text: '' };
            textResult += line.text + '\n';
          }
      
        }
      }
    }
    if (countExported > 0) {
      if (!packageObject) {
        fileText += '***\n\n';
        fileText += '__File: ["' + sourceFilename + '"](' + sourceFilename + ') ';
        fileText += 'Where: {' + sourceWhere.join('|') + '}__\n\n***\n\n';
        if (textResult.slice(0, 3) === '-\n\n') {
          textResult = textResult.slice(3);
        }
      }
      
      fileText += textResult;
    }

  }
  console.log('Creating "' + filename + '"');
  var topText = '';
  if (packageObject && packageObject.describe) {
    if (packageObject.describe.name) {
      topText += '## ' + packageObject.describe.name + ' Public API ##\n\n';
    }
    if (packageObject.describe.summary) {
      topText += packageObject.describe.summary + '\n\n';
    }
  } else {
    topText += '## Public and Private API ##\n\n';
  }
  topText += '_API documentation automatically generated by [docmeteor](https://github.com/raix/docmeteor)._\n\n';
  fs.writeFileSync(filename, topText + fileText, 'utf8');
};
