import {
  getReferenceOptionForPath,
  getReferenceVariantForPath,
} from './configReference.js';

const makePathSegments = (segments, key) => {
  const normalizedSegments = Array.isArray(segments)
    ? segments.map((segment) => String(segment))
    : [];

  if (normalizedSegments[normalizedSegments.length - 1] === String(key)) {
    return normalizedSegments;
  }

  return [...normalizedSegments, String(key)];
};

const getReferenceEntry = (segments, key) => getReferenceOptionForPath(makePathSegments(segments, key));

const getReferenceUsage = (entry) => {
  if (entry.enumValues.length > 0) {
    return null;
  }

  if (entry.type === 'boolean') {
    return null;
  }

  if (entry.type === 'table') {
    return 'Press Enter to open this section and edit nested settings.';
  }

  if (entry.type.startsWith('array<')) {
    return 'This setting accepts a list value.';
  }

  if (entry.type.startsWith('map<')) {
    return 'This setting accepts key/value pairs.';
  }

  return null;
};

const buildReferenceHelp = (entry) => {
  if (!entry) {
    return null;
  }

  return {
    short: String(entry.description || '').trim() || null,
    usage: getReferenceUsage(entry),
  };
};

export const getConfigHelp = (segments, key) => {
  const referenceEntry = getReferenceEntry(segments, key);
  const referenceHelp = buildReferenceHelp(referenceEntry);

  if (referenceHelp) {
    return referenceHelp;
  }

  return null;
};

export const getConfigVariantMeta = (segments, key) =>
  getReferenceVariantForPath(makePathSegments(segments, key));

export const getConfigOptions = (segments, key, value, kind) => {
  if (kind !== 'value') {
    return null;
  }

  const referenceEntry = getReferenceEntry(segments, key);

  if (typeof value === 'boolean') {
    return [false, true];
  }

  if (referenceEntry?.type === 'boolean') {
    return [false, true];
  }

  if (referenceEntry?.enumValues?.length > 0) {
    return referenceEntry.enumValues;
  }

  return null;
};

export const getConfigOptionExplanation = (segments, key, option) => {
  const referenceEntry = getReferenceOptionForPath(makePathSegments(segments, key));
  const enumDescription = referenceEntry?.enumOptionDescriptions?.[String(option)];
  if (enumDescription) {
    return enumDescription;
  }

  return null;
};

export const getConfigDefaultOption = (segments, key, kind, options) => {
  if (kind !== 'value' || !Array.isArray(options) || options.length === 0) {
    return null;
  }

  const fullPath = makePathSegments(segments, key);
  const referenceEntry = getReferenceOptionForPath(fullPath);
  const schemaDefault = referenceEntry?.defaultValue;
  if (schemaDefault === null || schemaDefault === undefined) {
    return null;
  }

  if (options.some((option) => Object.is(option, schemaDefault))) {
    return schemaDefault;
  }

  if (typeof schemaDefault !== 'string') {
    const schemaDefaultAsString = String(schemaDefault);
    return options.some((option) => Object.is(option, schemaDefaultAsString))
      ? schemaDefaultAsString
      : null;
  }

  return null;
};
