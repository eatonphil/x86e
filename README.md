# x86e

A simple x86 emulator in JavaScript.

### Example

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
  MOV RAX, 0x2000001
  SYSCALL
$ node x86e.js examples/plus.asm
$ echo $?
6
```
