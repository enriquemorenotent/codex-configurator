import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_DETAIL_CHARS,
  deleteValueAtPath,
  formatDetails,
  getNodeAtPath,
  setValueAtPath,
} from '../src/configParser.js';

test('getNodeAtPath resolves numeric string segments for arrays', () => {
  const root = {
    providers: [
      { name: 'first' },
      { name: 'second' },
    ],
  };

  assert.equal(getNodeAtPath(root, ['providers', '1', 'name']), 'second');
  assert.equal(getNodeAtPath(root, ['providers', 0, 'name']), 'first');
});

test('setValueAtPath updates deeply without mutating the source object', () => {
  const source = {
    model: {
      provider: 'openai',
      options: { temperature: 0.2 },
    },
  };

  const updated = setValueAtPath(source, ['model', 'options', 'temperature'], 0.8);

  assert.equal(updated.model.options.temperature, 0.8);
  assert.equal(source.model.options.temperature, 0.2);
  assert.notStrictEqual(updated, source);
  assert.notStrictEqual(updated.model, source.model);
  assert.notStrictEqual(updated.model.options, source.model.options);
});

test('setValueAtPath creates missing intermediate containers', () => {
  const updated = setValueAtPath({}, ['profiles', 'default', 'model'], 'gpt-5');

  assert.deepEqual(updated, {
    profiles: {
      default: {
        model: 'gpt-5',
      },
    },
  });
});

test('deleteValueAtPath deletes object keys without mutating the source object', () => {
  const source = {
    features: {
      alpha: true,
      beta: false,
    },
  };

  const updated = deleteValueAtPath(source, ['features', 'alpha']);

  assert.deepEqual(updated, {
    features: {
      beta: false,
    },
  });
  assert.deepEqual(source, {
    features: {
      alpha: true,
      beta: false,
    },
  });
});

test('deleteValueAtPath removes array items when the path segment is numeric text', () => {
  const source = {
    models: ['gpt-4.1', 'gpt-5', 'o3'],
  };

  const updated = deleteValueAtPath(source, ['models', '1']);

  assert.deepEqual(updated.models, ['gpt-4.1', 'o3']);
  assert.deepEqual(source.models, ['gpt-4.1', 'gpt-5', 'o3']);
});

test('formatDetails truncates large structured values and keeps scalar values intact', () => {
  const oversized = { long: 'x'.repeat(MAX_DETAIL_CHARS * 2) };
  const details = formatDetails(oversized);

  assert.equal(details.endsWith('…'), true);
  assert.equal(details.length, MAX_DETAIL_CHARS + 1);
  assert.equal(formatDetails('plain-text'), 'plain-text');
});
