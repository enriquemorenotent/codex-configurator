const readKeyName = (key) => String(key?.name || '').toLowerCase();
const readKeySequence = (input, key) => {
  if (typeof input === 'string' && input.length > 0) {
    return input;
  }

  return typeof key?.sequence === 'string' ? key.sequence : '';
};

const isBackspaceSequence = (sequence) =>
  sequence === '\b' || sequence === '\u007f';

const isForwardDeleteSequence = (sequence) =>
  sequence === '\u001b[3~' ||
  (sequence.startsWith('\u001b[3;') && sequence.endsWith('~'));

export const isBackspaceKey = (input, key) => {
  const name = readKeyName(key);
  const sequence = readKeySequence(input, key);
  const ambiguousDeleteSignal =
    key?.delete === true &&
    !isForwardDeleteSequence(sequence) &&
    (sequence === '' || isBackspaceSequence(sequence));

  return key.backspace === true
    || name === 'backspace'
    || isBackspaceSequence(sequence)
    || ambiguousDeleteSignal;
};

export const isDeleteKey = (input, key) => {
  const name = readKeyName(key);
  const sequence = readKeySequence(input, key);

  return !isBackspaceKey(input, key) &&
    (name === 'delete' || isForwardDeleteSequence(sequence));
};

export const isPageUpKey = (input, key) => {
  const name = readKeyName(key);
  const sequence = readKeySequence(input, key);
  return key.pageUp === true || name === 'pageup' || name === 'page-up' || sequence === '\u001b[5~';
};

export const isPageDownKey = (input, key) => {
  const name = readKeyName(key);
  const sequence = readKeySequence(input, key);
  return key.pageDown === true || name === 'pagedown' || name === 'page-down' || sequence === '\u001b[6~';
};

export const isHomeKey = (input, key) => {
  const name = readKeyName(key);
  const sequence = readKeySequence(input, key);
  return key.home === true ||
    name === 'home' ||
    sequence === '\u001b[H' ||
    sequence === '\u001b[1~' ||
    sequence === '\u001bOH';
};

export const isEndKey = (input, key) => {
  const name = readKeyName(key);
  const sequence = readKeySequence(input, key);
  return key.end === true ||
    name === 'end' ||
    sequence === '\u001b[F' ||
    sequence === '\u001b[4~' ||
    sequence === '\u001bOF';
};
