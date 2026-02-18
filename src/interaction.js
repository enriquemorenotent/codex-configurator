export const isBackspaceKey = (input, key) =>
  key.backspace === true || key.delete === true || key.name === 'backspace' || input === '\b' || input === '\u007f';
