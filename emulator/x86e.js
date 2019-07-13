const BIT64_REGISTERS = [
  "rdi",
  "rsi",
  "rsp",
  "rbp",
  "rax",
  "rbx",
  "rcx",
  "rdx",
  "rip",
  "r8",
  "r9",
  "r10",
  "r11",
  "r12",
  "r13",
  "r14",
  "r15",
  "cs",
  "ds",
  "fs",
  "ss",
  "es",
  "gs",
  "cf",
  "zf",
  "pf",
  "af",
  "sf",
  "tf",
  "if",
  "df",
  "of",
  "rflags"
];
const BIT32_REGISTERS = [
  "edi",
  "esi",
  "esp",
  "ebp",
  "eax",
  "ebx",
  "ecx",
  "edx",
  "eip",
  "eflags"
];

const BIT16_REGISTERS = [
  "ax",
  "bx",
  "cx",
  "dx",
  "si",
  "di",
  "sp",
  "bp",
  "cs",
  "ds",
  "ss",
  "es",
  "ip",
  "flags"
];

const SYSV_AMD64_SYSCALLS_COMMON = {
  sys_write(process) {
    const msg = BigInt(process.registers.rsi);
    const bytes = process.registers.rdx;
    for (let i = 0; i < bytes; i++) {
      const offsetInMemory = BigInt(
        Math.floor(i / (process.memoryWidthBytes * 8))
      );
      const offsetInValue = BigInt(i % process.memoryWidthBytes) * 8n;
      const byte =
        (readMemoryBytes(process, msg + offsetInMemory, 1) >> offsetInValue) &
        0xffn;
      const char = String.fromCharCode(Number(byte));
      process.fd[process.registers.rdi].write(char);
    }
  },
  sys_exit(process) {
    process.done = true;
    process.exit(process.registers.rdi);
  }
};

const SYSCALLS_BY_NAME = {
  LINUX_AMD64: {
    sys_write: {
      id: 1,
      handler: SYSV_AMD64_SYSCALLS_COMMON.sys_write
    },
    sys_exit: {
      id: 60,
      handler: SYSV_AMD64_SYSCALLS_COMMON.sys_exit
    }
  },
  DARWIN_AMD64: {
    sys_exit: {
      id: 1,
      handler: SYSV_AMD64_SYSCALLS_COMMON.sys_exit
    },
    sys_write: {
      id: 4,
      handler: SYSV_AMD64_SYSCALLS_COMMON.sys_write
    }
  }
};

const SYSCALLS_BY_ID = Object.keys(SYSCALLS_BY_NAME).reduce(
  (kernels, kernel) => ({
    ...kernels,
    [kernel]: Object.keys(SYSCALLS_BY_NAME[kernel]).reduce(
      (syscalls, syscall) => ({
        ...syscalls,
        [SYSCALLS_BY_NAME[kernel][syscall].id]:
          SYSCALLS_BY_NAME[kernel][syscall].handler
      }),
      {}
    )
  }),
  {}
);

export function startStub(kernel, mainLabel = "_main") {
  return `_start:
	CALL ${mainLabel}

	MOV RDI, RAX
	MOV RAX, ${SYSCALLS_BY_NAME[kernel].sys_exit.id}
	SYSCALL`;
}

function parseLabel(line) {
  let tokens = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === ":") {
      return tokens;
    }

    tokens += c;
  }

  return null;
}

function debug(line) {
  console.log(line);
}

export function isInstruction(line) {
  const t = line.trim();
  return !(
    t.startsWith("#") ||
    t.includes(":") ||
    t.startsWith(".") ||
    !t.length
  );
}

export function parseInstruction(line) {
  let currentToken = "";
  let instruction;
  const args = [];

  for (let i = 0; i < line.length; i++) {
    const c = line[i];

    if (!instruction) {
      if (c === " " || c === "\t") {
        instruction = currentToken.toLowerCase();
        currentToken = "";
        continue;
      }
    } else {
      if (c === ",") {
        args.push(currentToken);
        currentToken = "";
        continue;
      }
    }

    currentToken += c;
  }

  if (currentToken) {
    if (!instruction) {
      instruction = currentToken.toLowerCase();
    } else {
      args.push(currentToken);
    }
  }

  return { instruction, args: args.map(l => l.trim()) };
}

