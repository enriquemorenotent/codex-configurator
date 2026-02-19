import test from 'node:test';
import assert from 'node:assert/strict';
import { getConfigHelp } from '../src/configHelp.js';

test('getConfigHelp provides actionable help for section keys', () => {
  const info = getConfigHelp([], 'projects');

  assert.equal(Boolean(info), true);
  assert.match(String(info.short), /(project|worktree|trust|path)/i);
  assert.equal(info.usage, null);
});

test('getConfigHelp keeps contextual help for projects trust_level', () => {
  const info = getConfigHelp(['projects', '/home/tester/project'], 'trust_level');

  assert.equal(Boolean(info), true);
  assert.match(String(info.short), /trust/i);
});
