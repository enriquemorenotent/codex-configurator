import fs from 'fs';
import os from 'os';
import path from 'path';
import * as toml from 'toml';
import { stringify } from '@iarna/toml';
import {
  getConfigFeatureDefinition,
  getConfigFeatureKeys,
} from './configFeatures.js';

export const CONFIG_PATH = path.join(os.homedir(), '.codex', 'config.toml');
export const MAX_DETAIL_CHARS = 2200;
const MAX_ARRAY_PREVIEW_ITEMS = 3;
const MAX_ARRAY_PREVIEW_CHARS = 52;
const ROOT_CONFIG_DEFINITIONS = [
  { key: 'approval_policy', kind: 'value' },
  { key: 'chatgpt_base_url', kind: 'value' },
  { key: 'check_for_update_on_startup', kind: 'value' },
  { key: 'cli_auth_credentials_store', kind: 'value' },
  { key: 'compact_prompt', kind: 'value' },
  { key: 'developer_instructions', kind: 'value' },
  { key: 'disable_paste_burst', kind: 'value' },
  { key: 'experimental_compact_prompt_file', kind: 'value' },
  { key: 'experimental_use_freeform_apply_patch', kind: 'value' },
  { key: 'experimental_use_unified_exec_tool', kind: 'value' },
  { key: 'file_opener', kind: 'value' },
  { key: 'forced_chatgpt_workspace_id', kind: 'value' },
  { key: 'forced_login_method', kind: 'value' },
  { key: 'hide_agent_reasoning', kind: 'value' },
  { key: 'include_apply_patch_tool', kind: 'value' },
  { key: 'instructions', kind: 'value' },
  { key: 'log_dir', kind: 'value' },
  { key: 'mcp_oauth_callback_port', kind: 'value' },
  { key: 'mcp_oauth_credentials_store', kind: 'value' },
  { key: 'model', kind: 'value' },
  { key: 'model_auto_compact_token_limit', kind: 'value' },
  { key: 'model_context_window', kind: 'value' },
  { key: 'model_instructions_file', kind: 'value' },
  { key: 'model_provider', kind: 'value' },
  { key: 'model_reasoning_effort', kind: 'value' },
  { key: 'model_reasoning_summary', kind: 'value' },
  { key: 'model_supports_reasoning_summaries', kind: 'value' },
  { key: 'model_verbosity', kind: 'value' },
  { key: 'notify', kind: 'value' },
  { key: 'oss_provider', kind: 'value' },
  { key: 'personality', kind: 'value' },
  { key: 'profile', kind: 'value' },
  { key: 'project_doc_fallback_filenames', kind: 'value' },
  { key: 'project_doc_max_bytes', kind: 'value' },
  { key: 'project_root_markers', kind: 'value' },
  { key: 'review_model', kind: 'value' },
  { key: 'sandbox_mode', kind: 'value' },
  { key: 'show_raw_agent_reasoning', kind: 'value' },
  { key: 'suppress_unstable_features_warning', kind: 'value' },
  { key: 'tool_output_token_limit', kind: 'value' },
  { key: 'web_search', kind: 'value' },
  { key: 'windows_wsl_setup_acknowledged', kind: 'value' },
  { key: 'agents', kind: 'table' },
  { key: 'apps', kind: 'table' },
  { key: 'feedback', kind: 'table' },
  { key: 'features', kind: 'table' },
  { key: 'history', kind: 'table' },
  { key: 'mcp_servers', kind: 'table' },
  { key: 'model_providers', kind: 'table' },
  { key: 'notice', kind: 'table' },
  { key: 'otel', kind: 'table' },
  { key: 'profiles', kind: 'table' },
  { key: 'projects', kind: 'table' },
  { key: 'sandbox_workspace_write', kind: 'table' },
  { key: 'shell_environment_policy', kind: 'table' },
  { key: 'skills', kind: 'table' },
  { key: 'tools', kind: 'table' },
  { key: 'tui', kind: 'table' },
];
const TABLE_CONFIG_DEFINITIONS = {
  feedback: [
    { key: 'enabled', kind: 'value' },
  ],
  history: [
    { key: 'max_bytes', kind: 'value' },
    { key: 'persistence', kind: 'value' },
  ],
  notice: [
    { key: 'hide_full_access_warning', kind: 'value' },
    { key: 'hide_gpt5_1_migration_prompt', kind: 'value' },
    { key: 'hide_gpt-5.1-codex-max_migration_prompt', kind: 'value' },
    { key: 'hide_rate_limit_model_nudge', kind: 'value' },
    { key: 'hide_world_writable_warning', kind: 'value' },
    { key: 'model_migrations', kind: 'table' },
  ],
  sandbox_workspace_write: [
    { key: 'network_access', kind: 'value' },
    { key: 'writable_roots', kind: 'array' },
    { key: 'exclude_slash_tmp', kind: 'value' },
    { key: 'exclude_tmpdir_env_var', kind: 'value' },
  ],
  shell_environment_policy: [
    { key: 'inherit', kind: 'value' },
    { key: 'ignore_default_excludes', kind: 'value' },
    { key: 'experimental_use_profile', kind: 'value' },
    { key: 'include_only', kind: 'array' },
    { key: 'exclude', kind: 'array' },
    { key: 'set', kind: 'table' },
  ],
  skills: [
    { key: 'config', kind: 'array' },
  ],
  tools: [
    { key: 'web_search', kind: 'value' },
  ],
  tui: [
    { key: 'alternate_screen', kind: 'value' },
    { key: 'animations', kind: 'value' },
    { key: 'notification_method', kind: 'value' },
    { key: 'notifications', kind: 'value' },
    { key: 'show_tooltips', kind: 'value' },
    { key: 'status_line', kind: 'array' },
  ],
};

