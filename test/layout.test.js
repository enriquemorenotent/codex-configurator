import test from 'node:test';
import assert from 'node:assert/strict';
import { clamp, computePaneWidths, pathToKey } from '../src/layout.js';

test('clamp bounds values correctly', () => {
  assert.equal(clamp(3, 5, 9), 5);
  assert.equal(clamp(8, 5, 9), 8);
  assert.equal(clamp(12, 5, 9), 9);
});

test('pathToKey creates a stable serialized path key', () => {
  assert.equal(pathToKey(['features', 'foo', 1]), '["features","foo",1]');
});

test('computePaneWidths keeps pane totals within terminal width budget', () => {
  const rows = [
    { label: 'short' },
    { label: 'a much longer setting key that should stretch the left pane' },
  ];
  const terminalWidth = 120;
  const widths = computePaneWidths(terminalWidth, rows);
  const available = Math.max(40, terminalWidth - 2);

  assert.equal(widths.leftWidth + widths.rightWidth + 2, available);
  assert.equal(widths.leftWidth >= 30, true);
  assert.equal(widths.rightWidth >= 24, true);
});
