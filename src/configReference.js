import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const CONFIG_REFERENCE_DATA = require('./reference/config-reference.json');

const DOCUMENT_ID = 'config.toml';
const PLACEHOLDER_SEGMENT = /^<[^>]+>$/;
const KIND_PRIORITY = {
  value: 1,
  array: 2,
  table: 3,
};

const normalizeSegments = (segments) =>
  Array.isArray(segments) ? segments.map((segment) => String(segment)) : [];

const isPlaceholderSegment = (segment) =>
  PLACEHOLDER_SEGMENT.test(segment) || String(segment).endsWith('[]');

const isCustomIdPlaceholder = (segment) =>
  isPlaceholderSegment(segment) &&
  segment !== '<index>' &&
  !String(segment).endsWith('[]');

const normalizeType = (type) => String(type || '').replace(/\s+/g, ' ').trim();

const mapTypeToKind = (type) => {
  const normalizedType = normalizeType(type);

  if (normalizedType === 'table') {
    return 'table';
  }

  if (normalizedType.startsWith('array<')) {
    return 'array';
  }

  return 'value';
};

const getContainerKind = (path, depth) => {
  const nextSegment = path[depth + 1];

  if (nextSegment === '<index>' || String(nextSegment).endsWith('[]')) {
    return 'array';
  }

  return 'table';
};

const pathPrefixMatches = (referencePath, actualPrefix) => {
  if (referencePath.length < actualPrefix.length) {
    return false;
  }

  for (let index = 0; index < actualPrefix.length; index += 1) {
    const referenceSegment = referencePath[index];
    const actualSegment = actualPrefix[index];

    if (isPlaceholderSegment(referenceSegment)) {
      continue;
    }

    if (referenceSegment !== actualSegment) {
      return false;
    }
  }

  return true;
};

const fullPathMatches = (referencePath, actualPath) =>
  referencePath.length === actualPath.length &&
  pathPrefixMatches(referencePath, actualPath);

const countConcreteSegments = (segments) =>
  segments.reduce((count, segment) => count + (isPlaceholderSegment(segment) ? 0 : 1), 0);

const configDocument =
  CONFIG_REFERENCE_DATA?.documents?.find((document) => document?.id === DOCUMENT_ID) || null;

const referenceOptions = Array.isArray(configDocument?.options)
  ? configDocument.options.map((option) => {
      const keyPath = normalizeSegments(option?.key_path);
      const key = String(option?.key || keyPath.join('.'));

      return {
        key,
        keyPath,
        type: normalizeType(option?.type),
        enumValues: Array.isArray(option?.enum_values)
          ? option.enum_values.map((value) => String(value))
          : [],
        description: String(option?.description || ''),
        deprecated: option?.deprecated === true,
      };
    })
  : [];

const optionsByKey = new Map(referenceOptions.map((option) => [option.key, option]));

const mergeDefinition = (map, definition) => {
  const existing = map.get(definition.key);
  if (!existing) {
    map.set(definition.key, definition);
    return;
  }

  const existingPriority = KIND_PRIORITY[existing.kind] || 0;
  const nextPriority = KIND_PRIORITY[definition.kind] || 0;

  map.set(definition.key, {
    ...existing,
    kind: nextPriority > existingPriority ? definition.kind : existing.kind,
    isDeprecated: Boolean(existing.isDeprecated || definition.isDeprecated),
  });
};

export const getReferenceOptionForPath = (pathSegments) => {
  const normalizedPath = normalizeSegments(pathSegments);
  if (normalizedPath.length === 0) {
    return null;
  }

  const exactKey = normalizedPath.join('.');
  const exactMatch = optionsByKey.get(exactKey);
  if (exactMatch) {
    return exactMatch;
  }

  const candidates = referenceOptions.filter((option) => fullPathMatches(option.keyPath, normalizedPath));
  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => {
    const concreteDelta = countConcreteSegments(right.keyPath) - countConcreteSegments(left.keyPath);
    if (concreteDelta !== 0) {
      return concreteDelta;
    }

    return left.key.localeCompare(right.key);
  });

  return candidates[0];
};

export const getReferenceTableDefinitions = (pathSegments = []) => {
  const normalizedPath = normalizeSegments(pathSegments);
  const childDefinitions = new Map();
  const depth = normalizedPath.length;

  referenceOptions.forEach((option) => {
    if (!pathPrefixMatches(option.keyPath, normalizedPath)) {
      return;
    }

    if (option.keyPath.length <= depth) {
      return;
    }

    const childKey = option.keyPath[depth];
    if (isPlaceholderSegment(childKey)) {
      return;
    }

    const isLeaf = option.keyPath.length === depth + 1;
    const kind = isLeaf ? mapTypeToKind(option.type) : getContainerKind(option.keyPath, depth);

    mergeDefinition(childDefinitions, {
      key: childKey,
      kind,
      isDeprecated: isLeaf ? option.deprecated : false,
    });
  });

  return [...childDefinitions.values()].sort((left, right) => left.key.localeCompare(right.key));
};

export const getReferenceRootDefinitions = () => getReferenceTableDefinitions([]);

const featureKeys = [
  ...new Set(
    referenceOptions
      .filter(
        (option) =>
          option.keyPath.length === 2 &&
          option.keyPath[0] === 'features' &&
          !isPlaceholderSegment(option.keyPath[1])
      )
      .map((option) => option.keyPath[1])
  ),
].sort((left, right) => left.localeCompare(right));

export const getReferenceFeatureKeys = () => featureKeys;

export const getReferenceCustomIdPlaceholder = (pathSegments = []) => {
  const normalizedPath = normalizeSegments(pathSegments);
  const depth = normalizedPath.length;
  const placeholders = new Set();

  referenceOptions.forEach((option) => {
    if (!pathPrefixMatches(option.keyPath, normalizedPath)) {
      return;
    }

    if (option.keyPath.length <= depth) {
      return;
    }

    const childKey = option.keyPath[depth];
    if (isCustomIdPlaceholder(childKey)) {
      placeholders.add(childKey);
    }
  });

  const [firstMatch] = [...placeholders];
  return firstMatch || null;
};

export const getReferenceDescendantOptions = (pathSegments = []) => {
  const normalizedPath = normalizeSegments(pathSegments);

  return referenceOptions
    .filter(
      (option) =>
        pathPrefixMatches(option.keyPath, normalizedPath) &&
        option.keyPath.length > normalizedPath.length
    )
    .sort((left, right) => left.keyPath.length - right.keyPath.length || left.key.localeCompare(right.key));
};
