	;; EXPECT_STATUS: 6
	.text
plus:
  ADD RDI, RSI
  MOV RAX, RDI
  RET

	.globl _main
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

  RET
