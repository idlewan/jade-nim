import strutils
import macros

let null* = false

proc escape*(html: string): string =
    result = newStringOfCap(html.len)
    for c in items(html):
        case c
        of '<': result.add("&lt;")
        of '>': result.add("&gt;")
        of '&': result.add("&amp;")
        of '"': result.add("&quot;")
        of '\'': result.add("&#x27;")
        of '/': result.add("&#x2F;")
        else: result.add(c)


proc attr*(key: string, val, escaped, terse: bool): string =
    if val:
        result = " "
        if terse:
            result &= key
        else:
            result &= key & "=\"" & key & "\""
    else:
        result = ""

proc attr*(key, val: string, escaped, terse: bool): string =
    if escaped:
        result = " " & key & "=\"" & escape(val) & "\""
    else:
        result = " " & key & "=\"" & val & "\""


proc truthiness*(val: string): bool {.inline.} =
    val != nil and val != ""

proc truthiness*(val: int): bool {.inline.} =
    val != 0

proc truthiness*(val: bool): bool {.inline.} =
    val

proc cls*(classes: openarray[string], escaped: openarray[bool]): string =
    var buf: seq[string] = @[]
    for i, class in classes:
        if escaped[i]:
            buf.add(escape(class))
        else:
            buf.add(class)
    var text = buf.join(" ")
    if text.len > 0:
        return " class=\"" & text & "\""
    else:
        return ""

template inject_locals*(): stmt {.immediate, dirty.} =
    macro inject_locals_aux(): stmt =
        result = newStmtList()
        for name, val in locals.fieldPairs:
            result.add(newLetStmt(newIdentNode(name), newDotExpr(
                newIdentNode("locals"),
                newIdentNode(name)
                )))
    inject_locals_aux()
