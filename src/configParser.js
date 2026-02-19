import fs from 'fs';
import os from 'os';
import path from 'path';
import * as toml from 'toml';
import { stringify } from '@iarna/toml';
import {
  getConfigFeatureDefinition,
  getConfigFeatureKeys,
} from './configFeatures.js';
import {
  getReferenceOptionForPath,
  getReferenceCustomIdPlaceholder,
  getReferenceRootDefinitions,
  getReferenceTableDefinitions,
} from './configReference.js';

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
  const featureKeys = [...getConfigFeatureKeys()].sort((left, right) => left.localeCompare(right));
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
    const preview = isConfigured ? previewValue(value) : `${String(defaultValue)} [default]`;
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

  return sortRowsAlphabetically([
    ...rows,
    ...configuredKeys
      .filter((key) => !seenKeys.has(key))
      .sort((left, right) => left.localeCompare(right))
      .map((key) => {
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
      }),
  ]);
};

const isStringReferenceType = (type) => /^string(?:\s|$)/.test(String(type || '').trim());
const isBooleanReferenceType = (type) => String(type || '').trim() === 'boolean';

const inferBooleanDefaultFromDescription = (description) => {
  const text = String(description || '');

  if (
    /\bdefaults?\s+to\s+true\b/i.test(text) ||
    /\bdefault:\s*true\b/i.test(text) ||
    /\bdefault\s*=\s*true\b/i.test(text)
  ) {
    return true;
  }

  if (
    /\bdefaults?\s+to\s+false\b/i.test(text) ||
    /\bdefault:\s*false\b/i.test(text) ||
    /\bdefault\s*=\s*false\b/i.test(text)
  ) {
    return false;
  }

  return false;
};

const getBooleanReferenceDefault = (pathSegments, key) => {
  const referenceOption = getReferenceOptionForPath([...pathSegments, String(key)]);
  if (!isBooleanReferenceType(referenceOption?.type)) {
    return null;
  }

  return inferBooleanDefaultFromDescription(referenceOption?.description);
};

const formatMissingDefinitionLabel = (definition, pathSegments) => {
  if (definition.kind === 'table') {
    return `${definition.key} /`;
  }

  const booleanDefault = getBooleanReferenceDefault(pathSegments, definition.key);
  if (booleanDefault !== null) {
    return `${definition.key} = ${String(booleanDefault)} [default]`;
  }

  const referenceOption = getReferenceOptionForPath([...pathSegments, String(definition.key)]);
  if (isStringReferenceType(referenceOption?.type)) {
    return `${definition.key} = ""`;
  }

  return `${definition.key} = default`;
};

const formatRowLabel = (key, kind, value) =>
  kind === 'table'
    ? `${key} /`
    : kind === 'tableArray'
      ? `${key} / [array:${value.length}]`
      : `${key} = ${previewValue(value)}`;

const isPathDeprecated = (pathSegments, key) =>
  Boolean(getReferenceOptionForPath([...pathSegments, String(key)])?.deprecated) ||
  isToolsWebSearchDeprecated(pathSegments, key);

const sortRowsAlphabetically = (rows) =>
  [...rows].sort((left, right) => String(left.key).localeCompare(String(right.key)));

const formatPlaceholderLabel = (placeholder) => {
  const cleaned = String(placeholder || '')
    .replace(/^</, '')
    .replace(/>$/, '');

  return cleaned || 'id';
};

const appendCustomIdActionRow = (rows, pathSegments) => {
  const placeholder = getReferenceCustomIdPlaceholder(pathSegments);
  if (!placeholder) {
    return rows;
  }

  const labelName = formatPlaceholderLabel(placeholder);

  return [
    ...rows,
    {
      key: `add:${placeholder}`,
      kind: 'action',
      action: 'add-custom-id',
      placeholder: labelName,
      pathSegment: null,
      label: `+ add ${labelName}`,
      preview: '',
      isConfigured: true,
      isDeprecated: false,
    },
  ];
};

const buildDefinedRows = (node, definitions, pathSegments) => {
  const rows = [];
  const configuredKeys = Object.keys(node);
  const configuredSet = new Set(configuredKeys);
  const seenKeys = new Set();

  definitions.forEach((definition) => {
    const isConfigured = configuredSet.has(definition.key);
    seenKeys.add(definition.key);

    if (!isConfigured) {
      const booleanDefault = getBooleanReferenceDefault(pathSegments, definition.key);
      const value =
        definition.kind === 'table'
          ? {}
          : definition.kind === 'array'
            ? []
            : booleanDefault !== null
              ? booleanDefault
              : undefined;

      rows.push({
        key: definition.key,
        kind: definition.kind,
        value,
        pathSegment: definition.key,
        label: formatMissingDefinitionLabel(definition, pathSegments),
        preview: booleanDefault !== null ? `${String(booleanDefault)} [default]` : 'default',
        isConfigured: false,
        isDeprecated: Boolean(definition.isDeprecated) || isPathDeprecated(pathSegments, definition.key),
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
      isDeprecated: Boolean(definition.isDeprecated) || isPathDeprecated(pathSegments, definition.key),
    });
  });

  return sortRowsAlphabetically([
    ...rows,
    ...configuredKeys
      .filter((key) => !seenKeys.has(key))
      .sort((left, right) => left.localeCompare(right))
      .map((key) => {
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
          isDeprecated: isPathDeprecated(pathSegments, key),
        };
      }),
  ]);
};

const buildRootRows = (node) => buildDefinedRows(node, getReferenceRootDefinitions(), []);

const getTableDefinitions = (pathSegments) =>
  Array.isArray(pathSegments) ? getReferenceTableDefinitions(pathSegments) : [];

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
    if (tableDefinitions.length > 0) {
      return appendCustomIdActionRow(
        buildDefinedRows({}, tableDefinitions, pathSegments),
        pathSegments
      );
    }

    return appendCustomIdActionRow([], pathSegments);
  }

  if (isPlainObject(node)) {
    if (pathSegments.length === 0) {
      return buildRootRows(node);
    }

    if (isFeaturesTable(pathSegments)) {
      return buildFeatureRows(node);
    }

    const tableDefinitions = getTableDefinitions(pathSegments);
    if (tableDefinitions.length > 0) {
      return appendCustomIdActionRow(
        buildDefinedRows(node, tableDefinitions, pathSegments),
        pathSegments
      );
    }

    return appendCustomIdActionRow(
      sortRowsAlphabetically(
        Object.entries(node).map(([key, value]) => {
          const kind = getNodeKind(value);

          return {
            key,
            kind,
            value,
            pathSegment: key,
            label: formatRowLabel(key, kind, value),
            preview: previewValue(value),
            isDeprecated: isPathDeprecated(pathSegments, key),
          };
        })
      ),
      pathSegments
    );
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
