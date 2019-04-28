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

    if (i === Number(rip)) {
      break;
    }

    i++;
  }

  return realPosition;
}

class App extends React.Component {
  DEFAULT_STATE = {
    kernel: 'LINUX_AMD64',
    editing: false,
    output: '',
    activeLine: 0,
  };

  ticks = 0;
  clock = async () => {
    while (!this.ticks) {
      await new Promise(done => setTimeout(() => done(false), 50));
    }

    this.ticks--;
    if (this.ticks < 0) this.ticks = 0;
  }

  constructor({ defaultProgram }) {
    super();

    this.state = {
      ...this.DEFAULT_STATE,
      code: defaultProgram,
    };

    this.clock.onTick = () => {
      const lines = this.state.code.split('\n');
      const line = ripRealPosition(lines, this.process.registers.rip);
      this.setState({ activeLine: line });
    }
  }

  componentDidMount() {
    this.registerProcess();
    this.registerListeners();
  }

  reset = () => {
    this.setState(({ kernel, code }) => ({
      ...this.DEFAULT_STATE,
      kernel,
      code,
    }), this.registerProcess);
  }

  setCode = (code) => {
    this.setState({ code }, this.state.editing ? undefined : this.reset);
  }

  setEditing = (editing) => {
    this.setState({ editing }, !editing ? this.reset : undefined);
  }

  registerListeners = () => {
    const handler = (e) => {
      if (e.key === 'n' || e.key === 'ArrowDown') {
	this.ticks++;
      } else if (e.key === 'e') {
	this.setEditing(false);
      } else if (e.key === 'r') {
	this.reset();
      }
    }

    document.addEventListener('keydown', handler);
  }

  registerProcess = () => {
    this.ticks = 0;
    this.process = run(this.state.code, this.clock, this.state.kernel).process;
    const lines = this.state.code.split('\n');
    const line = ripRealPosition(lines, this.process.registers.rip);
    this.setState({ activeLine: line });

    this.process.exit = (result) =>
      this.setState(({ output: p }) => ({ output: p + '(process exited)\n' + result }));
    this.process.fd = {
      1: {
	write: (s) => this.setState(({ output }) => ({ output: output + s })),
      },
    };
    if (!this.process.labels._start) {
      const mainLabel = this.process.labels._main ? '_main' : 'main';
      this.setCode(this.state.code + '\n' + startStub(this.state.kernel, mainLabel));
    }
  }

  readFile = ({ target }) => {
    const reader = new FileReader();
    reader.onload = () => this.setCode(reader.result);
    reader.readAsText(target.files[0]);
  };

  render() {
    if (!this.process) {
      return null;
    }

    const { activeLine, code, editing, kernel, output } = this.state;
    return (
      <div className="Page">
	<div className="Wrapper">
	  <div className="Instructions">
	    <header>
	      <h1>Program</h1>
	      <button
		className="mr-2"
		type="button"
		onClick={() => this.setEditing(!editing)}
	      >
		{editing ? 'Save' : 'Edit'}
	      </button>
	      <button
		className="mr-2"
		type="button"
		onClick={this.reset}
	      >
		Restart
	      </button>
	      <select
		className="mr-2"
		value={kernel}
		onChange={({ target: { value } }) => this.setState({ kernel: value }, this.reset)}
	      >
		<option value="LINUX_AMD64">Emulate AMD64 Linux</option>
		<option value="DARWIN_AMD64">Emulate AMD64 (macOS)</option>
	      </select>
	      <input type="file" onChange={this.readFile} />
	    </header>
	    <Code
	      editing={editing}
	      setEditing={this.setEditing}
	      activeLine={activeLine}
	      code={code}
	      setCode={(value) => this.setCode(value)}
	    />
	  </div>
	  <div className="Memory">
	    <h1>Memory</h1>
	    <div className="Memory-body">
	      <h3>Registers</h3>
	      <table style={{ maxHeight: '200px', overflowY: 'auto' }}>
		<tbody>
		  {Object.keys(this.process.registers).map((reg) => {
		     return <tr key={reg}><td className="code-builtin">{reg.toUpperCase()}</td><td>{(this.process.registers[reg] || 0).toString()}</td></tr>;
		  })}
		</tbody>
	      </table>
	      <h3>Stack</h3>
	      <table>
		<tbody>
		  {this.process.memory.map((value, address) => {
		     return <tr key={address}><td className="code-builtin">{address}</td><td>{(value || 0).toString()}</td></tr>;
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
}

const root = document.querySelector('#root');
window.onload = () => ReactDOM.render(<App defaultProgram={DEFAULT_PROGRAM} />, root);
