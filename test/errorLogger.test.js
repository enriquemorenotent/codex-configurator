import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { logConfiguratorError } from '../src/errorLogger.js';

const withTempErrorLogPath = (callback, options = {}) => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-configurator-'));
  const logPath = path.join(tempDirectory, 'errors.log');
  const previousLogPath = process.env.CODEX_CONFIGURATOR_ERROR_LOG_PATH;
  const previousMaxBytes = process.env.CODEX_CONFIGURATOR_ERROR_LOG_MAX_BYTES;
  process.env.CODEX_CONFIGURATOR_ERROR_LOG_PATH = logPath;
  if (options.maxBytes) {
    process.env.CODEX_CONFIGURATOR_ERROR_LOG_MAX_BYTES = String(options.maxBytes);
  }

  try {
    callback(logPath);
  } finally {
    if (typeof previousLogPath === 'string') {
      process.env.CODEX_CONFIGURATOR_ERROR_LOG_PATH = previousLogPath;
    } else {
      delete process.env.CODEX_CONFIGURATOR_ERROR_LOG_PATH;
    }
    if (typeof previousMaxBytes === 'string') {
      process.env.CODEX_CONFIGURATOR_ERROR_LOG_MAX_BYTES = previousMaxBytes;
    } else {
      delete process.env.CODEX_CONFIGURATOR_ERROR_LOG_MAX_BYTES;
    }
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
};

test('logConfiguratorError appends JSON lines with timestamp, event, and metadata', () => {
  withTempErrorLogPath((logPath) => {
    const result = logConfiguratorError('config.write.failed', {
      configPath: '/tmp/config.toml',
      error: 'simulated failure',
    });

    assert.equal(result.ok, true);
    assert.equal(result.path, logPath);

    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
    assert.equal(lines.length, 1);

    const entry = JSON.parse(lines[0]);
    assert.equal(entry.event, 'config.write.failed');
    assert.equal(entry.configPath, '/tmp/config.toml');
    assert.equal(entry.error, 'simulated failure');
    assert.match(entry.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  });
});

test('logConfiguratorError rotates the log file when it exceeds max size', () => {
  withTempErrorLogPath(
    (logPath) => {
      fs.writeFileSync(logPath, 'x'.repeat(120), 'utf8');
      const result = logConfiguratorError('config.read.failed', { reason: 'too big' });

      assert.equal(result.ok, true);
      assert.equal(result.path, logPath);
      assert.equal(fs.existsSync(`${logPath}.1`), true);

      const rotatedContents = fs.readFileSync(`${logPath}.1`, 'utf8');
      assert.equal(rotatedContents.length, 120);

      const currentLines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
      assert.equal(currentLines.length, 1);
      const entry = JSON.parse(currentLines[0]);
      assert.equal(entry.event, 'config.read.failed');
      assert.equal(entry.reason, 'too big');
    },
    { maxBytes: 64 }
  );
});
