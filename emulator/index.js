import * as fs from "fs";

import { run, startStub } from "./x86e";

async function main() {
  const allFlags = {
    kernel: "Emulate syscalls from one of: linux, darwin",
    debugInstructions: "Show each instruction with arguments when reached"
  };
  const flags = {};
  process.argv.forEach(function(arg, i) {
    if (!arg.startsWith("--")) return;

    const flag = arg.slice(2);
    if (flag === "help") {
      console.log("x86e.js");
      console.log("\nFlags:");
      Object.keys(allFlags).forEach(flag =>
        console.log("\t--" + flag + ": " + allFlags[flag])
      );
      console.log("\nExample:");
      console.log("\tnode emulate/x86e.js test.asm --kernel darwin");
      process.exit(0);
    }

    if (allFlags[flag]) {
      flags[flag] = process.argv[i + 1];
    }
  });

  let code = fs.readFileSync(process.argv[2]).toString();

  if (!flags.kernel) {
    flags.kernel = "LINUX_AMD64";
  } else {
    if (!["linux_amd64", "darwin_amd64"].includes(flags.kernel.toLowerCase())) {
      console.log("Invalid kernel: " + flags.kernel);
      process.exit(1);
    }

    flags.kernel = flags.kernel.toUpperCase();
  }

  if (!code.split("\n").filter(l => l.trim().startsWith("_start:")).length) {
    const _main = !!code.split("\n").filter(l => l.trim().startsWith("_main:"))
      .length;
    code += "\n" + startStub(flags.kernel, _main ? "_main" : "main");
  }

  // Prevent running until handlers are registered
  const ticks = [1];
  const clock = async () => {
    while (ticks.length) {
      await new Promise(done => setTimeout(done, 500));
    }
  };
  const { process: p, done } = run(code, clock, flags.kernel, {
    debug: {
      instructions: flags.debugInstructions
    }
  });

  // Register handlers
  p.exit = process.exit;
  p.fd = { 1: process.stdout };

  // Start clock
  ticks.pop();
  await done;
}

main();
