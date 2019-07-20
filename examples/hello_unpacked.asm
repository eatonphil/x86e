	;; EXPECT_STDOUT: Hello!\n
	;; EXPECT_STATUS: 22

main:
  PUSH 10  ; \n
  PUSH 33  ; !
  PUSH 111 ; o
  PUSH 108 ; l
  PUSH 108 ; l
  PUSH 101 ; e
  PUSH 72  ; H

  MOV RDI, 1   ; stdout
  MOV RSI, RSP ; address of string
  MOV RDX, 56  ; 7 8-bit characters in the string but PUSH acts on 64-bit integers
  MOV RAX, 1   ; write
  SYSCALL

  MOV RDI, 22
  MOV RAX, 60
  SYSCALL
