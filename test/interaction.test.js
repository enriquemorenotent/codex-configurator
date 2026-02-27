import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isBackspaceKey,
  isDeleteKey,
  isEndKey,
  isHomeKey,
  isPageDownKey,
  isPageUpKey,
} from '../src/interaction.js';

test('isBackspaceKey matches supported backspace representations', () => {
  assert.equal(isBackspaceKey('', { backspace: true }), true);
  assert.equal(isBackspaceKey('', { name: 'backspace' }), true);
  assert.equal(isBackspaceKey('\b', {}), true);
  assert.equal(isBackspaceKey('\u007f', {}), true);
  assert.equal(isBackspaceKey('', { sequence: '\u007f' }), true);
  assert.equal(isBackspaceKey('', { delete: true, name: 'delete', sequence: '' }), true);
  assert.equal(isBackspaceKey('x', {}), false);
});

test('isDeleteKey matches supported delete representations', () => {
  assert.equal(isDeleteKey('', { delete: true }), false);
  assert.equal(isDeleteKey('', { name: 'delete' }), true);
  assert.equal(isDeleteKey('\u001b[3~', {}), true);
  assert.equal(isDeleteKey('', { sequence: '\u001b[3~' }), true);
  assert.equal(isDeleteKey('', { sequence: '\u001b[3;5~' }), true);
  assert.equal(isDeleteKey('\u007f', { delete: true, name: 'delete' }), false);
  assert.equal(isDeleteKey('', { delete: true, sequence: '\u007f' }), false);
  assert.equal(isDeleteKey('', { delete: true, name: 'delete', sequence: '' }), false);
  assert.equal(isDeleteKey('x', {}), false);
});

test('isPageUpKey and isPageDownKey match flags, names, and escape sequences', () => {
  assert.equal(isPageUpKey('', { pageUp: true }), true);
  assert.equal(isPageUpKey('', { name: 'pageup' }), true);
  assert.equal(isPageUpKey('', { name: 'page-up' }), true);
  assert.equal(isPageUpKey('\u001b[5~', {}), true);
  assert.equal(isPageUpKey('x', {}), false);

  assert.equal(isPageDownKey('', { pageDown: true }), true);
  assert.equal(isPageDownKey('', { name: 'pagedown' }), true);
  assert.equal(isPageDownKey('', { name: 'page-down' }), true);
  assert.equal(isPageDownKey('\u001b[6~', {}), true);
  assert.equal(isPageDownKey('x', {}), false);
});

test('isHomeKey and isEndKey match flags, names, and escape sequences', () => {
  assert.equal(isHomeKey('', { home: true }), true);
  assert.equal(isHomeKey('', { name: 'home' }), true);
  assert.equal(isHomeKey('\u001b[H', {}), true);
  assert.equal(isHomeKey('\u001b[1~', {}), true);
  assert.equal(isHomeKey('\u001bOH', {}), true);
  assert.equal(isHomeKey('x', {}), false);

  assert.equal(isEndKey('', { end: true }), true);
  assert.equal(isEndKey('', { name: 'end' }), true);
  assert.equal(isEndKey('\u001b[F', {}), true);
  assert.equal(isEndKey('\u001b[4~', {}), true);
  assert.equal(isEndKey('\u001bOF', {}), true);
  assert.equal(isEndKey('x', {}), false);
});
