const WORD_SIZE_BYTES = 4;

const REGISTERS = [
  'rdi', 'rsi', 'rsp', 'rbp', 'rax', 'rbx', 'rcx', 'rdx', 'rip', 'r8',
  'r9', 'r10', 'r11', 'r12', 'r13', 'r14', 'r15', 'cs', 'ds', 'fs',
  'ss', 'es', 'gs', 'cf', 'zf', 'pf', 'af', 'sf', 'tf', 'if', 'df', 'of',
];
const BIT32_REGISTERS = [
  'edi', 'esi', 'esp', 'ebp', 'eax', 'ebx', 'ecx', 'edx', 'eip',
];

const SYSCALLS = {
  EXIT: {
    LINUX: 1,
    DARWIN: 0x2000001,
  },
  WRITE: {
    LINUX: 4,
    DARWIN: 0x2000004,
  },
};

export const startStub = (kernel) => `_start:
	CALL _main

	MOV RDI, RAX
	MOV RAX, ${SYSCALLS.EXIT[kernel]}
	SYSCALL`;

function parseLabel(line) {
  let tokens = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === ':') {
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
  return !(t.startsWith('#') || t.includes(':') || t.startsWith('.') || !t.length);
}

export function parseInstruction(line) {
  let currentToken = '';
  let instruction;
  const args = [];

  for (let i = 0; i < line.length; i++) {
    const c = line[i];

    if (!instruction) {
      if (c === ' ' || c === '\t') {
	instruction = currentToken.toLowerCase();
	currentToken = '';
	continue;
      }
    } else {
      if (c === ',') {
	args.push(currentToken);
	currentToken = '';
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
  const lines = code.split('\n').map(l => l.trim()).filter(Boolean);
  const labels = {};
  const directives = {};
  let linesSkipped = 0;
  const instructions = lines.map(function (line, i) {
    if (line.startsWith('.')) {
      const [, ...directiveAndArgs] = line.split('.');
      const [directive, ...allArgs] = directiveAndArgs.join('.').split(' ');
      const args = allArgs.join(' ').split(',').map(a => a.trim());
      directives[directive] = args.filter(Boolean);
      linesSkipped++;
      return;
    }

    if (line.startsWith('##')) {
      linesSkipped++;
      return;
    }

    const label = parseLabel(line);
    if (label) {
      labels[label] = i - linesSkipped;
      linesSkipped++;
      return;
    }

    return parseInstruction(line);
  }).filter(Boolean);

  return { directives, labels, instructions };
}

function guardArgs(instruction, args, length) {
  if (args.length !== length) {
    throw new Error(instruction.toUpperCase() + ' expects ' + length + ' args');
  }
}

function memoryPush(process, value) {
  process.memory[process.registers.rsp--] = value;
}

function memoryPop(process, register) {
  const regValue = process.memory[++process.registers.rsp];
  process.registers[register] = regValue;
}

function interpretValue(process, valueRaw, isLValue) {
  const v = (function () {
    const value = valueRaw.toLowerCase();
    if (REGISTERS.includes(value)) {
      if (isLValue) {
	return value;
      } else{
	return process.registers[value];
      }
    }

    if (BIT32_REGISTERS.includes(value)) {
      if (isLValue) {
	return value.replace('e', 'r');
      } else{
	return process.registers[value.replace('e', 'r')];
      }
    }

    if (value.startsWith('dword ptr [')) {
      const offsetString = value.substring('dword ptr ['.length, value.length - 1).trim();
      if (offsetString.includes('-')) {
	const [l, r] = offsetString.split('-').map(l => interpretValue(process, l.trim()));
	const address = l - (r / WORD_SIZE_BYTES);
	if (isLValue) {
	  return address;
	} else {
	  return process.memory[address];
	}
      }

      throw new Error('Unsupported offset calculation: ' + value);
    }

    return parseInt(value);
  })();

  if (!isLValue && isNaN(v)) {
    throw new Error('Bad offset: ' + valueRaw);
  }

  return v;
}

function interpretSyscall(process) {
  if (process.registers.rax === SYSCALLS.EXIT[process.kernel]) {
    process.done = true;
    process.exit(process.registers.rdi);
  }
}

async function interpret(process, clock) {
  while (process.registers.rip < process.instructions.length && !process.done) {
    await clock();

    const { instruction, args } = process.instructions[process.registers.rip];
    if (process.flags.debug.instructions) {
      debug('Instruction: ' + instruction + ' ' + args.join(', '));
    }

    switch (instruction) {
      case 'push': {
	guardArgs(instruction, args, 1);
	const regValue = interpretValue(process, args[0]);
	memoryPush(process, regValue);
	process.registers.rip++;
	break;
      }
      case 'pop': {
	guardArgs(instruction, args, 1);
	const lhs = interpretValue(process, args[0], true);
	memoryPop(process, lhs);
	process.registers.rip++;
	break;
      }
      case 'mov': {
	guardArgs(instruction, args, 2);
	const lhs = interpretValue(process, args[0], true);
	const rhs = interpretValue(process, args[1]);
	if (REGISTERS.includes(lhs)) {
	  process.registers[lhs] = rhs;
	} else if (BIT32_REGISTERS.includes(lhs)) {
	  process.registers[lhs.replace('e', 'r')] = rhs;
	} else {
	  process.memory[lhs] = rhs;
	}
	process.registers.rip++;
	break;
      }
      case 'add': {
	guardArgs(instruction, args, 2);
	const lhs = interpretValue(process, args[0], true);
	const rhs = interpretValue(process, args[1]);
	process.registers[lhs] += rhs;
	process.registers.rip++;
	break;
      }
      case 'sub': {
	guardArgs(instruction, args, 2);
	const lhs = interpretValue(process, args[0], true);
	const rhs = interpretValue(process, args[1]);
	process.registers[lhs] -= rhs;
	process.registers.rip++;
	break;
      }
      case 'call': {
	guardArgs(instruction, args, 1);
	const label = args[0];
	memoryPush(process, process.registers.rip + 1);
	process.registers.rip = process.labels[label];
	break;
      }
      case 'ret': {
	guardArgs(instruction, args, 0);
	memoryPop(process, 'rip');
	break;
      }
      case 'nop':
	guardArgs(instruction, args, 0);
	process.registers.rsp++;
	break;
      case 'syscall': {
	guardArgs(instruction, args, 0);
	interpretSyscall(process);
	break;
      }
      case 'cmp': {
	guardArgs(instruction, args, 2);
	const lhs = interpretValue(process, args[0]);
	const rhs = interpretValue(process, args[1]);
	if (lhs === rhs) {
	  process.registers.zf = 1;
	  process.registers.cf = 0;
	  process.registers.sf = 0;
	} else if (lhs < rhs) {
	  process.registers.zf = 0;
	  process.registers.cf = 1;
	  process.registers.sf = 1;
	} else {
	  process.registers.zf = 0;
	  process.registers.cf = 0;
	  process.registers.sf = 0;
	}
	process.registers.rip++;
	break;
      }
      case 'jmp': {
	guardArgs(instruction, args, 1);
	const label = process.labels[args[0]];
	if (label === undefined) {
	  throw new Error('Cannot jmp to invalid label: ' + args[0]);
	}
	process.registers.rip = label;
	break;
      }
      case 'jge': {
	guardArgs(instruction, args, 1);
	const label = process.labels[args[0]];
	if (label === undefined) {
	  throw new Error('Cannot jmp to invalid label: ' + args[0]);
	}

	if (process.registers.zf || process.registers.cf) {
	  process.registers.rip = label;
	} else {
	  process.registers.rip++;
	}
	break;
      }
      default:
	throw new Error('Unsupported instruction: ' + instruction);
    }

    if (clock.onTick) clock.onTick();
  }
}

export function run(code, clock, kernel = 'LINUX', flags = { debug: {} }) {
  const memory = new Array(1024);
  const { directives, instructions, labels } = parse(code);
  const process = {
    done: false,
    directives,
    flags,
    instructions,
    labels,
    kernel,    
    registers: REGISTERS.reduce((rs, r) => ({ ...rs, [r]: 0 }), {}),
    memory,
  };

  process.registers.rip = labels._start;
  process.registers.rsp = process.memory.length;

  const done = interpret(process, clock);
  return { process, done };
}
