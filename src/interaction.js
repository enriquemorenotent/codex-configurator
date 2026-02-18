export const isBackspaceKey = (input, key) =>
  key.backspace === true || key.name === 'backspace' || input === '\b' || input === '\u007f';

export const isDeleteKey = (input, key) =>
  key.delete === true || key.name === 'delete' || input === '\u001b[3~';
