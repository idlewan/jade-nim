# jade-nim
Compiles jade templates to Nimrod functions.

# Installation

Clone the repository and put it in your nimrod path (`-p:path/to/jade-nim`), or use `babel` to install it.

In your terminal, install the node dependencies:

    $ npm install .

Put `path/to/jade-nim/bin/` in your `PATH` variable so that you can launch `jade-nim.js` from anywhere.

# Usage

    $ jade-nim.js mytemplate.jade Tmynimrodtype < mytemplate.jade > mytemplate.nim

`Tmynimrodtype` is a tuple that you have to define in a file named `jadeface.nim` (which should be accessible in your nimrod path for the compiler to find it). It will be your "interface" between the code you will write and the template renderer.

## Example
```nimrod
# jadeface.nim
type
    TList* = tuple
        choice_pills: seq[string]
        is_the_one: bool
```
```nimrod
# main.nim
import jadeface, list

var list_vars: TList = (choice_pills: @["red", "blue", "silver"],
                        is_the_one: true)
echo list.render(list_vars)
```
```jade
// list.jade
if is_the_one
  p Choose wisely, neo.
else
  p Want some candy?

ul
  for pill in choice_pills
    li #{pill}
```
See the example [Makefile](https://github.com/idlewan/jade-nim/blob/master/example/Makefile) for how to compile.

The Jade template is converted in a purely Nimrod procedure ([see example here](https://github.com/idlewan/jade-nim/blob/master/example/list.nim)).

# Supported features
Most of Jade features work out-of-the-box, except the following ones:

- `&attributes`
- mixins with dynamic names

Please report any problems or bugs on the issue tracker.