export const isPlainObject = (value) =>
  Object.prototype.toString.call(value) === '[object Object]';

const truncateText = (text, maxLength) =>
  text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 1))}…`;

const resolveSegment = (segment) => {
  if (typeof segment === 'number') {
    return segment;
  }

  if (typeof segment === 'string' && /^\d+$/.test(segment)) {
    const parsed = Number(segment);
    return Number.isInteger(parsed) ? parsed : segment;
  }

  return segment;
};

const formatArrayItemSummary = (value) => {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.length} item(s)]`;
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return '{}';
    }

    const preview = keys.slice(0, 2).join(', ');
    const suffix = keys.length > 2 ? ', …' : '';
    return `{${preview}${suffix}}`;
  }

  return String(value);
};

const formatArrayPreview = (value) => {
  if (value.length === 0) {
    return '[]';
  }

  const items = value.slice(0, MAX_ARRAY_PREVIEW_ITEMS).map(formatArrayItemSummary);
  const remaining = value.length - items.length;
  const joined = `[${items.join(', ')}${remaining > 0 ? `, +${remaining}` : ''}]`;

  return truncateText(joined, MAX_ARRAY_PREVIEW_CHARS);
};

export const readConfig = () => {
  try {
    const fileContents = fs.readFileSync(CONFIG_PATH, 'utf8');
    const data = toml.parse(fileContents);

    return {
      ok: true,
      path: CONFIG_PATH,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      path: CONFIG_PATH,
      error: error?.message || 'Unable to read or parse configuration file.',
    };
  }
};

const normalizeFilePath = (outputPath) => outputPath || CONFIG_PATH;

export const writeConfig = (data, outputPath = CONFIG_PATH) => {
  try {
    const payload = stringify(data);
    fs.writeFileSync(normalizeFilePath(outputPath), `${payload}\n`);

    return {
      ok: true,
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || 'Unable to write configuration file.',
    };
  }
};

const getNodeKind = (value) => {
  if (isPlainObject(value)) {
    return 'table';
  }

  if (Array.isArray(value)) {
    if (value.length > 0 && value.every(isPlainObject)) {
      return 'tableArray';
    }

    return 'array';
  }

  return 'value';
};

const previewValue = (value) => {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return formatArrayPreview(value);
  }

  if (isPlainObject(value)) {
    return '{}';
  }

  return String(value);
};

