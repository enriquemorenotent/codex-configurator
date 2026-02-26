import fs from 'fs';
import os from 'os';
import path from 'path';
import * as toml from 'toml';
import { stringify } from '@iarna/toml';
import {
  getConfigFeatureKeys,
} from './configFeatures.js';
import {
  getReferenceOptionForPath,
  getReferenceCustomIdPlaceholder,
  getReferenceRootDefinitions,
  getReferenceTableDefinitions,
  getReferenceVariantForPath,
} from './configReference.js';
import { logConfiguratorError } from './errorLogger.js';

export const CONFIG_PATH_ENV_VAR = 'CODEX_CONFIGURATOR_CONFIG_PATH';
const CONFIG_PATH_FLAG = '--config';
const DEFAULT_CONFIG_FILE_SEGMENTS = ['.codex', 'config.toml'];
export const DEFAULT_CONFIG_PATH = path.join(os.homedir(), ...DEFAULT_CONFIG_FILE_SEGMENTS);
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

const expandHomePath = (value, homeDir) => {
  if (value === '~') {
    return homeDir;
  }

  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(homeDir, value.slice(2));
  }

  return value;
};

const normalizeConfiguredPath = (value, homeDir) => {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  if (!normalizedValue) {
    return '';
  }

  const expanded = expandHomePath(normalizedValue, homeDir);
  return path.resolve(expanded);
};

const getCliConfigPath = (argv = process.argv.slice(2)) => {
  for (let index = 0; index < argv.length; index += 1) {
    const argument = typeof argv[index] === 'string' ? argv[index].trim() : '';
    if (!argument) {
      continue;
    }

    if (argument === CONFIG_PATH_FLAG) {
      const nextArgument = argv[index + 1];
      return typeof nextArgument === 'string' ? nextArgument : '';
    }

    if (argument.startsWith(`${CONFIG_PATH_FLAG}=`)) {
      return argument.slice(CONFIG_PATH_FLAG.length + 1);
    }
  }

  return '';
};

export const resolveConfigPath = ({
  argv = process.argv.slice(2),
  env = process.env,
  homeDir = os.homedir(),
} = {}) => {
  const cliConfiguredPath = normalizeConfiguredPath(getCliConfigPath(argv), homeDir);
  if (cliConfiguredPath) {
    return cliConfiguredPath;
  }

  const envConfiguredPath = normalizeConfiguredPath(env?.[CONFIG_PATH_ENV_VAR], homeDir);
  if (envConfiguredPath) {
    return envConfiguredPath;
  }

  return path.join(homeDir, ...DEFAULT_CONFIG_FILE_SEGMENTS);
};

export const CONFIG_PATH = resolveConfigPath();

export const readConfig = (configPath = CONFIG_PATH) => {
  try {
    const targetPath = configPath;
    const fileContents = fs.readFileSync(targetPath, 'utf8');
    const data = toml.parse(fileContents);

    return {
      ok: true,
      path: targetPath,
      data,
    };
  } catch (error) {
    const targetPath = configPath;
    const errorMessage = error?.message || 'Unable to read or parse configuration file.';
    logConfiguratorError('config.read.failed', {
      configPath: targetPath,
      error: errorMessage,
    });

    return {
      ok: false,
      path: targetPath,
      error: errorMessage,
    };
  }
};

const normalizeFilePath = (outputPath) => outputPath || CONFIG_PATH;
const EMPTY_PATH_TABLE_MARKER_KEY = '__codex_configurator_empty_path_table_marker__';

