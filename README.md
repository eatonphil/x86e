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
$ cat examples/plus.c
int plus(int a, int b) { return a + b; }

int main() { return plus(1, plus(2, 3)); }
$ gcc -S -masm=intel -o examples/plus.s examples/plus.c
$ node emulator/x86e.js examples/plus.s
$ echo $?
6
```
