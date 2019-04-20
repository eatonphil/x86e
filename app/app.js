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

function CodeLine({ active, line, number }) {
  return (
    <div className={`CodeLine ${active ? 'CodeLine--active' : ''}`}>
      <div className="CodeLine-number">{number}</div>
      <div className="CodeLine-line">
	<pre>{line}</pre>
      </div>
    </div>
  )
}

function Code({ activeLine, code, onChange }) {
  const ref = React.useRef(null);

  const [cursor, setCursor] = React.useState(code.length - 1);

  React.useEffect(() => {
    if (!ref.current) {
      return;
    }

    function onKeydown(e) {
      if (ref.current !== document.activeElement) {
	return;
      }

      e.stopPropagation();
      if (e.key === 'Backspace') {
	onChange(c => c.splice(cursor, 1));
	setCursor(c => c - 1);
      } else {
	onChange(c => c + e.key);
      }
    }

    ref.current.addEventListener('keydown', onKeydown);

    return () => {
      if (ref.current) {
	ref.current.removeEventListener('keydown', onKeydown);
      }
    }
  }, [ref.current]);
  return (
    <div ref={ref}>
      {code.split('\n').map((line, i) => <CodeLine line={line} number={i+1} active={i === activeLine} />)}
    </div>
  )
}

function ripRealPosition(lines, rip) {
  let realPosition = 0;
  let i = 0;
  while (true) {
    realPosition++;

    const line = lines[realPosition].trim();
    if (line.startsWith('#') || line.includes(':') || line.startsWith('.') || !line.length) {
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
  const lines = code.split('\n');

  const ticks = React.useRef([]);
  const clock = async () => {
    while (!ticks.current.length) {
      await new Promise(done => setTimeout(() => done(false), 50));
    }

    ticks.current.pop();
  }
  clock.onTick = () =>
    setActiveLine(ripRealPosition(lines, process.registers.rip));

  const [activeLine, setActiveLine] = React.useState(0);
  const { process } = React.useMemo(() => {
    const res = run(code, clock);
    setActiveLine(ripRealPosition(lines, res.process.registers.rip));
    return res;
  }, [code, resetCount]);

  React.useEffect(() => {
    function handler (e) {
      if (e.key === 'n' || e.key === 'ArrowDown') {
	ticks.current.push(true);
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
    <div class="Wrapper">
      <div class="Instructions">
	<header>
	  <h1>Program</h1>
	  <button className="mr-2" type="button" onClick={() => reset(i => i + 1)}>Reset</button>
	  <input type="file" onChange={readFile} />
	</header>
	<Code activeLine={activeLine} code={code} onChange={(value) => (setCode(value), reset(i => i + 1))}>
	</Code>
      </div>
      <div class="Memory">
	<h1>Memory</h1>
	<h3>Registers</h3>
	<table>
	  {Object.keys(process.registers).map((reg) => {
	     return <tr key={reg}><td>{reg.toUpperCase()}</td><td>{process.registers[reg]}</td></tr>;
	  })}
	</table>
	<h3>Stack</h3>
	<table>
	  {process.memory.map((value, address) => {
	     return <tr key={address}><td>{address}</td><td>{value}</td></tr>;
	  })}
	</table>
      </div>
    </div>
  );
}

const root = document.querySelector('#root');
window.onload = () => ReactDOM.render(<App defaultProgram={DEFAULT_PROGRAM} />, root);
