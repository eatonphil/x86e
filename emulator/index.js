const fs = require('fs');

function main() {
  const allFlags = {
    kernel: 'Emulate syscalls from one of: linux, darwin',
    debugInstructions: 'Show each instruction with arguments when reached',
  };
  const flags = {};
  process.argv.forEach(function (arg, i) {
    if (!arg.startsWith('--')) return;

    const flag = arg.slice(2);
    if (flag === 'help') {
      console.log('x86e.js');
      console.log('\nFlags:');
      Object.keys(allFlags).forEach(flag => console.log('\t--' + flag + ': ' + allFlags[flag]));
      console.log('\nExample:');
      console.log('\tnode emulate/x86e.js test.asm --kernel darwin');
      process.exit(0);
    }

    if (allFlags[flag]) {
      flags[flag] = process.argv[i + 1];
    }
  });

  let code = fs.readFileSync(process.argv[2]).toString();

  if (!flags.kernel) {
    flags.kernel = 'LINUX';
  } else {
    if (!['linux', 'darwin'].includes(flags.kernel.toLowerCase())) {
      console.log('Invalid kernel: ' + flags.kernel);
      process.exit(1);
    }

    flags.kernel = flags.kernel.toUpperCase();
  }

  if (!code.split('\n').filter(l => l.trim().startsWith('_start:')).length) {
    code += '\n' + startStub(flags.kernel);
  }

  const { process: p, done } = run(code, () => Promise.resolve(), flags.kernel, {
    debug: {
      instructions: flags.debugInstructions,
    },
  });
  p.exit = process.exit;
  done.then(() => process.exit(p.registers.rax));
}

main();