function parse(code) {
  const lines = code
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);
  const labels = {};
  const directives = {};
  let linesSkipped = 0;
  const instructions = lines
    .map(function(line, i) {
      if (line.startsWith(".")) {
        const [, ...directiveAndArgs] = line.split(".");
        const [directive, ...allArgs] = directiveAndArgs.join(".").split(" ");
        const args = allArgs
          .join(" ")
          .split(",")
          .map(a => a.trim());
        directives[directive] = args.filter(Boolean);
        linesSkipped++;
        return;
      }

      if (line.startsWith("##")) {
        linesSkipped++;
        return;
      }

      const label = parseLabel(line);
      if (label) {
        labels[label] = BigInt(i - linesSkipped);
        linesSkipped++;
        return;
      }

      return parseInstruction(line);
    })
    .filter(Boolean);

  return { directives, labels, instructions };
}

function guardArgs(instruction, args, length) {
  if (args.length !== length) {
    throw new Error(instruction.toUpperCase() + " expects " + length + " args");
  }
}

function maskBytes(value, bytes) {
  return value & BigInt(Math.pow(bytes, 8) - 1);
}

function writeMemoryBytes(process, address, value, bytes) {
  for (let i = 0n; i < bytes; i++) {
    value >>= i * 8n;
    process.memory[address + i] = value & 0xffn;
  }
}

function readMemoryBytes(process, address, bytes) {
  let value = 0n;
  for (let i = 0n; i < bytes; i++) {
    value |= (process.memory[address + i] || 0n) << (i * 8n);
  }
  return value;
}

// Pushing is always 8 bytes
function memoryPush(process, value) {
  process.registers.rsp -= 8n;
  writeMemoryBytes(process, process.registers.rsp, value, 8);
}

// Popping will remove 8 bytes but mask with the register size
function memoryPop(process, lhs) {
  const regValue = readMemoryBytes(process, process.registers.rsp, 8);
  process.registers.rsp += 8n;
  process.registers[lhs.register] = maskBytes(regValue, lhs.bytes);
}

function setFlags(process, value) {
  process.registers.zf = value === 0 ? 1n : 0n;
  process.registers.sf = value >= 0 ? 0n : 1n;
  // TODO: deal with overflow
  process.registers.of = 0n;
}

function interpretValue(process, valueRaw, isLValue) {
  const v = (function() {
    const value = valueRaw.toLowerCase();
    if (BIT64_REGISTERS.includes(value)) {
      if (isLValue) {
        return { register: value, bytes: 8 };
      } else {
        return process.registers[value];
      }
    }

    if (BIT32_REGISTERS.includes(value)) {
      if (isLValue) {
        return { register: value.replace("e", "r"), bytes: 4 };
      } else {
        return process.registers[value.replace("e", "r")] & 0xffffn;
      }
    }

    const pointers = [
      { prefix: "byte", bytes: 1 },
      { prefix: "word", bytes: 2 },
      { prefix: "dword", bytes: 4 },
      { prefix: "qword", bytes: 8 }
    ];
    for (const pointer of pointers) {
      if (value.startsWith(pointer.prefix + " ptr [")) {
        const offsetString = value
          .substring((pointer.prefix + " ptr [").length, value.length - 1)
          .trim();
        if (offsetString.includes("-")) {
          const [l, r] = offsetString
            .split("-")
            .map(l => interpretValue(process, l.trim()));
          const address = l - r;
          if (isLValue) {
            return { address, bytes: pointer.bytes };
          } else {
            return readMemoryBytes(process, address, pointer.bytes);
          }
        }

        throw new Error("Unsupported offset calculation: " + value);
      }
    }

    return BigInt.asIntN(64, BigInt(value.split(";")[0].trim()));
  })();

  return v;
}

function interpretSyscall(process) {
  const idNumber = Number(process.registers.rax);
  SYSCALLS_BY_ID[process.kernel][idNumber](process);
}

