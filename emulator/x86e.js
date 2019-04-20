const WORD_SIZE_BYTES = 4;

const REGISTERS = ['rdi', 'rsi', 'rsp', 'rbp', 'rax', 'eax', 'eip', 'edi', 'esi'];

const SYSCALLS = {
  EXIT: 1,
};

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

function parseInstruction(line) {
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
      instruction = currentToken;
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

    if (value.startsWith('dword ptr [')) {
      const offsetString = value.substring('dword ptr ['.length, value.length - 1).trim();
      if (offsetString.includes('-')) {
	const [l, r] = offsetString.split('-').map(l => interpretValue(process, l.trim()));
	const address = process.memory.length + (process.registers.rsp + l - r) / WORD_SIZE_BYTES;
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
  if (syscallId === SYSCALLS.EXIT) {
    nodeProcess.exit(process.registers.rdi);
  }
}

async function interpret(process, clock) {
  while (process.registers.eip < process.instructions.length) {
    await clock();

    const { instruction, args } = process.instructions[process.registers.eip];
    switch (instruction) {
      case 'push': {
	guardArgs(instruction, args, 1);
	// TODO: can PUSH take a literal number?
	const regValue = interpretValue(process, args[0]);
	process.memory.push(regValue);
	process.registers.eip++;
	break;
      }
      case 'pop': {
	guardArgs(instruction, args, 1);
	const regValue = process.memory[process.registers.rsp];
	process.registers.rsp -= WORD_SIZE_BYTES;
	process.registers[args[0].toLowerCase()] = regValue;
	process.registers.eip++;
	break;
      }
      case 'mov': {
	guardArgs(instruction, args, 2);
	const lhs = interpretValue(process, args[0], true);
	const rhs = interpretValue(process, args[1]);
	if (REGISTERS.includes(lhs)) {
	  process.registers[lhs] = rhs;
	} else {
	  process.memory[lhs] = rhs;
	}
	process.registers.eip++;
	break;
      }
      case 'add': {
	guardArgs(instruction, args, 2);
	const lhs = args[0].toLowerCase();
	const rhs = interpretValue(process, args[1]);
	process.registers[lhs] += rhs;
	process.registers.eip++;
	break;
      }
      case 'sub': {
	guardArgs(instruction, args, 2);
	const lhs = args[0].toLowerCase();
	const rhs = interpretValue(process, args[1]);
	process.registers[lhs] -= rhs;
	process.registers.eip++;
	break;
      }
      case 'call': {
	guardArgs(instruction, args, 1);
	const label = args[0];
	process.memory[process.registers.rsp + process.registers.eip + 1];
	process.registers.rsp += WORD_SIZE_BYTES;
	process.registers.eip = process.labels[label];
	break;
      }
      case 'ret': {
	guardArgs(instruction, args, 0);
	process.registers.eip = process.memory[process.registers.rsp];
	process.registers.rsp -= WORD_SIZE_BYTES;
	break;
      }
      case 'syscall': {
	guardArgs(instruction, args, 0);
	interpretSyscall(process);
	break;
      }
      default:
	throw new Error('Unsupported instruction: ' + instruction);
    }

    if (clock.onTick) clock.onTick();
  }
}

function run(code, clock) {
  const memory = new Array(1024);
  const { directives, instructions, labels } = parse(code);
  const process = {
    directives,
    instructions,
    labels,
    registers: REGISTERS.reduce((rs, r) => ({ ...rs, [r]: 0 }), {}),
    memory,
  };

  process.registers.eip = labels._main;

  const done = interpret(process, clock);
  return { process, done };
}

try {
  const fs = require('fs');
  const code = fs.readFileSync(process.argv[2]).toString();
  const { process: { registers: { rax } }, done } = run(code, () => Promise.resolve());
  done.then(() => process.exit(rax));
} catch (e) {
  // in browser
}
