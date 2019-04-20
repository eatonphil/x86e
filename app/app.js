const code = `      	.section	__TEXT,__text,regular,pure_instructions
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

function eipRealPosition(lines, eip) {
  let realPosition = 0;
  let i = 0;
  while (true) {
    realPosition++;

    const line = lines[realPosition].trim();
    if (line.startsWith('#') || line.includes(':') || line.startsWith('.')) {
      continue;
    }

    if (i === eip) {
      break;
    }

    i++;
  }

  return realPosition;
}

function App() {
  const lines = code.split('\n');

  const ticks = [];
  const clock = async () => {
    while (!ticks.length) {
      await new Promise(done => setTimeout(() => done(false), 50));
    }

    ticks.pop();
  }
  clock.onTick = () =>
    setActiveLine(eipRealPosition(lines, process.registers.eip));

  const { process } = React.useMemo(() => run(code, clock), [code]);
  const [activeLine, setActiveLine] = React.useState(eipRealPosition(lines, process.registers.eip));

  React.useEffect(() => {
    function handler (e) {
      if (e.key === 'n' || e.key === 'ArrowDown') {
	ticks.push(true);
      }
    }

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [setActiveLine]);

  return (
    <div class="Wrapper">
      <div class="Instructions">
	<h2>Program</h2>
	{lines.map((line, i) => <CodeLine line={line} number={i+1} active={i === activeLine} />)}
      </div>
      <div class="Memory">
	<h2>Memory</h2>
	<table>
	  {Object.keys(process.registers).map((reg) => {
	     return <tr key={reg}><td>{reg.toUpperCase()}</td><td>{process.registers[reg]}</td></tr>;
	  })}
	</table>
      </div>
    </div>
  );
}

const root = document.querySelector('#root');
window.onload = () => ReactDOM.render(<App />, root);
