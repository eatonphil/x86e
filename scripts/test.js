const cp = require('child_process');
const fs = require('fs');
const path = require('path');

function getTestPrograms(directory) {
  const files = fs.readdirSync(directory);
  return files.map(function (file) {
    const fullPath = path.join(directory, file);
    const stats = fs.lstatSync(fullPath);
    if (!stats.isFile()) {
      return;
    }

    const contents = fs.readFileSync(fullPath).toString();
    const lines = contents.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const expectedStdoutMarker = ';; EXPECT_STDOUT: ';
      const expectedStatusMarker = ';; EXPECT_STATUS: ';
      const program = { name: fullPath };
      if (line.startsWith(expectedStdoutMarker)) {
	program.stdout = line.substring(expectedStdoutMarker.length);
      } else if (line.startsWith(expectedStatusMarker)) {
	const endOfLine = line.substring(expectedStdoutMarker.length);
	program.status = Number(endOfLine);
	if (Number.isNaN(program.status)) {
	  console.log('Expected status number in test, ' + fullPath + ', got "' + endOfLine);
	  process.exit(1);
	}
      } else {
	// Program must start with one or both of these expected markers
	// to be considered test programs.
	return;
      }

      return program;
    }
  }).filter(Boolean);
}

function main() {
  const testPrograms = getTestPrograms(path.join(__dirname, '../examples'));
  let ok = 0;
  testPrograms.forEach(function (program) {
    console.log('Running ' + program.name);

    const child = cp.spawnSync('node', ['dist', program.name]);
    if (program.status && child.status !== program.status) {
      console.log('Test failed. Expected status, ' + program.status + ', got status, ' + child.status + '.');
      return;
    }

    ok++;
    console.log('Test successful.');
  });

  console.log(`\n${ok} of ${testPrograms.length} tests successful.`);
  if (ok !== testPrograms.length -1) {
    process.exit(1);
  }
}

main();
