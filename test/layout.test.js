import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clamp,
  computeListViewportRows,
  computeChromeRows,
  computePaneWidths,
  pathToKey,
} from '../src/layout.js';

test('clamp bounds values correctly', () => {
  assert.equal(clamp(3, 5, 9), 5);
  assert.equal(clamp(8, 5, 9), 8);
  assert.equal(clamp(12, 5, 9), 9);
});

test('pathToKey creates a stable serialized path key', () => {
  assert.equal(pathToKey(['features', 'foo', 1]), '["features","foo",1]');
});

test('computePaneWidths keeps pane totals within terminal width budget', () => {
  const terminalWidth = 120;
  const widths = computePaneWidths(terminalWidth);
  const available = Math.max(40, terminalWidth - 2);

  assert.equal(widths.leftWidth + widths.rightWidth + 2, available);
  assert.equal(widths.leftWidth >= 30, true);
  assert.equal(widths.rightWidth >= 24, true);
});

test('computeListViewportRows reserves chrome rows dynamically', () => {
  const commonContext = {
    terminalHeight: 30,
    terminalWidth: 180,
    activeConfigFile: { label: 'main', path: '/tmp/codex.toml' },
    packageVersion: '0.3.0',
    codexVersion: '0.1.0',
    codexVersionStatus: 'up to date',
    isInteractive: true,
  };
  const chromeRows = computeChromeRows(commonContext);

  assert.equal(computeListViewportRows(commonContext), 30 - chromeRows);
  assert.equal(
    computeListViewportRows({ ...commonContext, extraChromeRows: 4 }),
    Math.max(1, 30 - chromeRows - 4)
  );
  assert.equal(computeListViewportRows({ ...commonContext, isInteractive: false }), 30 - computeChromeRows({
    ...commonContext,
    isInteractive: false,
  }));
});

test('computeListViewportRows always stays at least one row', () => {
  assert.equal(
    computeListViewportRows({
      terminalHeight: 2,
      terminalWidth: 180,
      activeConfigFile: { label: 'main', path: '/tmp/codex.toml' },
      packageVersion: '0.3.0',
      codexVersion: '0.1.0',
      codexVersionStatus: 'up to date',
      isInteractive: true,
    }),
    1
  );
});
