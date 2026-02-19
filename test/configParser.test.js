import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as toml from 'toml';
import {
  MAX_DETAIL_CHARS,
  deleteValueAtPath,
  formatDetails,
  getNodeAtPath,
  setValueAtPath,
  writeConfig,
} from '../src/configParser.js';

const withTempErrorLogPath = (callback) => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-configurator-'));
  const logPath = path.join(tempDirectory, 'errors.log');
  const previousLogPath = process.env.CODEX_CONFIGURATOR_ERROR_LOG_PATH;
  process.env.CODEX_CONFIGURATOR_ERROR_LOG_PATH = logPath;

  try {
    callback({ tempDirectory, logPath });
  } finally {
    if (typeof previousLogPath === 'string') {
      process.env.CODEX_CONFIGURATOR_ERROR_LOG_PATH = previousLogPath;
    } else {
      delete process.env.CODEX_CONFIGURATOR_ERROR_LOG_PATH;
    }
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
};

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

test('writeConfig writes atomically to an existing file path', () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-configurator-'));
  const configPath = path.join(tempDirectory, 'config.toml');
  fs.writeFileSync(configPath, 'model = "gpt-4.1"\n', 'utf8');

  try {
    const result = writeConfig(
      {
        model: 'gpt-5',
        features: {
          web_search: true,
        },
      },
      configPath
    );

    assert.equal(result.ok, true);

    const fileContents = fs.readFileSync(configPath, 'utf8');
    const parsed = toml.parse(fileContents);
    assert.equal(parsed.model, 'gpt-5');
    assert.equal(parsed.features.web_search, true);
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

test('writeConfig fails when the target file does not exist', () => {
  withTempErrorLogPath(({ tempDirectory, logPath }) => {
    const configPath = path.join(tempDirectory, 'missing.toml');
    const result = writeConfig({ model: 'gpt-5' }, configPath);

    assert.equal(result.ok, false);
    assert.match(result.error, /does not exist/);
    assert.deepEqual(fs.readdirSync(tempDirectory), ['errors.log']);

    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
    assert.equal(lines.length, 1);
    const entry = JSON.parse(lines[0]);
    assert.equal(entry.event, 'config.write.failed');
    assert.equal(entry.configPath, configPath);
    assert.match(entry.error, /does not exist/);
  });
});