async function interpret(process, clock) {
  while (process.registers.rip < process.instructions.length && !process.done) {
    await clock();
    const { instruction, args } = process.instructions[process.registers.rip];
    if (process.flags.debug.instructions) {
      debug("Instruction: " + instruction + " " + args.join(", "));
    }

    switch (instruction) {
      case "push": {
        guardArgs(instruction, args, 1);
        const regValue = interpretValue(process, args[0]);
        memoryPush(process, regValue);
        process.registers.rip++;
        break;
      }
      case "pop": {
        guardArgs(instruction, args, 1);
        const lhs = interpretValue(process, args[0], true);
        memoryPop(process, lhs);
        process.registers.rip++;
        break;
      }
      case "mov": {
        guardArgs(instruction, args, 2);
        const lhs = interpretValue(process, args[0], true);
        const rhs = interpretValue(process, args[1]);
        if (lhs.register) {
          process.registers[lhs.register] = maskBytes(rhs, lhs.bytes);
        } else {
          writeMemoryBytes(process, lhs.address, rhs, lhs.bytes);
        }
        process.registers.rip++;
        break;
      }
      case "add": {
        guardArgs(instruction, args, 2);
        const lhs = interpretValue(process, args[0], true);
        const rhs = interpretValue(process, args[1]);
        process.registers[lhs.register] = maskBytes(
          process.registers[lhs.register] + rhs,
          lhs.bytes
        );
        const v = process.registers[lhs.register];
        setFlags(process, v);
        process.registers.rip++;
        break;
      }
      case "sub": {
        guardArgs(instruction, args, 2);
        const lhs = interpretValue(process, args[0], true);
        const rhs = interpretValue(process, args[1]);
        const v = (process.registers[lhs.register] -= rhs);
        setFlags(process, v);
        process.registers.rip++;
        break;
      }
      case "call": {
        guardArgs(instruction, args, 1);
        const label = args[0];
        memoryPush(process, process.registers.rip + 1n);
        process.registers.rip = process.labels[label];
        break;
      }
      case "ret": {
        guardArgs(instruction, args, 0);
        memoryPop(process, { register: "rip", bytes: 8 });
        break;
      }
      case "nop": {
        guardArgs(instruction, args, 0);
        process.registers.rip++;
        break;
      }
      case "syscall": {
        guardArgs(instruction, args, 0);
        interpretSyscall(process);
        process.registers.rip++;
        break;
      }
      case "cmp": {
        guardArgs(instruction, args, 2);
        const lhs = interpretValue(process, args[0]);
        const rhs = interpretValue(process, args[1]);
        setFlags(process, lhs - rhs);
        process.registers.rip++;
        break;
      }
      case "jmp": {
        guardArgs(instruction, args, 1);
        const label = process.labels[args[0]];
        if (label === undefined) {
          throw new Error("Cannot jump to invalid label: " + args[0]);
        }
        process.registers.rip = label;
        break;
      }
      case "jz":
      case "je": {
        guardArgs(instruction, args, 1);
        const label = process.labels[args[0]];
        if (label === undefined) {
          throw new Error("Cannot jump to invalid label: " + args[0]);
        }

        if (process.registers.zf) {
          process.registers.rip = label;
        } else {
          process.registers.rip++;
        }
        break;
      }
      case "jnz":
      case "jne": {
        guardArgs(instruction, args, 1);
        const label = process.labels[args[0]];
        if (label === undefined) {
          throw new Error("Cannot jump to invalid label: " + args[0]);
        }

        if (!process.registers.zf) {
          process.registers.rip = label;
        } else {
          process.registers.rip++;
        }
        break;
      }
      case "jge": {
        guardArgs(instruction, args, 1);
        const label = process.labels[args[0]];
        if (label === undefined) {
          throw new Error("Cannot jump to invalid label: " + args[0]);
        }

        if (process.registers.sf === process.registers.of) {
          process.registers.rip = label;
        } else {
          process.registers.rip++;
        }
        break;
      }
      case "shl": {
        guardArgs(instruction, args, 2);
        const lhs = interpretValue(process, args[0], true);
        const rhs = interpretValue(process, args[1]);
        const v = (process.registers[lhs.register] <<= rhs);
        setFlags(process, v);
        process.registers.rip++;
        break;
      }
      case "shr": {
        guardArgs(instruction, args, 2);
        const lhs = interpretValue(process, args[0], true);
        const rhs = interpretValue(process, args[1]);
        const v = (process.registers[lhs.register] >>= rhs);
        setFlags(process, v);
        process.registers.rip++;
        break;
      }
      case "and": {
        guardArgs(instruction, args, 2);
        const lhs = interpretValue(process, args[0], true);
        const rhs = interpretValue(process, args[1]);
        const v = (process.registers[lhs.register] &= rhs);
        setFlags(process, v);
        process.registers.rip++;
        break;
      }
      case "or": {
        guardArgs(instruction, args, 2);
        const lhs = interpretValue(process, args[0], true);
        const rhs = interpretValue(process, args[1]);
        const v = (process.registers[lhs.register] |= rhs);
        setFlags(process, v);
        process.registers.rip++;
        break;
      }
      default:
        throw new Error("Unsupported instruction: " + instruction);
    }

    if (clock.onTick) clock.onTick();
  }
}

export function run(
  code,
  clock,
  kernel = "LINUX_AMD64",
  flags = {
    debug: {}
  }
) {
  const memory = new Array(Math.pow(2, 10) - 1);
  const { directives, instructions, labels } = parse(code);
  const process = {
    done: false,
    directives,
    flags,
    instructions,
    labels,
    kernel,
    registers: BIT64_REGISTERS.reduce((rs, r) => ({ ...rs, [r]: 0n }), {}),
    memoryWidthBytes: 8,
    memory
  };

  process.registers.rip = labels._start;
  process.registers.rsp = BigInt(process.memory.length);

  const done = interpret(process, clock);
  return { process, done };
}
