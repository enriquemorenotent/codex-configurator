import os from 'node:os';
import path from 'node:path';

export const MAIN_CONFIG_FILE_ID = 'main';

const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';

const expandHomePath = (value, homeDir = os.homedir()) => {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }

  if (text === '~') {
    return homeDir;
  }

  if (text.startsWith('~/') || text.startsWith('~\\')) {
    return path.join(homeDir, text.slice(2));
  }

  return text;
};

const normalizeConfiguredPath = (value, baseDir) => {
  const expanded = expandHomePath(value);
  if (!expanded) {
    return '';
  }

  return path.isAbsolute(expanded) ? expanded : path.resolve(baseDir, expanded);
};

const buildMainConfigEntry = (mainConfigPath) => ({
  id: MAIN_CONFIG_FILE_ID,
  kind: 'main',
  label: 'main config',
  path: mainConfigPath,
  agentNames: [],
});

const normalizeAgentName = (agentName, fallbackIndex) => {
  const trimmed = String(agentName || '').trim();
  if (trimmed) {
    return trimmed;
  }

  return `agent-${fallbackIndex}`;
};

export const buildAgentConfigFileEntries = (mainConfigData, mainConfigPath) => {
  const agentNodes = isPlainObject(mainConfigData) && isPlainObject(mainConfigData.agents)
    ? mainConfigData.agents
    : {};
  const normalizedMainConfigPath = String(mainConfigPath || '').trim() || '';
  const baseDir = path.dirname(normalizedMainConfigPath || process.cwd());
  const byPath = new Map();
  let index = 0;

  Object.entries(agentNodes).forEach(([agentName, definition]) => {
    if (!isPlainObject(definition)) {
      return;
    }

    const candidate = normalizeConfiguredPath(definition.config_file, baseDir);
    if (!candidate || !definition.config_file) {
      return;
    }

    const resolvedPath = path.resolve(candidate);
    if (!path.isAbsolute(resolvedPath)) {
      return;
    }

    const safeName = normalizeAgentName(agentName, ++index);

    const existing = byPath.get(resolvedPath);
    if (existing) {
      existing.agentNames.push(safeName);
      return;
    }

    byPath.set(resolvedPath, {
      id: `agent:${resolvedPath}`,
      kind: 'agent',
      label: `agents.${safeName}.config_file`,
      path: resolvedPath,
      agentNames: [safeName],
    });
  });

  const entries = [];
  byPath.forEach((entry) => {
    const allAgents = [...new Set(entry.agentNames)].sort((a, b) => a.localeCompare(b));
    const label = allAgents.length === 1
      ? `agent: ${allAgents[0]} (${entry.path})`
      : `agents: ${allAgents.join(', ')} (${entry.path})`;

    entries.push({
      ...entry,
      label,
      agentNames: allAgents,
    });
  });

  return entries.sort((left, right) => left.label.localeCompare(right.label));
};

export const buildConfigFileCatalog = (mainConfigSnapshot = { path: '', data: {} }) => {
  const normalizedMainPath = path.resolve(
    String(mainConfigSnapshot.path || '').trim() || path.resolve(process.cwd(), '.codex', 'config.toml')
  );
  const mainEntry = buildMainConfigEntry(normalizedMainPath);

  const agentEntries = buildAgentConfigFileEntries(mainConfigSnapshot.data || {}, normalizedMainPath);

  return [mainEntry, ...agentEntries];
};
