import fs from 'fs';
import os from 'os';
import path from 'path';

const DEFAULT_ERROR_LOG_PATH = path.join(os.homedir(), '.codex-configurator-errors.log');

const getErrorLogPath = () =>
  process.env.CODEX_CONFIGURATOR_ERROR_LOG_PATH || DEFAULT_ERROR_LOG_PATH;

export const logConfiguratorError = (event, details = {}) => {
  const payload = {
    timestamp: new Date().toISOString(),
    event: String(event || 'unknown'),
    ...details,
  };
  const logPath = getErrorLogPath();

  try {
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
