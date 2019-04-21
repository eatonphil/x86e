import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { Code } from './components/Code';
import { DEFAULT_PROGRAM } from './data/defaultProgram';
import { isInstruction, run, startStub } from '../../emulator/x86e';

function ripRealPosition(lines, rip) {
  let realPosition = 0;
  let i = 0;
  while (true) {
    realPosition++;

    if (realPosition === lines.length) {
      return 0;
    }

    const line = lines[realPosition];
    if (!isInstruction(line)) {
      continue;
    }

    if (i === rip) {
      break;
    }

    i++;
  }

  return realPosition;
}

function App({ defaultProgram }) {
  const [kernel, setKernel] = React.useState('LINUX');
  const [resetCount, reset] = React.useState(0);
  const [code, setCode] = React.useState(defaultProgram);
  const [editing, setEditing] = React.useState(false);
  const [output, setOutput] = React.useState('');
  const lines = code.split('\n');

  const ticks = React.useRef([]);
  const clock = async () => {
    while (!ticks.current.length) {
      await new Promise(done => setTimeout(() => done(false), 50));
    }

    ticks.current.pop();
  }
  clock.onTick = () => {
    const line = ripRealPosition(lines, process.registers.rip);
    setActiveLine(line);
    //document.getElementById(line).scrollIntoView();
  };

  const [activeLine, setActiveLine] = React.useState(0);
  const { process } = React.useMemo(() => {
    const res = run(code, clock, kernel);
    const line = ripRealPosition(lines, res.process.registers.rip);
    setActiveLine(line);
    //document.getElementById(line).scrollIntoView();
    return res;
  }, [code, resetCount, kernel]);

  process.exit = (result) => {
    setOutput(p => p + '(process exited)\n' + result)
  };
  if (!process.labels._start) {
    setCode(c => c + '\n' + startStub(kernel));
    reset(c => c + 1);
    setOutput('');
  }

  React.useEffect(() => {
    function handler (e) {
      if (e.key === 'n' || e.key === 'ArrowDown') {
	ticks.current.push(true);
      } else if (e.key === 'e') {
	setEditing(true);
      } else if (e.key === 'r') {
	
      }
    }

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [setActiveLine]);

  const readFile = ({ target }) => {
    const reader = new FileReader();
    reader.onload = () => setCode(reader.result);
    reader.readAsText(target.files[0]);
  };

  return (
    <div className="Page">
      <div className="Wrapper">
	<div className="Instructions">
	  <header>
	    <h1>Program</h1>
	    <button className="mr-2" type="button" onClick={() => setEditing(editing => !editing)}>{editing ? 'Save' : 'Edit'}</button>
	    <button className="mr-2" type="button" onClick={() => (reset(i => i + 1), setOutput(''))}>Restart</button>
	    <select className="mr-2" value={kernel} onChange={({ target: { value } }) => (setKernel(value), reset(i => i + 1), setOutput(''))}>
	      <option value="LINUX">Emulate Linux</option>
	      <option value="DARWIN">Emulate Darwin (macOS)</option>
	    </select>
	    <input type="file" onChange={readFile} />
	  </header>
	  <Code
	    editing={editing}
	    setEditing={setEditing}
	    activeLine={activeLine}
	    code={code}
	    setCode={(value) => (setCode(value), reset(i => i + 1), setOutput(''))}
	  />
	</div>
	<div className="Memory">
	  <h1>Memory</h1>
	  <div className="Memory-body">
	    <h3>Registers</h3>
	    <table>
	      <tbody>
		{Object.keys(process.registers).map((reg) => {
		   return <tr key={reg}><td className="code-builtin">{reg.toUpperCase()}</td><td>{process.registers[reg]}</td></tr>;
		})}
	      </tbody>
	    </table>
	    <h3>Stack</h3>
	    <table>
	      <tbody>
		{process.memory.map((value, address) => {
		   return <tr key={address}><td className="code-builtin">{address}</td><td>{value}</td></tr>;
		})}
	      </tbody>
	    </table>
	  </div>
	</div>
      </div>
      <div className="Footer">
	<h1>Input/Output</h1>
	<pre className="Footer-output">{output}</pre>
      </div>
    </div>
  );
}

const root = document.querySelector('#root');
window.onload = () => ReactDOM.render(<App defaultProgram={DEFAULT_PROGRAM} />, root);
