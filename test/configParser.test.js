import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as toml from 'toml';
import {
  MAX_DETAIL_CHARS,
  buildRows,
  deleteValueAtPath,
  formatDetails,
  getNodeAtPath,
  resolveConfigPath,
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

test('resolveConfigPath falls back to home .codex path when no overrides are set', () => {
  const resolvedPath = resolveConfigPath({
    argv: [],
    env: {},
    homeDir: '/tmp/codex-home',
  });

  assert.equal(resolvedPath, '/tmp/codex-home/.codex/config.toml');
});

test('resolveConfigPath applies environment override and expands tilde paths', () => {
  const resolvedPath = resolveConfigPath({
    argv: [],
    env: {
      CODEX_CONFIGURATOR_CONFIG_PATH: '~/configs/custom.toml',
    },
    homeDir: '/tmp/codex-home',
  });

  assert.equal(resolvedPath, '/tmp/codex-home/configs/custom.toml');
});

test('resolveConfigPath gives CLI --config precedence over environment overrides', () => {
  const resolvedPath = resolveConfigPath({
    argv: ['--config', './tmp-config.toml'],
    env: {
      CODEX_CONFIGURATOR_CONFIG_PATH: '/tmp/codex-home/configs/env.toml',
    },
  });

  assert.equal(resolvedPath, path.resolve('./tmp-config.toml'));
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

test('writeConfig creates missing parent directories and target file', () => {
  withTempErrorLogPath(({ tempDirectory, logPath }) => {
    const configPath = path.join(tempDirectory, 'nested', 'config.toml');
    const result = writeConfig({ model: 'gpt-5' }, configPath);

    assert.equal(result.ok, true);
    assert.equal(fs.existsSync(configPath), true);

    const fileContents = fs.readFileSync(configPath, 'utf8');
    const parsed = toml.parse(fileContents);
    assert.equal(parsed.model, 'gpt-5');
    assert.equal(fs.existsSync(logPath), false);
  });
});

test('writeConfig writes empty <path> custom IDs as explicit tables', () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-configurator-'));
  const configPath = path.join(tempDirectory, 'config.toml');

  try {
    const projectPath = '/home/tester/lol';
    const result = writeConfig(
      {
        projects: {
          [projectPath]: {},
        },
      },
      configPath
    );

    assert.equal(result.ok, true);

    const fileContents = fs.readFileSync(configPath, 'utf8');
    assert.match(fileContents, /\[projects\."\/home\/tester\/lol"\]/);
    assert.doesNotMatch(fileContents, /"\/home\/tester\/lol"\s*=\s*\{\s*\}/);

    const parsed = toml.parse(fileContents);
    assert.deepEqual(Object.keys(parsed.projects[projectPath]), []);
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
});

test('buildRows does not mark tools.web_search deprecated unless upstream does', () => {
  const rows = buildRows(
    {
      web_search: true,
    },
    ['tools']
  );
  const webSearchRow = rows.find((row) => row.key === 'web_search');

  assert.equal(Boolean(webSearchRow), true);
  assert.equal(webSearchRow.isDeprecated, false);
});
