import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { buildConfigFileCatalog } from '../src/fileContext.js';

const HOME_DIR = '/tmp/codex-home';

test('buildConfigFileCatalog includes main config and resolves relative agent config_file paths', () => {
  const mainConfigPath = path.join(HOME_DIR, '.codex', 'config.toml');
  const catalog = buildConfigFileCatalog({
    path: mainConfigPath,
    data: {
      agents: {
        reviewer: {
          config_file: 'agents/reviewer.toml',
        },
      },
    },
  });

  const mainEntry = catalog.find((entry) => entry.id === 'main');
  assert.equal(Boolean(mainEntry), true);
  assert.equal(mainEntry.path, mainConfigPath);

  const agentEntry = catalog.find((entry) => entry.kind === 'agent');
  assert.equal(Boolean(agentEntry), true);
  assert.equal(agentEntry.path, path.join(HOME_DIR, '.codex', 'agents', 'reviewer.toml'));
  assert.equal(agentEntry.agentNames[0], 'reviewer');
});

test('buildConfigFileCatalog expands tilde in agent config_file', () => {
  const mainConfigPath = path.join(HOME_DIR, '.codex', 'config.toml');
  const catalog = buildConfigFileCatalog({
    path: mainConfigPath,
    data: {
      agents: {
        researcher: {
          config_file: '~/codex/agents/researcher.toml',
        },
      },
    },
  });

  const agentEntry = catalog.find((entry) => entry.kind === 'agent');
  assert.equal(Boolean(agentEntry), true);
  assert.equal(agentEntry.path, path.join(os.homedir(), 'codex', 'agents', 'researcher.toml'));
});

test('buildConfigFileCatalog deduplicates duplicate agent config_file values', () => {
  const mainConfigPath = path.join(HOME_DIR, '.codex', 'config.toml');
  const catalog = buildConfigFileCatalog({
    path: mainConfigPath,
    data: {
      agents: {
        one: {
          config_file: 'agents/shared.toml',
        },
        two: {
          config_file: 'agents/shared.toml',
        },
      },
    },
  });

  const agentEntries = catalog.filter((entry) => entry.kind === 'agent');
  assert.equal(agentEntries.length, 1);
  assert.equal(agentEntries[0].agentNames.includes('one'), true);
  assert.equal(agentEntries[0].agentNames.includes('two'), true);
});
