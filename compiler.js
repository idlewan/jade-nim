'use strict';

var jade = require('jade');
var filters = jade.filters;
var doctypes = jade.doctypes;
var runtime = jade.runtime;
var selfClosing = jade.selfClosing;

var parseJSExpression = require('character-parser').parseMax;
var constantinople = require('constantinople');

function isConstant(src) {
    return constantinople(src, {
        jade: runtime,
        'jade_interp': undefined
    });
}

function toConstant(src) {
    return constantinople.toConstant(src, {
        jade: runtime,
        'jade_interp': undefined
    });
}

function errorAtNode(node, error) {
    error.line = node.line;
    error.filename = node.filename;
    return error;
}

/**
 * Initialize `Compiler` with the given `node`.
 *
 * @param {Node} node
 * @param {Object} options
 * @api public
 */

var Compiler = module.exports = function Compiler(node, options) {
        this.options = options = options || {};
        this.node = node;
        this.hasCompiledDoctype = false;
        this.hasCompiledTag = false;
        this.nim_indents = 1;
        this.terse = false;
        this.mixins = {};
        if (options.doctype) this.setDoctype(options.doctype);
    };

/**
 * Compiler prototype.
 */

Compiler.prototype = {

    /**
     * Compile parse tree to JavaScript.
     *
     * @api public
     */

    compile: function() {
        this.buf = [];
        this.visit(this.node);

        if (!this.dynamicMixins) {
            // if there are no dynamic mixins we can remove any un-used mixins
            var mixinNames = Object.keys(this.mixins);
            for (var i = 0; i < mixinNames.length; i++) {
                var mixin = this.mixins[mixinNames[i]];
                if (!mixin.used) {
                    for (var x = 0; x < mixin.instances.length; x++) {
                        for (var y = mixin.instances[x].start ;
                                 y < mixin.instances[x].end ;
                                 y++) {
                            this.buf[y] = '';
                        }
                    }
                }
            }
        }

        return this.buf.join('\n');
    },

    /**
     * Sets the default doctype `name`. Sets terse mode to `true` when
     * html 5 is used, causing self-closing tags to end with ">" vs "/>",
     * and boolean attributes are not mirrored.
     *
     * @param {string} name
     * @api public
     */

    setDoctype: function(name) {
        this.doctype = doctypes[name.toLowerCase()] || '<!DOCTYPE ' + name + '>';
        this.terse = this.doctype.toLowerCase() == '<!doctype html>';
        this.xml = 0 == this.doctype.indexOf('<?xml');
    },

    buffer_interpolate: function(str) {
        var match = /(\\)?([#!]){((?:.|\n)*)$/.exec(str);
        if (match) {
            this.buffer(str.substr(0, match.index));
            if (match[1]) { // escape
                this.buffer(match[2] + '{');
                this.buffer_interpolate(match[3]);

                return;

            } else {
                var rest = match[3];
                var range = parseJSExpression(rest);
                var code = ('!' == match[2] ? '' : 'jade.escape') +
                  //"(if (jade_interp = " + range.src + '; jade_interp) == nil: "" else: jade_interp)';
                    "($(" + range.src + '))';
                this.bufferExpression(code);
                this.buffer_interpolate(rest.substr(range.end + 1));

                return;
            }
        }

        // else, hasn't matched
        this.buffer(str);
    },

    /**
     * Buffer the given `str` exactly as is or with interpolation
     *
     * @param {String} str
     * @param {Boolean} interpolate
     * @api public
     */

    buffer: function(str) {
        str = JSON.stringify(str);
        str = str.substr(1, str.length - 2);

        if (this.lastBufferedIdx == this.buf.length) {
            if (this.lastBufferedType === 'code') {
                this.lastBuffered += ' & "';
            }
            this.lastBufferedType = 'text';
            this.lastBuffered += str;
            this.buf[this.lastBufferedIdx - 1] = this.getNimIndents() + 
                'jade_buf.add(' + this.bufferStartChar + this.lastBuffered + '")'
        } else {
            this.buf.push(this.getNimIndents() + 'jade_buf.add("' + str + '")');
            this.lastBufferedType = 'text';
            this.bufferStartChar = '"';
            this.lastBuffered = str;
            this.lastBufferedIdx = this.buf.length;
        }
    },

    /**
     * Buffer the given `src` so it is evaluated at run time
     *
     * @param {String} src
     * @api public
     */

    bufferExpression: function(src) {
        if (isConstant(src)) {
            return this.buffer('$' + toConstant(src) + '')
        }

        if (this.lastBufferedIdx == this.buf.length) {
            if (this.lastBufferedType === 'text') {
                this.lastBuffered += '"';
            }
            //this.lastBuffered += ' + (' + src + ')';
            this.lastBuffered += ' & $(' + src + ')';
            this.buf[this.lastBufferedIdx - 1] = this.getNimIndents() + 
                'jade_buf.add(' + this.bufferStartChar + this.lastBuffered + ')'

        } else {

            this.buf.push(this.getNimIndents() + 'jade_buf.add(' + src + ')');
            this.bufferStartChar = '';
            this.lastBuffered = '$(' + src + ')';
            this.lastBufferedIdx = this.buf.length;
        }
        this.lastBufferedType = 'code';
    },

    /**
     * Get the spaces for the current nimrod code indentation
     */

    getNimIndents: function() {
        var str = '';
        for (var i = 0; i < this.nim_indents; i++) {
            str += '  ';
        }
        return str;
    },

    jsToNim: function(val) {},

    replaceSingleQuotes: function(str) {
        // replace ' quotes by " quotes
        return str.replace(/'([^']*[^\\])'|"([^"]*[^\\])"|'()'|"()"/g, '"$1"');
    },


    /**
     * Visit `node`.
     *
     * @param {Node} node
     * @api public
     */

    visit: function(node) {
        this.visitNode(node);
    },

    /**
     * Visit `node`.
     *
     * @param {Node} node
     * @api public
     */

    visitNode: function(node) {
        return this['visit' + node.type](node);
    },

    /**
     * Visit case `node`.
     *
     * @param {Literal} node
     * @api public
     */

    visitCase: function(node) {
        this.buf.push(this.getNimIndents() + 'case (' + node.expr + ')');
        this.visit(node.block);
    },

    /**
     * Visit when `node`.
     *
     * @param {Literal} node
     * @api public
     */

    visitWhen: function(node) {
        if ('default' == node.expr) {
            this.buf.push(this.getNimIndents() + 'else:');
        } else {
            this.buf.push(this.getNimIndents() + 'of ' + node.expr + ':');
        }
        if (node.block) {
            this.nim_indents += 1;
            this.visit(node.block);
            this.nim_indents -= 1;
        }
        this.buf.push(this.getNimIndents());
    },

    /**
     * Visit literal `node`.
     *
     * @param {Literal} node
     * @api public
     */

    visitLiteral: function(node) {
        this.buffer(node.str);
    },

    /**
     * Visit all nodes in `block`.
     *
     * @param {Block} block
     * @api public
     */

    visitBlock: function(block) {
        var len = block.nodes.length;

        for (var i = 0; i < len; ++i) {

            this.visit(block.nodes[i]);
            // Multiple text nodes are separated by newlines
            if (block.nodes[i + 1] && block.nodes[i].isText && block.nodes[i + 1].isText) {
                this.buffer('\n');
            }
        }
    },

    /**
     * Visit a mixin's `block` keyword.
     *
     * @param {MixinBlock} block
     * @api public
     */

    visitMixinBlock: function(block) {
        this.buf.push(this.getNimIndents() + 'jade_block');
    },

    /**
     * Visit `doctype`. Sets terse mode to `true` when html 5
     * is used, causing self-closing tags to end with ">" vs "/>",
     * and boolean attributes are not mirrored.
     *
     * @param {Doctype} doctype
     * @api public
     */

    visitDoctype: function(doctype) {
        if (doctype && (doctype.val || !this.doctype)) {
            this.setDoctype(doctype.val || 'default');
        }

        if (this.doctype) {
            this.buffer(this.doctype);
        }
        this.hasCompiledDoctype = true;
    },

    /**
     * Visit `mixin`, generating a function that
     * may be called within the template.
     *
     * @param {Mixin} mixin
     * @api public
     */

    visitMixin: function(mixin) {
        var name = 'jade_mixins_';
        var args = mixin.args || '';
        var block = mixin.block;
        var attrs = mixin.attrs;
        var attrsBlocks = mixin.attributeBlocks;
        var pp = this.pp;
        var dynamic = mixin.name[0]==='#';
        var key = mixin.name;
        if (dynamic) {
            this.dynamicMixins = true;
        }
        //name += (dynamic ? mixin.name.substr(2, mixin.name.length-3): mixin.name);
        if (dynamic) {
            name += "FIX NEEDED FOR DYNAMIC MIXIN NAMES";
        }
        name += mixin.name;


        this.mixins[key] = this.mixins[key] || {used: false, instances: []};
        if (mixin.call) {
          this.mixins[key].used = true;
          if (block || attrs.length || attrsBlocks.length) {

            var call_str = this.getNimIndents() + name + '(';

            if (attrsBlocks.length) {
              if (attrs.length) {
                var val = this.attrs(attrs);
                attrsBlocks.unshift(val);
              }
              this.buf.push('FIXNEEDEDattributes: jade.merge([' + attrsBlocks.join(',') + '])');
            } else if (attrs.length) {
              var val = this.attrs(attrs);
              this.buf.push('FIXNEEDEDattributes: ' + val);
            }

            if (args) {
              args = this.replaceSingleQuotes(args);
              call_str += args;
            }
            call_str += '):';
            this.buf.push(call_str);

            if (block) {
              this.nim_indents += 1;
              this.visit(block);
              this.nim_indents -= 1;
            }
            this.buf.push(''); // prevent following stuff from appending to the same buf line.

          } else {
            args = this.replaceSingleQuotes(args);
            this.buf.push(this.getNimIndents() + name + '(' + args + '):');
            this.nim_indents += 1;
            this.buf.push(this.getNimIndents() + 'discard');
            this.nim_indents -= 1;
          }
        } else {
          var mixin_start = this.buf.length;
          if (args) {
              args += ': string, '
          }
          this.buf.push(this.getNimIndents() + 'template ' + name + '(' + args + 'jade_block: stmt): stmt {.dirty.} =');
          this.nim_indents += 1;
          //this.buf.push(this.getNimIndents() + 'var block = (this && this.block), attributes = (this && this.attributes) || {};');
          this.visit(block);
          this.nim_indents -= 1;
          this.buf.push('\n');
          var mixin_end = this.buf.length;
          this.mixins[key].instances.push({start: mixin_start, end: mixin_end});
        }
            
    },

    /**
     * Visit `tag` buffering tag markup, generating
     * attributes, visiting the `tag`'s code and block.
     *
     * @param {Tag} tag
     * @api public
     */

    visitTag: function(tag) {
        var name = tag.name,
            self = this;

        function bufferName() {
            if (tag.buffer) {
                // try to dirty-fix ternary operators
                name = name.replace(/(.+)\? *\((.+)\) *: *\(?(.+)\)?/,
                                    "if $1: ($2) else: ($3)");
                name = name.replace(/(.+)\? *([^()]+) *: *\((.+)\)/,
                                    "if $1: ($2) else: ($3)");
                name = name.replace(/(.+)\?(.+):(.+)/, "(if $1: $2 else: $3)");
                name = self.replaceSingleQuotes(name);
                self.bufferExpression(name);
            }
            else {
                self.buffer(name);
            }
        }

        if ('pre' == name) {
            this.escape = true;
        }

        if (!this.hasCompiledTag) {
            if (!this.hasCompiledDoctype && 'html' == name) {
                this.visitDoctype();
            }
            this.hasCompiledTag = true;
        }

        if (tag.selfClosing || (!this.xml && selfClosing.indexOf(tag.name) !== -1)) {
            this.buffer('<');
            bufferName();
            this.visitAttributes(tag.attrs, tag.attributeBlocks);
            this.terse ? this.buffer('>') : this.buffer('/>');
            // if it is non-empty throw an error
            if (tag.block && !(tag.block.type === 'Block' && tag.block.nodes.length === 0) && tag.block.nodes.some(function(tag) {
                return tag.type !== 'Text' || !/^\s*$/.test(tag.val)
            })) {
                throw errorAtNode(tag, new Error(name + ' is self closing and should not have content.'));
            }
        } else {
            // Optimize attributes buffering
            this.buffer('<');
            bufferName();
            this.visitAttributes(tag.attrs, tag.attributeBlocks);
            this.buffer('>');
            if (tag.code) this.visitCode(tag.code);
            this.visit(tag.block);

            this.buffer('</');
            bufferName();
            this.buffer('>');
        }

        if ('pre' == tag.name) this.escape = false;

        this.indents--;
    },

    /**
     * Visit `filter`, throwing when the filter does not exist.
     *
     * @param {Filter} filter
     * @api public
     */

    visitFilter: function(filter) {
        var text = filter.block.nodes.map(

        function(node) {
            return node.val;
        }).join('\n');
        filter.attrs.filename = this.options.filename;
        try {
            this.buffer_interpolate(filters(filter.name, text, filter.attrs));
        } catch (err) {
            throw errorAtNode(filter, err);
        }
    },

    /**
     * Visit `text` node.
     *
     * @param {Text} text
     * @api public
     */

    visitText: function(text) {
        this.buffer_interpolate(text.val);
    },

    /**
     * Visit a `comment`, only buffering when the buffer flag is set.
     *
     * @param {Comment} comment
     * @api public
     */

    visitComment: function(comment) {
        if (!comment.buffer) {
            return;
        }
        this.buffer('<!--' + comment.val + '-->');
    },

    /**
     * Visit a `BlockComment`.
     *
     * @param {Comment} comment
     * @api public
     */

    visitBlockComment: function(comment) {
        if (!comment.buffer) {
            return;
        }
        //this.buffer('<!--' + comment.val);
        //this.visit(comment.block);
        //this.buffer('-->');
    },

    /**
     * Visit `code`, respecting buffer / escape flags.
     * If the code is followed by a block, wrap it in
     * a self-calling function.
     *
     * @param {Code} code
     * @api public
     */

    visitCode: function(code) {
        // Wrap code blocks with {}.
        // we only wrap unbuffered code blocks ATM
        // since they are usually flow control

        var val = this.replaceSingleQuotes(code.val.trimLeft());

        // remove ';' at the end of the line if it's there
        val = val.replace(/; *$/, "");

        // fix while condition
        val = val.replace(/^while (.*)/, "while truthiness($1):");

        // fix if condition
        val = val.replace(/^if +\((.*)\)/, "if truthiness($1):");

        // fix else condition
        val = val.replace(/^else +if *\((.*)\)/, "elif truthiness($1):");
        val = val.replace(/^else *$/, "else:");

        // fix negation
        val = val.replace("!", "not ");

        //console.error(val);
        //console.error(code);

        // Buffer code
        if (code.buffer) {
            //val = '(if nil == (jade_interp = ' + val + '; jade_interp): "" else: jade_interp)';
            val = '$(' + val + ')';
            if (code.escape) {
                val = 'jade.escape(' + val + ')';
            }
            this.bufferExpression(val);
        } else {
            this.buf.push(this.getNimIndents() + val);
        }

        // Block support
        if (code.block) {
            this.nim_indents += 1;
            if (!code.buffer) {
                this.buf.push(this.getNimIndents());
            }
            this.visit(code.block);
            if (!code.buffer) {
                this.buf.push(this.getNimIndents());
            }
            this.nim_indents -= 1;
        }
    },

    /**
     * Visit `each` block.
     *
     * @param {Each} each
     * @api public
     */

    visitEach: function(each) {
        this.buf.push(this.getNimIndents() + '# iterate ' + each.obj + '\n');
                      //this.getNimIndents() + 'let jade_each_obj = ' +  each.obj + '\n'

        if (each.alternative) {
            //this.buf.push(this.getNimIndents() + 'if jade_each_obj.len > 0:');
            this.buf.push(this.getNimIndents() + 'if ' + each.obj + '.len > 0:');
            this.nim_indents += 1;
        }

        if (each.key == '$index') {
            this.buf.push(this.getNimIndents() + 'for ' + each.val + ' in ' + 
                          each.obj + ':\n');
        } else {
            this.buf.push(this.getNimIndents() + 'for ' + each.key + ', ' + 
                          //each.val + ' in jade_each_obj.pairs():\n');
                          each.val + ' in ' + each.obj + '.pairs():\n');
        }

        this.nim_indents += 1;
        this.visit(each.block);
        this.nim_indents -= 1;

        this.buf.push('\n');

        if (each.alternative) {
            this.nim_indents -= 1;
            this.buf.push(this.getNimIndents() + 'else:');
            this.nim_indents += 1;
            this.visit(each.alternative);
            this.nim_indents -= 1;
            this.buf.push('\n');
        }

    },

    /**
     * Visit `attrs`.
     *
     * @param {Array} attrs
     * @api public
     */

    visitAttributes: function(attrs, attributeBlocks) {
        if (attributeBlocks.length) {
            if (attrs.length) {
                var val = this.attrs(attrs);
                attributeBlocks.unshift(val);
            }
            console.error("The 'attributes' feature hasn't been ported to Nimrod yet." +
                  "\nPlease contribute or voice your concern if you want this feature in!");
            this.bufferExpression('FIXNEEDEDjade.attrs(FIXNEEDEDjade.merge([' + attributeBlocks.join(',') + ']), ' + JSON.stringify(this.terse) + ')');
        } else if (attrs.length) {
            this.attrs(attrs, true);
        }
    },

    /**
     * Compile attributes.
     */

    attrs: function(attrs, buffer) {

        var buf = [];
        var classes = [];
        var classEscaping = [];

        attrs.forEach(function(attr) {
            var key = attr.name;
            var escaped = attr.escaped;

            if (key === 'class') {
                classes.push(attr.val);
                classEscaping.push(attr.escaped);
            } else if (isConstant(attr.val)) {
                if (buffer) {
                    this.buffer(runtime.attr(key, toConstant(attr.val), escaped, this.terse));
                } else {
                    var val = toConstant(attr.val);
                    if (escaped && !(key.indexOf('data') === 0 && typeof val !== 'string')) {
                        val = runtime.escape(val);
                    }
                    buf.push(JSON.stringify(key) + ': ' + JSON.stringify(val));
                }
            } else {
                var val = attr.val;
                val = val.replace(/ \+ /g, ' & ');
                val = val.replace(/ & \(/g, ' & $(');
                val = val.replace(/\'/g, '"');
                if (buffer) {
                    this.bufferExpression('jade.attr("' + key + '", ' + val + ', ' + JSON.stringify(escaped) + ', ' + JSON.stringify(this.terse) + ')');
                } else {
                    if (escaped && !(key.indexOf('data') === 0)) {
                        val = 'jade.escape(' + val + ')';
                    } else if (escaped) {
                        //val = '(typeof (jade_interp = ' + val + ') == "string" ? jade.escape(jade_interp) : jade_interp)';
                        val = '(jade.escape(' + val + '))';
                    }
                    buf.push(JSON.stringify(key) + ': ' + val);
                }
            }
        }.bind(this));
        if (buffer) {
            if (classes.every(isConstant)) {
                this.buffer(runtime.cls(classes.map(toConstant), classEscaping));
            } else {
                var val = classes.join(',');
                val = val.replace(/ \+ /g, ' & ');
                val = val.replace(/ & \(/g, ' & $(');
                val = val.replace(/\'/g, '"');

                console.error("The 'cls' feature hasn't been ported to Nimrod yet." +
                      "\nPlease contribute or voice your concern if you want this feature in!");
                this.bufferExpression('jade.cls([' + val + '], ' +
                                      JSON.stringify(classEscaping) + ')');
            }
        } else if (classes.length) {
            if (classes.every(isConstant)) {
                classes = JSON.stringify(runtime.joinClasses(classes.map(toConstant)
                                                             .map(runtime.joinClasses)
                                                             .map(
                            function(cls, i) {
                                return classEscaping[i] ? runtime.escape(cls) : cls;
                            })
                                                            ));
            } else {
                console.error("The 'joinClasses' feature hasn't been ported to Nimrod yet." +
                      "\nPlease contribute or voice your concern if you want this feature in!");
                classes = '(jade_interp = ' + JSON.stringify(classEscaping) +
                    ',' + ' jade.joinClasses([' + classes.join(',') +
                    '].map(jade.joinClasses).map(function (cls, i) {' +
                    '   return jade_interp[i] ? jade.escape(cls) : cls' + ' }))' + ')';
            }
            if (classes.length) {
                buf.push('"class": ' + classes);
            }
        }
        return '{' + buf.join(',') + '}';
    }
};
