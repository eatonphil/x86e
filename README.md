# x86e

A simple x86 emulator, debugger, and editor in JavaScript.

![Alt text](/screenshot.png?raw=true "Screenshot")

### Example using the browser

```bash
$ python3 -m http.server &
$ open localhost:8000/app
```

### Example using Node.js

```bash
$ cat examples/plus.asm
  .global _main

  .text

plus:
  ADD RDI, RSI
  MOV RAX, RDI
  RET

_main:
  PUSH RDI
  PUSH RSI
  MOV RDI, 3
  PUSH RDI
  PUSH RSI
  MOV RDI, 2
  MOV RSI, 1
  CALL plus
  POP RSI
  POP RDI
  MOV RSI, RAX

  CALL plus
  POP RSI
  POP RDI

  MOV RDI, RAX
  MOV RAX, 1
  SYSCALL
$ node emulator/x86e.js examples/plus.asm
$ echo $?
6
```