const isFeaturesTable = (segments) =>
  Array.isArray(segments) && segments[segments.length - 1] === 'features';

const buildFeatureRows = (node) => {
  const rows = [];
  const featureKeys = getConfigFeatureKeys();
  const configuredKeys = Object.keys(node);
  const configuredSet = new Set(configuredKeys);
  const seenKeys = new Set();

  featureKeys.forEach((key) => {
    const isConfigured = configuredSet.has(key);
    const definition = getConfigFeatureDefinition(key);
    const defaultValue = typeof definition?.defaultValue === 'boolean'
      ? definition.defaultValue
      : false;
    const value = isConfigured ? node[key] : defaultValue;
    const preview = isConfigured ? previewValue(value) : 'default';
    const isDeprecated = Boolean(definition?.deprecation);

    seenKeys.add(key);
    rows.push({
      key,
      kind: 'value',
      value,
      pathSegment: key,
      label: `${key} = ${preview}`,
      preview,
      isConfigured,
      isDeprecated,
      isDocumented: true,
    });
  });

  return [...rows, ...configuredKeys.filter((key) => !seenKeys.has(key)).map((key) => {
    const value = node[key];
    const preview = previewValue(value);
    const definition = getConfigFeatureDefinition(key);

    return {
      key,
      kind: getNodeKind(value),
      value,
      pathSegment: key,
      label: `${key} = ${preview} [not in official list]`,
      preview,
      isConfigured: true,
      isDeprecated: Boolean(definition?.deprecation),
      isDocumented: false,
    };
  })];
};

const formatMissingDefinitionLabel = (definition) =>
  definition.kind === 'table' ? `${definition.key} /` : `${definition.key} = default`;

const formatRowLabel = (key, kind, value) =>
  kind === 'table'
    ? `${key} /`
    : kind === 'tableArray'
      ? `${key} / [array:${value.length}]`
      : `${key} = ${previewValue(value)}`;

const buildDefinedRows = (node, definitions, pathSegments) => {
  const rows = [];
  const configuredKeys = Object.keys(node);
  const configuredSet = new Set(configuredKeys);
  const seenKeys = new Set();

  definitions.forEach((definition) => {
    const isConfigured = configuredSet.has(definition.key);
    seenKeys.add(definition.key);

    if (!isConfigured) {
      const value =
        definition.kind === 'table'
          ? {}
          : definition.kind === 'array'
            ? []
            : undefined;

      rows.push({
        key: definition.key,
        kind: definition.kind,
        value,
        pathSegment: definition.key,
        label: formatMissingDefinitionLabel(definition),
        preview: 'default',
        isConfigured: false,
        isDeprecated: isToolsWebSearchDeprecated(pathSegments, definition.key),
      });
      return;
    }

    const value = node[definition.key];
    const kind = getNodeKind(value);
    rows.push({
      key: definition.key,
      kind,
      value,
      pathSegment: definition.key,
      label: formatRowLabel(definition.key, kind, value),
      preview: previewValue(value),
      isConfigured: true,
      isDeprecated: isToolsWebSearchDeprecated(pathSegments, definition.key),
    });
  });

  return [
    ...rows,
    ...configuredKeys.filter((key) => !seenKeys.has(key)).map((key) => {
      const value = node[key];
      const kind = getNodeKind(value);

      return {
        key,
        kind,
        value,
        pathSegment: key,
        label: formatRowLabel(key, kind, value),
        preview: previewValue(value),
        isConfigured: true,
        isDeprecated: isToolsWebSearchDeprecated(pathSegments, key),
      };
    }),
  ];
};

const buildRootRows = (node) => buildDefinedRows(node, ROOT_CONFIG_DEFINITIONS, []);

const getTableDefinitions = (pathSegments) => {
  if (!Array.isArray(pathSegments) || pathSegments.length !== 1) {
    return null;
  }

  const tableKey = String(pathSegments[0]);
  return TABLE_CONFIG_DEFINITIONS[tableKey] || null;
};

