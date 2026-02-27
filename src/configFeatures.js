import {
  getReferenceFeatureKeys,
  getReferenceOptionForPath,
} from './configReference.js';

const prettifyFeatureName = (key) =>
  key
    .split('_')
    .map((segment) => `${segment[0]?.toUpperCase() || ''}${segment.slice(1)}`)
    .join(' ');

const buildFeatureDefinitionFromReference = (key) => {
  const normalizedKey = String(key || '').trim();
  if (!normalizedKey) {
    return null;
  }

  const referenceEntry = getReferenceOptionForPath(['features', normalizedKey]);
  if (!referenceEntry) {
    return null;
  }

  const description = String(referenceEntry.description || '').trim();
  const defaultValue = typeof referenceEntry.defaultValue === 'boolean'
    ? referenceEntry.defaultValue
    : null;

  return {
    key: normalizedKey,
    short: description || 'Official configuration option.',
    usage: null,
    deprecation: referenceEntry.deprecated === true ? 'Deprecated configuration option.' : null,
    defaultValue,
    isDocumented: true,
  };
};

const DOCUMENTED_REFERENCE_FEATURE_KEYS = getReferenceFeatureKeys();

export const CONFIG_FEATURE_DEFINITIONS = DOCUMENTED_REFERENCE_FEATURE_KEYS
  .map((key) => buildFeatureDefinitionFromReference(key))
  .filter(Boolean);

const FEATURE_DEFINITION_MAP = CONFIG_FEATURE_DEFINITIONS.reduce((acc, definition) => {
  acc[definition.key] = definition;

  return acc;
}, {});

export const getConfigFeatureKeys = () => {
  return DOCUMENTED_REFERENCE_FEATURE_KEYS;
};

export const getConfigFeatureDefinition = (key) => FEATURE_DEFINITION_MAP[key];

export const getConfigFeatureDefinitionOrFallback = (key) => {
  if (!key) {
    return {
      short: `${prettifyFeatureName(String(key))}`,
      usage: 'Uses a supported feature flag in your Codex config.',
      defaultValue: false,
      isDocumented: false,
    };
  }

  return (
    FEATURE_DEFINITION_MAP[key] || {
      key,
      short: prettifyFeatureName(String(key)),
      usage: 'This configured key is not in the official feature list.',
      defaultValue: false,
      isDocumented: false,
    }
  );
};
