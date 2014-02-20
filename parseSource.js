// Parses the source into an object structure:
// {
//   "filename": "power-queue.js",
//   "where": [
//    "client",
//    "server"
//   ],
//   "elements": [
//    {
//      {
//       "line": 11,
//       "text": "* @param {number} [options.maxFailures = 5] Limit retries of failed tasks",
//       "annotations": {
//        "@param": {
//         "type": "{number}",
//         "name": "[options.maxFailures = 5]",
//         "comment": "Limit retries of failed tasks"
//        }
//       }
//      },
//      {
//       "line": 12,
//       "text": "* @param { number | string } [options.text = ' '] Hmm, comment",
//       "annotations": {
//        "@param": {
//         "type": "{ number | string }",
//         "name": "[options.text = ' ']",
//         "comment": "Hmm, comment"
//        }
//       }
//      }
//     ]
//    },
//    {
//     "code": [
//      {
//       "line": 48,
//       "text": "var _maxFailures = new reactiveProperty(options && options.maxFailures || 5);"
//      }
//     ]
//    },
//    {
//     "inline-comment": [
//      {
//       "line": 50,
//       "text": "Name / title of this queue - Not used - should deprecate"
//      }
//     ]
//    },
//    {
//     "code": [
//      {
//       "line": 51,
//       "text": "var title = options && options.name || "
//      }
//     ]
//    },
//    {
//     "text-single": [
//      {
//       "line": 51,
//       "text": "Queue"
//      }
//     ]
//    },


// Filesystem
var fs = require('fs');
// Annotations object
var commands = require('./annotations.js').types;

