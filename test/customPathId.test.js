import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { normalizeCustomPathId } from '../src/customPathId.js';

test('normalizeCustomPathId normalizes valid relative paths under home', () => {
  const homePath = '/home/tester';
  const result = normalizeCustomPathId('configs/dev', homePath);

  assert.equal(result.ok, true);
  assert.equal(result.value, path.resolve(homePath, 'configs/dev'));
});

test('normalizeCustomPathId handles tilde and absolute-looking input as home-relative', () => {
  const homePath = '/home/tester';
  const fromTilde = normalizeCustomPathId('~/configs/dev', homePath);
  const fromAbsolute = normalizeCustomPathId('/configs/dev', homePath);

  assert.equal(fromTilde.ok, true);
  assert.equal(fromTilde.value, path.resolve(homePath, 'configs/dev'));
  assert.equal(fromAbsolute.ok, true);
  assert.equal(fromAbsolute.value, path.resolve(homePath, 'configs/dev'));
});

test('normalizeCustomPathId rejects traversal that escapes home', () => {
  const homePath = '/home/tester';
  const escaped = normalizeCustomPathId('../../etc/passwd', homePath);
  const nestedEscape = normalizeCustomPathId('safe/../../../etc', homePath);
  const windowsStyleEscape = normalizeCustomPathId('..\\..\\secret', homePath);

  assert.equal(escaped.ok, false);
  assert.equal(nestedEscape.ok, false);
  assert.equal(windowsStyleEscape.ok, false);
  assert.match(escaped.error, /must stay inside/);
});

test('normalizeCustomPathId rejects empty input', () => {
  const result = normalizeCustomPathId('   ', '/home/tester');

  assert.equal(result.ok, false);
  assert.equal(result.error, 'ID cannot be empty.');
});
