# Generated by jade-nim.js - Do not edit directly
import strutils, macros, jade, jadeface
proc render*(locals: TList): string =
  var jade_buf: seq[string] = @[]
  jade.inject_locals()
  if truthiness( is_the_one):
    
    jade_buf.add("<p>Choose wisely, neo.</p>")
    
  else:
    
    jade_buf.add("<p>Want some candy?</p>")
    
  jade_buf.add("<ul>")
  # iterate choice_pills

  for pill in choice_pills:

    jade_buf.add("<li>" & $(jade.escape($(pill))) & "</li>")


  jade_buf.add("</ul>")
  return jade_buf.join()
