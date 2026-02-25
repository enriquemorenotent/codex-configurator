#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG_SCHEMA_URL = 'https://developers.openai.com/codex/config-schema.json';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_OUTPUT_PATH = path.join(REPO_ROOT, 'src', 'reference', 'config-schema.json');

const fetchSchema = async () => {
  const response = await fetch(CONFIG_SCHEMA_URL, {
    headers: {
      accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch config schema (${response.status} ${response.statusText})`);
  }

  return response.json();
};

const writeJson = (targetPath, payload) => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const run = async () => {
  const schema = await fetchSchema();
  writeJson(SCHEMA_OUTPUT_PATH, schema);
  console.log(`Wrote schema: ${SCHEMA_OUTPUT_PATH}`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
