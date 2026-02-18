import fs from 'fs';
import os from 'os';
import path from 'path';
import * as toml from 'toml';

export const CONFIG_PATH = path.join(os.homedir(), '.codex', 'config.toml');
export const MAX_DETAIL_CHARS = 2200;
const MAX_ARRAY_PREVIEW_ITEMS = 3;
const MAX_ARRAY_PREVIEW_CHARS = 52;

export const isPlainObject = (value) =>
  Object.prototype.toString.call(value) === '[object Object]';

const truncateText = (text, maxLength) =>
  text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 1))}…`;

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

export const getNodeAtPath = (root, segments) => {
  let current = root;

  for (const segment of segments) {
    if (current == null) {
      return undefined;
    }

    if (Array.isArray(current) && Number.isInteger(segment)) {
      current = current[segment];
      continue;
    }

    if (!isPlainObject(current) && !Array.isArray(current)) {
      return undefined;
    }

    if (typeof current === 'object' && segment in current) {
      current = current[segment];
    } else {
      return undefined;
    }
  }

  return current;
};

export const buildRows = (node) => {
  if (node == null) {
    return [];
  }

  if (isPlainObject(node)) {
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

export const getTableKind = (node) => getNodeKind(node);
