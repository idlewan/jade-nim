import jadeface, list

var list_vars: TList = (choice_pills: @["red", "blue", "silver"],
                        is_the_one: true)
echo list.render(list_vars)