const cloneForTomlWrite = (value, pathSegments = []) => {
  if (Array.isArray(value)) {
    return value.map((item, index) => cloneForTomlWrite(item, [...pathSegments, String(index)]));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const customPlaceholder = getReferenceCustomIdPlaceholder(pathSegments);
  const clonedEntries = Object.entries(value).map(([key, child]) => {
    if (
      customPlaceholder === '<path>' &&
      isPlainObject(child) &&
      Object.keys(child).length === 0
    ) {
      return [key, { [EMPTY_PATH_TABLE_MARKER_KEY]: undefined }];
    }

    return [key, cloneForTomlWrite(child, [...pathSegments, key])];
  });

  return Object.fromEntries(clonedEntries);
};

export const writeConfig = (data, outputPath = CONFIG_PATH) => {
  const targetPath = normalizeFilePath(outputPath);
  const directoryPath = path.dirname(targetPath);
  const fileName = path.basename(targetPath);
  const tempPath = path.join(
    directoryPath,
    `.${fileName}.${process.pid}.${Date.now()}.tmp`
  );

  try {
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true, mode: 0o700 });
    }

    const payload = stringify(cloneForTomlWrite(data));
    let tempFd = null;

    try {
      tempFd = fs.openSync(tempPath, 'wx', 0o600);
      fs.writeFileSync(tempFd, `${payload}\n`, 'utf8');
      fs.fsyncSync(tempFd);
      fs.closeSync(tempFd);
      tempFd = null;

      fs.renameSync(tempPath, targetPath);
    } finally {
      if (tempFd !== null) {
        try {
          fs.closeSync(tempFd);
        } catch {}
      }

      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch {}
      }
    }

    return {
      ok: true,
    };
  } catch (error) {
    const errorMessage = error?.message || 'Unable to write configuration file.';
    logConfiguratorError('config.write.failed', {
      configPath: targetPath,
      error: errorMessage,
    });

    return {
      ok: false,
      error: errorMessage,
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
    const value = isConfigured ? node[key] : undefined;
    const preview = isConfigured ? previewValue(value) : 'not set';
    const isDeprecated = false;

    seenKeys.add(key);
    rows.push({
      key,
      kind: 'value',
      value,
      pathSegment: key,
      label: isConfigured ? `${key} = ${preview}` : `${key} = not set`,
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

        return {
          key,
          kind: getNodeKind(value),
          value,
          pathSegment: key,
          label: `${key} = ${preview} [not in official list]`,
          preview,
          isConfigured: true,
          isDeprecated: false,
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

const isPathDeprecated = () => false;

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
    const variantMeta = getReferenceVariantForPath([...pathSegments, String(definition.key)]);
    const isMixedVariant = variantMeta?.kind === 'scalar_object';
    seenKeys.add(definition.key);

    if (!isConfigured) {
      if (definition.kind === 'value' || isMixedVariant) {
        rows.push({
          key: definition.key,
          kind: 'value',
          value: undefined,
          pathSegment: definition.key,
          label: `${definition.key} = not set`,
          preview: 'not set',
          isConfigured: false,
          isDeprecated: false,
        });
        return;
      }

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
        preview: booleanDefault !== null
          ? `${String(booleanDefault)} [default]`
          : 'default',
        isConfigured: false,
        isDeprecated: false,
      });
      return;
    }

    const value = node[definition.key];
    const valueKind = getNodeKind(value);
    const kind = definition.kind === 'value' || isMixedVariant ? 'value' : valueKind;
    const label = isMixedVariant && valueKind === 'table'
      ? `${definition.key} /`
      : formatRowLabel(definition.key, kind, value);
    rows.push({
      key: definition.key,
      kind,
      value,
      pathSegment: definition.key,
      label,
      preview: previewValue(value),
      isConfigured: true,
      isDeprecated: false,
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
          isDeprecated: false,
        };
      }),
  ]);
};

const buildRootRows = (node) => buildDefinedRows(node, getReferenceRootDefinitions(), []);

const getTableDefinitions = (pathSegments) =>
  Array.isArray(pathSegments) ? getReferenceTableDefinitions(pathSegments) : [];

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

const isEmptyPlainObject = (value) =>
  isPlainObject(value) && Object.keys(value).length === 0;

export const deleteValueAtPathPruningEmptyObjects = (root, segments) => {
  if (!root || segments.length === 0) {
    return root;
  }

  let nextData = deleteValueAtPath(root, segments);
  const parentPath = segments.slice(0, -1);

  for (let depth = parentPath.length - 1; depth >= 0; depth -= 1) {
    const candidatePath = parentPath.slice(0, depth + 1);
    const candidateValue = getNodeAtPath(nextData, candidatePath);
    if (!isEmptyPlainObject(candidateValue)) {
      break;
    }

    const containerPath = candidatePath.slice(0, -1);
    const containerValue =
      containerPath.length === 0
        ? nextData
        : getNodeAtPath(nextData, containerPath);
    if (!isPlainObject(containerValue)) {
      continue;
    }

    nextData = deleteValueAtPath(nextData, candidatePath);
  }

  return nextData;
};

export const getTableKind = (node) => getNodeKind(node);
