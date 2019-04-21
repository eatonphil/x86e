import * as React from 'react';

import { CodeLine } from './CodeLine';

export function Code({ activeLine, code, editing, setCode, setEditing }) {
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
    <div className="Code">
      {code.split('\n').map((line, i) => <CodeLine line={line} number={i+1} active={i === activeLine} />)}
    </div>
  )
}
