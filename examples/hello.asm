	;; EXPECT_STDOUT: hello\n

	.text
	.globl main

main:
	push rbp
	mov rbp, rsp
	mov rbx, 0x00000a6f 	; "\no"
	shl rbx, 32		; "\no" << 32
	or rbx, 0x6c6c6568	; rbx | "lleh"
	push rbx
	mov rax, 1		; write
	mov rdi, 1 		; stdout
	mov rsi, rsp
	mov rdx, 6 		; "hello\n".length bytes to write
	syscall

	pop rbx
	pop rbp

	mov rax, 0
	ret
