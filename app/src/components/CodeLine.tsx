import * as React from 'react';

import { isInstruction, parseInstruction } from '../../../emulator/x86e';

export function CodeLine({ active, line: rawLine, number }) {
  let [line, ...commentsSections] = rawLine.split(';');
  if (commentsSections.length) {
    let comments = ';' + commentsSections.join(';');
  }

  if (!comments) {
    ([line, ...commentsSections] = rawLine.split('#'));
    if (commentsSections.length) {
      comments = '#' + commentsSections.join('#');
    }
  }

  const wrap = (body) => (
    <div className={`CodeLine ${active ? 'CodeLine--active' : ''}`} id={number}>
      <a href={`#${number}`} className="CodeLine-number">{number}</a>
      <div className="CodeLine-line">
	{body}
	{comments &&  <span className="CodeLine-comment"> {comments}</span>}
      </div>
    </div>
  );

  if (isInstruction(line)) {
    const { instruction, args } = parseInstruction(line);
    return wrap(
      <React.Fragment>
        &nbsp;&nbsp;&nbsp;&nbsp;<span className="code-builtin">{instruction}</span>{' '}
        {args.map((arg, i) => <React.Fragment key={i}><span className="code-value">{arg}</span>{i === args.length - 1 ? '' : ', '}</React.Fragment>)}
      </React.Fragment>
    );
  }

  if (line.includes(':') && !line.trim().startsWith('#')) {
    const [label, ...rest] = line.split(':');
    return wrap(
      <React.Fragment>
        <span className="code-function">{label}:</span>{rest.join(':')}
      </React.Fragment>
    );
  }

  return wrap(<pre>{line.replace('\t', '    ')}</pre>);
}
