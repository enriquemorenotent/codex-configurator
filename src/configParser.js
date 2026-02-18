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
    const value = isConfigured ? node[key] : false;
    const preview = isConfigured ? previewValue(value) : 'default';
    const definition = getConfigFeatureDefinition(key);
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
    });
  });

  return [...rows, ...configuredKeys.filter((key) => !seenKeys.has(key)).map((key) => {
    const value = node[key];
    const preview = previewValue(value);

    return {
      key,
      kind: getNodeKind(value),
      value,
      pathSegment: key,
      label: `${key} = ${preview}`,
      preview,
      isConfigured: true,
    };
  })];
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
    return [];
  }

  if (isPlainObject(node)) {
    if (isFeaturesTable(pathSegments)) {
      return buildFeatureRows(node);
    }

    return Object.entries(node).map(([key, value]) => {
      const kind = getNodeKind(value);
      const label =
        kind === 'table'
          ? `${key} /`
          : kind === 'tableArray'
            ? `${key} / [array:${value.length}]`
            : `${key} = ${previewValue(value)}`;

      return {
        key,
        kind,
        value,
        pathSegment: key,
        label,
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
