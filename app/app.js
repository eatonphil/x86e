const START_STUB = `_start:
	CALL _main

	MOV RDI, RAX
	MOV RAX, 1
	SYSCALL`;

const DEFAULT_PROGRAM = `      	.section	__TEXT,__text,regular,pure_instructions
	.build_version macos, 10, 14	sdk_version 10, 14
	.intel_syntax noprefix
	.globl	_plus                   ## -- Begin function plus
	.p2align	4, 0x90
_plus:                                  ## @plus
	.cfi_startproc
## %bb.0:
	push	rbp
	.cfi_def_cfa_offset 16
	.cfi_offset rbp, -16
	mov	rbp, rsp
	.cfi_def_cfa_register rbp
	mov	dword ptr [rbp - 4], edi
	mov	dword ptr [rbp - 8], esi
	mov	esi, dword ptr [rbp - 4]
	add	esi, dword ptr [rbp - 8]
	mov	eax, esi
	pop	rbp
	ret
	.cfi_endproc
                                        ## -- End function
	.globl	_main                   ## -- Begin function main
	.p2align	4, 0x90
_main:                                  ## @main
	.cfi_startproc
## %bb.0:
	push	rbp
	.cfi_def_cfa_offset 16
	.cfi_offset rbp, -16
	mov	rbp, rsp
	.cfi_def_cfa_register rbp
	sub	rsp, 16
	mov	dword ptr [rbp - 4], 0
	mov	edi, 2
	mov	esi, 3
	call	_plus
	mov	edi, 1
	mov	esi, eax
	call	_plus
	add	rsp, 16
	pop	rbp
	ret
	.cfi_endproc
                                        ## -- End function

.subsections_via_symbols`;

function isInstruction(line) {
  const t = line.trim();
  return !(t.startsWith('#') || t.includes(':') || t.startsWith('.') || !t.length);
}

function CodeLine({ active, line, number }) {
  if (isInstruction(line)) {
    const { instruction, args } = parseInstruction(line);
    return (
      <div className={`CodeLine ${active ? 'CodeLine--active' : ''}`} id={number}>
	<a href={`#${number}`} className="CodeLine-number">{number}</a>
	<div className="CodeLine-line">
	  &nbsp;&nbsp;&nbsp;&nbsp;<span className="code-builtin">{instruction}</span>{' '}
          {args.map((arg, i) => <React.Fragment><span className="code-value">{arg}</span>{i === args.length - 1 ? '' : ', '}</React.Fragment>)}
	</div>
      </div>
    );
  }

  if (line.includes(':') && !line.trim().startsWith('#')) {
    const [label, ...rest] = line.split(':');
    return (
      <div className={`CodeLine ${active ? 'CodeLine--active' : ''}`}>
	<div className="CodeLine-number">{number}</div>
	<div className="CodeLine-line">
	  <span className="code-function">{label}:</span>{rest.join(':')}
	</div>
      </div>
    );
  }

  return (
    <div className={`CodeLine ${active ? 'CodeLine--active' : ''}`}>
      <div className="CodeLine-number">{number}</div>
      <pre className="CodeLine-line">{line.replace('\t', '    ')}</pre>
    </div>
  );
}

function Code({ activeLine, code, editing, setCode, setEditing }) {
  const [cursor, setCursor] = React.useState(code.length - 1);

  React.useEffect(() => {
    if (!editing) {
      return;
    }

    function onKeydown(e) {
      if (!editing || e.altKey || e.ctrlKey || e.metaKey) {
	return;
      }

      e.stopPropagation();
      if (e.key === 'Escape') {
	setEditing(false);
	return;
      }

      if (e.key === 'Enter') {
	setCode(c => c + '\n');
	setCursor(c => c + 1);
      }

      if (e.key === 'Backspace') {
	setCursor(c => c - 1);
	setCode(c => {
	  if (cursor === 0) {
	    return c;
	  }

	  if (cursor === code.length - 1) {
	    return c.slice(0, code.length - 1);
	  }

	  return c.slice(0, cursor) + c.slice(cursor);
	});
      } else if (e.key.length === 1) { // Guess for ignoring things like Meta, Shift, etc.
	setCode(c => c + e.key);
      }
    }

    document.addEventListener('keydown', onKeydown);

    return () => document.removeEventListener('keydown', onKeydown);
  }, [editing, code]);
  return (
    <div>
      {code.split('\n').map((line, i) => <CodeLine line={line} number={i+1} active={i === activeLine} />)}
    </div>
  )
}

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
    document.getElementById(line);
  };

  const [activeLine, setActiveLine] = React.useState(0);
  const { process } = React.useMemo(() => {
    const res = run(code, clock);
    const line = ripRealPosition(lines, res.process.registers.rip);
    setActiveLine(line);
    document.getElementById(line);
    return res;
  }, [code, resetCount]);

  process.exit = (result) => {
    setOutput(p => p + result)
  };
  if (!process.labels._start) {
    setCode(c => c + '\n' + START_STUB);
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
      <div class="Wrapper">
	<div class="Instructions">
	  <header>
	    <h1>Program</h1>
	    <button className="mr-2" type="button" onClick={() => setEditing(editing => !editing)}>{editing ? 'Save' : 'Edit'}</button>
	    <button className="mr-2" type="button" onClick={() => (reset(i => i + 1), setOutput(''))}>Restart</button>
	    <input type="file" onChange={readFile} />
	  </header>
	  <Code
	    editing={editing}
	    setEditing={setEditing}
	    activeLine={activeLine}
	    code={code}
	    setCode={(value) => (setCode(value), reset(i => i + 1))}
	  />
	</div>
	<div class="Memory">
	  <h1>Memory</h1>
	  <h3>Registers</h3>
	  <table>
	    {Object.keys(process.registers).map((reg) => {
	       return <tr key={reg}><td className="code-builtin">{reg.toUpperCase()}</td><td>{process.registers[reg]}</td></tr>;
	    })}
	  </table>
	  <h3>Stack</h3>
	  <table>
	    {process.memory.map((value, address) => {
	       return <tr key={address}><td className="code-builtin">{address}</td><td>{value}</td></tr>;
	    })}
	  </table>
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