const isToolsWebSearchDeprecated = (pathSegments, key) =>
  pathSegments[pathSegments.length - 1] === 'tools' && key === 'web_search';

export const getNodeAtPath = (root, segments) => {
  let current = root;

  for (const segment of segments) {
    if (current == null) {
      return undefined;
    }

    const normalizedSegment = resolveSegment(segment);

    if (Array.isArray(current) && Number.isInteger(normalizedSegment)) {
      current = current[normalizedSegment];
      continue;
    }

    if (!isPlainObject(current) && !Array.isArray(current)) {
      return undefined;
    }

    if (typeof current === 'object' && normalizedSegment in current) {
      current = current[normalizedSegment];
    } else {
      return undefined;
    }
  }

  return current;
};

export const buildRows = (node, pathSegments = []) => {
  if (node == null) {
    if (pathSegments.length === 1 && pathSegments[0] === 'features') {
      return buildFeatureRows({});
    }

    const tableDefinitions = getTableDefinitions(pathSegments);
    if (tableDefinitions) {
      return buildDefinedRows({}, tableDefinitions, pathSegments);
    }

    return [];
  }

  if (isPlainObject(node)) {
    if (pathSegments.length === 0) {
      return buildRootRows(node);
    }

    if (isFeaturesTable(pathSegments)) {
      return buildFeatureRows(node);
    }

    const tableDefinitions = getTableDefinitions(pathSegments);
    if (tableDefinitions) {
      return buildDefinedRows(node, tableDefinitions, pathSegments);
    }

    return Object.entries(node).map(([key, value]) => {
      const kind = getNodeKind(value);

      return {
        key,
        kind,
        value,
        pathSegment: key,
        label: formatRowLabel(key, kind, value),
        preview: previewValue(value),
        isDeprecated: isToolsWebSearchDeprecated(pathSegments, key),
      };
    });
  }

  if (Array.isArray(node)) {
    if (node.length === 0) {
      return [];
    }

    return node.map((value, index) => {
      const kind = getNodeKind(value);
      const label = kind === 'table' ? `[${index}] /` : `[${index}] = ${previewValue(value)}`;

      return {
        key: String(index),
        kind,
        value,
        pathSegment: index,
        label,
        preview: previewValue(value),
      };
    });
  }

  return [];
};

export const formatDetails = (value) => {
  if (isPlainObject(value) || Array.isArray(value)) {
    const text = JSON.stringify(value, null, 2);
    return text.length > MAX_DETAIL_CHARS ? `${text.slice(0, MAX_DETAIL_CHARS)}…` : text;
  }

  return String(value);
};

export const setValueAtPath = (root, segments, nextValue) => {
  if (!root || segments.length === 0) {
    return root;
  }

  const copy = isPlainObject(root) ? { ...root } : Array.isArray(root) ? [...root] : root;
  let current = copy;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = resolveSegment(segments[index]);
    const next = current?.[segment];
    const nextContainer = isPlainObject(next)
      ? { ...next }
      : Array.isArray(next)
        ? [...next]
        : {};
    current[segment] = nextContainer;
    current = nextContainer;
  }

  const lastSegment = resolveSegment(segments[segments.length - 1]);
  current[lastSegment] = nextValue;

  return copy;
};

export const deleteValueAtPath = (root, segments) => {
  if (!root || segments.length === 0) {
    return root;
  }

  const copy = isPlainObject(root) ? { ...root } : Array.isArray(root) ? [...root] : root;
  let current = copy;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = resolveSegment(segments[index]);
    const next = current?.[segment];
    const nextContainer = isPlainObject(next)
      ? { ...next }
      : Array.isArray(next)
        ? [...next]
        : {};
    current[segment] = nextContainer;
    current = nextContainer;
  }

  const lastSegment = resolveSegment(segments[segments.length - 1]);

  if (Array.isArray(current) && Number.isInteger(lastSegment)) {
    current.splice(lastSegment, 1);
    return copy;
  }

  if (current && typeof current === 'object') {
    delete current[lastSegment];
  }

  return copy;
};

export const getTableKind = (node) => getNodeKind(node);
