const fs = require('fs');
const nodeProcess = require('process');

const REGISTERS = ['rdi', 'rsi', 'rax', 'eip'];

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

    if (line.endsWith(':')) {
      const label = line.split(':')[0].trim();
      labels[label] = i - linesSkipped;
      linesSkipped++;
      return;
    }

    const [instruction, ...allArgs] = line.split(' ');
    const args = allArgs.join(' ').split(',').map(a => a.trim());
    return {
      instruction: instruction.toLowerCase(),
      args: args.filter(Boolean),
    };
  }).filter(Boolean);

  return { directives, labels, instructions };
}

function guardArgs(instruction, args, length) {
  if (args.length !== length) {
    throw new Error(instruction.toUpperCase() + ' expects ' + length + ' args');
  }
}

function interpretValue(process, value) {
  if (REGISTERS.includes(value.toLowerCase())) {
    return process.registers[value.toLowerCase()];
  }

  return parseInt(value);
}

function interpretSyscall(process) {
  // deals with macos syscalls
  const syscallId = process.registers.rax - parseInt('0x2000000');
  const EXIT = 1;
  if (syscallId === EXIT) {
    nodeProcess.exit(process.registers.rdi);
  }
}

function interpret(process) {
  while (process.registers.eip < process.instructions.length) {
    const { instruction, args } = process.instructions[process.registers.eip];

    switch (instruction) {
      case 'push': {
	guardArgs(instruction, args, 1);
	// TODO: can PUSH take a literal number?
	const regValue = interpretValue(process, args[0]);
	process.stack.push(regValue);
	process.registers.eip++;
	break;
      }
      case 'pop': {
	guardArgs(instruction, args, 1);
	const regValue = process.stack.pop();
	process.registers[args[0].toLowerCase()] = regValue;
	process.registers.eip++;
	break;
      }
      case 'mov': {
	guardArgs(instruction, args, 2);
	const lhs = args[0].toLowerCase();
	const rhs = interpretValue(process, args[1]);
	process.registers[lhs] = rhs;
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
      case 'call': {
	guardArgs(instruction, args, 1);
	const label = args[0];
	process.stack.push(process.registers.eip + 1);
	process.registers.eip = process.labels[label];
	break;
      }
      case 'ret': {
	guardArgs(instruction, args, 0);
	process.registers.eip = process.stack.pop();
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
  }
}

function main(source) {
  const code = fs.readFileSync(source).toString();
  const stack = [];
  const { directives, instructions, labels } = parse(code);
  const process = {
    directives,
    instructions,
    labels,
    registers: REGISTERS.reduce((rs, r) => ({ ...rs, [r]: 0 }), {}),
    stack,
  };

  process.registers.eip = labels._main;

  interpret(process);
}

main(process.argv[2]);
