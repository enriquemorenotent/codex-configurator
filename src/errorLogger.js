import fs from 'fs';
import os from 'os';
import path from 'path';

const DEFAULT_ERROR_LOG_PATH = path.join(os.homedir(), '.codex-configurator-errors.log');
const DEFAULT_ERROR_LOG_MAX_BYTES = 1024 * 1024;
const ERROR_LOG_MAX_BYTES_ENV_VAR = 'CODEX_CONFIGURATOR_ERROR_LOG_MAX_BYTES';

const getErrorLogPath = () =>
  process.env.CODEX_CONFIGURATOR_ERROR_LOG_PATH || DEFAULT_ERROR_LOG_PATH;

const parsePositiveInteger = (value) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
};

const getErrorLogMaxBytes = () =>
  parsePositiveInteger(process.env[ERROR_LOG_MAX_BYTES_ENV_VAR]) || DEFAULT_ERROR_LOG_MAX_BYTES;

const ensureLogDirectory = (logPath) => {
  const directoryPath = path.dirname(logPath);
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true, mode: 0o700 });
  }
};

const rotateLogFileIfNeeded = (logPath, maxBytes) => {
  try {
    const stats = fs.statSync(logPath);
    if (!stats.isFile() || stats.size < maxBytes) {
      return;
    }

    const rotatedPath = `${logPath}.1`;
    if (fs.existsSync(rotatedPath)) {
      fs.unlinkSync(rotatedPath);
    }

    fs.renameSync(logPath, rotatedPath);
  } catch {}
};

export const logConfiguratorError = (event, details = {}) => {
  const payload = {
    timestamp: new Date().toISOString(),
    event: String(event || 'unknown'),
    ...details,
  };
  const logPath = getErrorLogPath();
  const maxBytes = getErrorLogMaxBytes();

  try {
    ensureLogDirectory(logPath);
    rotateLogFileIfNeeded(logPath, maxBytes);
    fs.appendFileSync(logPath, `${JSON.stringify(payload)}\n`, 'utf8');
    return {
      ok: true,
      path: logPath,
    };
  } catch {
    return {
      ok: false,
      path: logPath,
    };
  }
};
