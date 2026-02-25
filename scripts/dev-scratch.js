#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const SCRATCH_CONFIG_FILENAME = '.codex-configurator.scratch.toml';

const getScratchConfigPath = () => path.join(process.cwd(), SCRATCH_CONFIG_FILENAME);

const createScratchConfigFile = (scratchPath) => {
  fs.writeFileSync(scratchPath, '', 'utf8');
};

const runConfiguratorWithScratchConfig = async (scratchConfigPath) => {
  const child = spawn(process.execPath, [path.resolve(process.cwd(), 'index.js'), '--config', scratchConfigPath], {
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
  const filePath = getScratchConfigPath();
  createScratchConfigFile(filePath);

  try {
    const result = await runConfiguratorWithScratchConfig(filePath);
    process.exit(getExitCode(result));
  } finally {
    fs.rmSync(filePath, { force: true });
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