var parseSource = function(code, filename, where) {
  // true if we are inside a block comment
  var inComment = false;
  // true if we are inside // - this could be in code or block comment
  var inInlineComment = false;
  // mark if theres a whitespace before a inline comment
  var markdownComment = false;
  // true if we are inside "" in a code
  var inTextSingle = false;
  // true if we are inside '' in a code
  var inTextDouble = false;
  // true if we are inside "" in a comment
  var inCommentTextSingle = false;
  // true if we are inside '' in a comment
  var inCommentTextDouble = false;
  // > 0 if we are inside [] in a comment
  var inCommentBracket = 0;
  // > 0 if we are inside {} in a comment
  var inCommentHandlebar = 0;
  // > 0 if we are inside () in a comment
  var inCommentParantes = 0;
  // in comment md code
  var inCommentCodeTag = false;
  // current word is used for parsing annotations
  var currentWord = '';
  // i is the char index - we only run through the code once...
  var i = 0;
  // object to push into element
  var currentObject; // { type: '', text: ''}
  // Tokens are "/*" "*/" "//"
  var currentIsToken = false;
  // elements like code, text-single, text-double, inline-comment, block-comment
  var elements = [];
  // current annotation eg. "@param"
  var currentAnnotation = '';
  // array of annotation parametres
  var currentAnnotationParams = [];
  // object of annotations
  var currentAnnotations = {};
  // Force into new object
  var forceNewObject = false;
  // Marker for last item
  var lastStatement = '';

  // Test future string, often only one or two chars long
  var isNext = function(text) {
    var isMatch = false;
    // Make a simple test
    if (code[i] == text[0]) {
      isMatch = true;
      for (var a = 1; a < text.length && isMatch; a++) {
        if (code[i + a] != text[a]) {
          isMatch = false;
        }
      }
    }
    return isMatch;
  };

  // Test for white space, marks if the whitespace should be trimmed
  var isWhiteSpace = function(pChar) {
    var c = pChar || code[i];
    var inCapsule = inCommentBracket || inCommentHandlebar || inCommentParantes; // || inCommentCodeTag; TODO: Detect if asterisk * is used
    return ((c == ' ' || c == '\t') && !inCommentTextSingle && !inCommentTextDouble && !inCapsule);
  };

  // An element can have multiple statements and even in a single line
  var currentStatement = 0;
  // Why we have a seperated file specific line number
  var currentLineNumber = 1;
  // This function creates the elements and statement objects as needed
  // it also splits source pr. line and pr. statement
  // the limitWhiteSpace is only set true by the code element type - making it
  // trim the text for whitespaces
  var addCharToType = function(c, type, property, limitWhiteSpace) {

    var statement = currentObject && currentObject[type] && currentObject[type][currentStatement];
    var text = statement && statement[property] || '';
    var last = text && text[text.length-1] || ' ';
    var lastIsWhiteSpace = isWhiteSpace(last);
    var chIsWhiteSpace = isWhiteSpace(c);
    var doLimitWhiteSpace = (limitWhiteSpace && chIsWhiteSpace && lastIsWhiteSpace);
    var firstIsWhiteSpace = (chIsWhiteSpace && !text.length);

    if (c == '\n') {
      // Increase the line number
      currentLineNumber++;
      if (statement) {
        // Only make a new statement if statement exists
        currentStatement++;
      }
    } else {
      text += ((doLimitWhiteSpace || firstIsWhiteSpace) ? '' : c);

      // Check if we have got some text to add
      if (text.length) {
        // Check if the currentObject is rigged
        if (!currentObject) {
          currentObject = {};
          currentObject[type] = [];
        }
        // Check if type is the same if not then push and create a new
        if (!currentObject[type] || forceNewObject) {
          forceNewObject = false;
          elements.push(currentObject);
          currentStatement = 0;
          currentObject = {};
          currentObject[type] = [];
        }
        // Check that the statement exists
        if (!currentObject[type][currentStatement]) {
          currentObject[type][currentStatement] = {line: currentLineNumber};
        }

        // We add the property data to the node        
        currentObject[type][currentStatement][property] = text;
        // We set the current command if set
        if (currentAnnotation && !currentObject[type][currentStatement].annotations) {
          currentObject[type][currentStatement].annotations = currentAnnotations;
        }

      }

    }

    // We split code at ";" endings
    if (limitWhiteSpace && c == ';') {
      if (statement) {
        // Only make a new statement if statement exists
        currentStatement++;
      }      
    }

  };

  // This function adds the current char to the fitting element statement
  var addChar = function(pChar) {
    // We skip if char is part of a token
    if (!currentIsToken) {
      // if no char is passed on to us we grab the char at the cursor
      var c = pChar || code[i];

      // Rigs annotations
      parseAnnotations(c);

      // Normal comment
      if (inComment && !inInlineComment) {
        addCharToType(c, 'block-comment', 'text');
      }
      // Pure inline-comment - we could have line comments in block comments
      if (inInlineComment && !inComment && !markdownComment) {
        addCharToType(c, 'inline-comment', 'text');
      }
      if (inInlineComment && !inComment && markdownComment) {
        addCharToType(c, 'markdown-comment', 'text');
      }
      // This is a inline comment inside a block comment, we add this as comment
      // inside the block comment element
      if (inInlineComment && inComment) {
        addCharToType(c, 'block-comment', 'comment');
      }
      // This is a text string inside ''
      if (inTextSingle) {
        addCharToType(c, 'text-single', 'text');
      }
      // This is a text string inside ""
      if (inTextDouble) {
        addCharToType(c, 'text-double', 'text');
      }
      // So if not a comment or text it must be code?
      if (!inComment && !inInlineComment && !inTextSingle && !inTextDouble) {
        addCharToType(c, 'code', 'text', true);      
      }

    }

  };

  var parseAnnotations = function(c) {
    // We are on the last item
    var lastItem = (commands[currentAnnotation] && currentAnnotationParams.length == commands[currentAnnotation].length);
    // If next is newline or end of block-comment we have to fake a whitespace
    if (code[i+1] == '\n' || (code[i+1] == '*' && code[i+2] == '/')) {
      currentWord += c;
      c = '';
    }
    // If new word in comment block
    if ((!c || isWhiteSpace(c)) && inComment && !inInlineComment && !inCommentParantes && !inCommentBracket && !inCommentHandlebar) {
      // If we are not currently on an annotation we will start if one is passed
      if (!currentAnnotation && commands[currentWord]) {
        // Set the annotation to the current word
        currentAnnotation = currentWord;
      } else {
        // If we are in command mode
        if (currentAnnotation) {
          // If we are at last allowed item we append the text
          if (lastItem) {
            currentWord = currentAnnotationParams.pop() + ' ' + currentWord;
          }
          // Push the word to annotation parametres
          currentAnnotationParams.push(currentWord);
        }
      }
      // Start a new word
      currentWord = '';
    } else {
      // Add the char to the current word
      currentWord += c;
    }

    // We set the real object
    if (!c && commands[currentAnnotation]) {
      // We build a nice object up in result
      var result = {};
      // Pr default we set the name, but should really be set by the parametres
      var name = 'unknown';
      // Iterate through the parametres
      for (var index = 0; index < currentAnnotationParams.length; index++) {
        name = commands[currentAnnotation][index] || 'unknown';
        result[name] = currentAnnotationParams[index];
      }
      // Mount the result on the annotations object
      // console.log(currentAnnotation);
      currentAnnotations[currentAnnotation] = result;
    }
  };

  // Here we loop through the code
  while (i < code.length) {
    // Reset is token
    currentIsToken = false;

    // If \ is detected then skip a char
    if (isNext('\\')) {
      addChar();
      i++;
    }

    // If we got a newline then reset inlinecomment and annotation
    if (isNext('\n')) { // Is newline
      if (inInlineComment) {
        currentStatement++;
        
        inCommentBracket = 0;
        inCommentHandlebar = 0;
        inCommentParantes = 0;        
      }
      inInlineComment = false;
      markdownComment = false;
      // Reset text markers
      inTextSingle = false;
      inTextDouble = false;
      inCommentTextSingle = false;
      inCommentTextDouble = false;

      // Reset command
      // parseAnnotations();
      currentAnnotation = '';
      currentAnnotationParams = [];
      currentAnnotations = {};    
    } else {

      if (inComment || inInlineComment) {
        if (!inCommentTextDouble && !inCommentTextSingle) {

          if (isNext('(')) {
            inCommentParantes++;
          }
          if (isNext(')')) {
            inCommentParantes--;
            if (inCommentParantes < 0) {
              inCommentParantes = 0;
            }
          }
          if (isNext('[')) {
            inCommentBracket++;
          }
          if (isNext(']')) {
            inCommentBracket--;
            if (inCommentBracket < 0) {
              inCommentBracket = 0;
            }
          }
          if (isNext('{')) {
            inCommentHandlebar++;
          }
          if (isNext('}')) {
            inCommentHandlebar--;
            if (inCommentHandlebar < 0) {
              inCommentHandlebar = 0;
            }
          }
          
        } // EO not in comment text


        if (isNext('"') && !inCommentTextSingle) {
          inCommentTextDouble = !inCommentTextDouble;
        }
        if (isNext("'") && !inCommentTextDouble) {
          inCommentTextSingle = !inCommentTextSingle;
        }
      } else { // We are not in a comment or inline-comment...
        if (isNext('"') && !inTextSingle) {
          i++;
          inTextDouble = !inTextDouble;
        }
        if (isNext("'") && !inTextDouble) {
          i++;
          inTextSingle = !inTextSingle;
        }
      }

      if (isNext('```') && inComment) {
        inCommentCodeTag = !inCommentCodeTag;
        if (!inCommentCodeTag) lastStatement = 'comment-code';
      }

      if (isNext('/*') && !inTextSingle && !inTextDouble && !inInlineComment && !inComment) {
        i++;
        inComment = true;
        currentIsToken = true;
        forceNewObject = lastStatement === 'block-comment';
      }

      if (isNext('*/') && !inTextSingle && !inTextDouble && inComment) { // && !inInlineComment) {
        i++;
        inComment = false;
        currentIsToken = true;
        inCommentCodeTag = false;
        lastStatement = 'block-comment';
      }

      if (isNext('//') && !inTextSingle && !inTextDouble && !inCommentBracket && !inCommentHandlebar && !inCommentParantes && !inCommentCodeTag) {
        if (!inInlineComment && !inComment) markdownComment = (code[i-1] == '\n' || i == 0);
        i++;
        currentIsToken = true;
        inInlineComment = true;
        lastStatement = (inComment)?'block-comment':'inline-comment';
      }

      // Reset in comment stuff
      if (currentIsToken) {
        inCommentBracket = 0;
        inCommentHandlebar = 0;
        inCommentParantes = 0;
      }

    } // EO not new line

    addChar();

    i++;
  }

  // This call will add the last line to elements
  elements.push(currentObject);

  return elements;
};


var parseSourceFile = function(filename, where) {
  if (fs.existsSync(filename)) {
    var code = fs.readFileSync(filename, 'utf8');
    var elements = new parseSource(code, where);
    return {
      filename: filename,
      where: where,
      elements: elements
    };
  } else {
    console.log('Error: Could not load file: "' + filename + '", file not found!');
    process.exit();
  }

};

module.exports = parseSourceFile;