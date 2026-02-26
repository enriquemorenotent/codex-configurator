#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const SCRATCH_WORKSPACE_NAME = '.codex-configurator.scratch';
const SCRATCH_CONFIG_FILENAME = 'config.toml';

const getScratchWorkspacePath = () => path.join(process.cwd(), SCRATCH_WORKSPACE_NAME);
const getScratchConfigPath = () => path.join(
  getScratchWorkspacePath(),
  '.codex',
  SCRATCH_CONFIG_FILENAME
);

const parseResetFlag = (argv = process.argv.slice(2)) => argv.includes('--reset');

const createScratchConfigFile = (scratchPath) => {
  fs.mkdirSync(path.dirname(scratchPath), { recursive: true });
  if (!fs.existsSync(scratchPath)) {
    fs.writeFileSync(scratchPath, '', 'utf8');
  }
};

const runConfiguratorWithScratchConfig = async (workspacePath) => {
  const child = spawn(process.execPath, [
    path.resolve(process.cwd(), 'index.js'),
    '--codex-dir',
    workspacePath,
  ], {
    stdio: 'inherit',
  });

  return new Promise((resolve, reject) => {
    child.on('error', (error) => {
      reject(error);
    });

    child.on('close', (code, signal) => {
      resolve({ code, signal });
    });
  });
};

const getExitCode = ({ code, signal }) => {
  if (typeof code === 'number') {
    return code;
  }

  if (typeof signal === 'string') {
    return signal === 'SIGINT' ? 130 : 1;
  }

  return 1;
};

const run = async () => {
  const isReset = parseResetFlag();
  const workspacePath = getScratchWorkspacePath();
  const filePath = getScratchConfigPath();

  if (isReset) {
    fs.rmSync(workspacePath, { recursive: true, force: true });
  }

  createScratchConfigFile(filePath);

  const result = await runConfiguratorWithScratchConfig(workspacePath);
  process.exit(getExitCode(result));
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
