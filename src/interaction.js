export const isBackspaceKey = (input, key) =>
  key.backspace === true || key.name === 'backspace' || input === '\b' || input === '\u007f';

export const isDeleteKey = (input, key) =>
  key.delete === true || key.name === 'delete' || input === '\u001b[3~';

export const isPageUpKey = (input, key) =>
  key.pageUp === true || key.name === 'pageup' || key.name === 'page-up' || input === '\u001b[5~';

export const isPageDownKey = (input, key) =>
  key.pageDown === true || key.name === 'pagedown' || key.name === 'page-down' || input === '\u001b[6~';

export const isHomeKey = (input, key) =>
  key.home === true ||
  key.name === 'home' ||
  input === '\u001b[H' ||
  input === '\u001b[1~' ||
  input === '\u001bOH';

export const isEndKey = (input, key) =>
  key.end === true ||
  key.name === 'end' ||
  input === '\u001b[F' ||
  input === '\u001b[4~' ||
  input === '\u001bOF';
