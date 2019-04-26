global main

section .text

_main:
	mov  rdi, 2
	mov  rsi, 3
	cmp  rdi, rsi
	jne  _main_then
_main_else:
	mov  rax, 43
	jmp  _done
_main_then:
	mov  rax, 22 		; should be this
_done:
	ret
