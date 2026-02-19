import test from 'node:test';
import assert from 'node:assert/strict';
import { isFuzzyMatch, filterRowsByQuery } from '../src/fuzzySearch.js';

test('isFuzzyMatch performs case-insensitive subsequence matching', () => {
  assert.equal(isFuzzyMatch('mp', 'model_provider'), true);
  assert.equal(isFuzzyMatch('MCP', 'mcp_servers'), true);
  assert.equal(isFuzzyMatch('xyz', 'mcp_servers'), false);
});

test('filterRowsByQuery keeps original order and matches by row text fields', () => {
  const rows = [
    { key: 'model', label: 'model = "gpt-5.3-codex"', preview: '"gpt-5.3-codex"' },
    { key: 'projects', label: 'projects /', preview: '{}' },
    { key: 'history', label: 'history /', preview: '{}' },
  ];

  const filtered = filterRowsByQuery(rows, 'prj');
  assert.deepEqual(filtered.map((row) => row.key), ['projects']);

  const all = filterRowsByQuery(rows, '');
  assert.deepEqual(all.map((row) => row.key), ['model', 'projects', 'history']);
});
