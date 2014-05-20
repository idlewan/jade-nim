#!/usr/bin/env node

var jade2nim = require('../index');

// Copies arguments list but removes first two options (script exec type & exec location)
var userArguments = process.argv.slice(2);

if (userArguments.length != 2) {
    console.error('Usage: jade-nim mytemplate.jade Tmynimrodtype < mytemplate.jade > mytemplate.nim');
    return;
}

var buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', function(chunk){ buf += chunk; });
process.stdin.on('end', function(){
    var output = jade2nim(buf, {filename: userArguments[0],
                                typename: userArguments[1]});
    process.stdout.write(output);
}).resume();

process.on('SIGINT', function() {
    process.stdout.write('\n');
    process.stdin.emit('end');
    process.stdout.write('\n');
    process.exit();
});
