all: main

main: main.nim jadeface.nim list.nim
	nimrod c -p=../ main.nim

release: main.nim jadeface.nim list.nim
	nimrod c -p=../ -d:release main.nim

list.nim: list.jade
	../bin/jade-nim.js list.jade TList < list.jade > list.nim
