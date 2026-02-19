import {
  getConfigFeatureDefinition,
  getConfigFeatureDefinitionOrFallback,
} from './configFeatures.js';
import { getReferenceOptionForPath } from './configReference.js';

const CONFIG_VALUE_OPTIONS = {
  model: [
    'gpt-5.3-codex',
    'gpt-5.3-codex-spark',
    'gpt-5.2-codex',
    'gpt-5.1-codex-max',
    'gpt-5.2',
    'gpt-5.1-codex-mini',
  ],
};

const CONFIG_PATH_EXPLANATIONS = [
  {
    path: ['tools', 'web_search'],
    short: 'Deprecated legacy web search flag.',
    usage: 'Use the top-level web_search setting instead.',
    deprecation: 'tools.web_search is deprecated; use the top-level web_search setting instead.',
  },
  {
    path: ['projects', '*', 'trust_level'],
    short: 'Controls how much trust this project gets for command execution.',
    usage: 'Use trusted for known folders, untrusted for extra prompts.',
  },
];

const CONFIG_PATH_OPTIONS = [
  {
    path: ['projects', '*', 'trust_level'],
    values: ['trusted', 'untrusted'],
    explanations: {
      trusted: 'Runs with normal trust for this path.',
      untrusted: 'Limits risky actions and prompts more often.',
    },
  },
];

const CONFIG_OPTION_EXPLANATIONS = {
  model: {
    'gpt-5.3-codex': 'Default balanced agentic model, tuned for general coding tasks.',
    'gpt-5.3-codex-spark': 'Fastest model in this set, optimized for quick coding responses.',
    'gpt-5.2-codex': 'Strong frontier model for deeper code reasoning.',
    'gpt-5.1-codex-max': 'Flagship Codex model for the deepest, fastest reasoning.',
    'gpt-5.2': 'Latest frontier model with broad improvements across coding and reasoning.',
    'gpt-5.1-codex-mini': 'Cheaper, faster model with lower capability than flagship options.',
  },
  trust_level: {
    trusted: 'Runs with normal trust for this path.',
    untrusted: 'Limits risky actions and prompts more often.',
  },
};

const makePathSegments = (segments, key) => {
  const normalizedSegments = Array.isArray(segments)
    ? segments.map((segment) => String(segment))
    : [];

  if (normalizedSegments[normalizedSegments.length - 1] === String(key)) {
    return normalizedSegments;
  }

  return [...normalizedSegments, String(key)];
};

const pathMatches = (actualPath, patternPath) =>
  actualPath.length === patternPath.length &&
  actualPath.every((segment, index) => patternPath[index] === '*' || patternPath[index] === segment);

const getContextEntry = (segments, key, candidates) => {
  const fullPath = makePathSegments(segments, key);
  return candidates.find((entry) => pathMatches(fullPath, entry.path)) || null;
};

const getReferenceEntry = (segments, key) => getReferenceOptionForPath(makePathSegments(segments, key));

const getReferenceUsage = (entry) => {
  if (entry.deprecated) {
    return 'This option is deprecated in the official configuration reference.';
  }

  if (entry.enumValues.length > 0) {
    return `Allowed values: ${entry.enumValues.join(', ')}.`;
  }

  if (entry.type === 'boolean') {
    return 'Toggle between true and false.';
  }

  if (entry.type === 'table') {
    return 'This section groups related settings.';
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
    short: entry.description || 'Official configuration option.',
    usage: getReferenceUsage(entry),
    deprecation: entry.deprecated ? entry.description : undefined,
  };
};

export const getConfigHelp = (segments, key) => {
  const contextHelp = getContextEntry(segments, key, CONFIG_PATH_EXPLANATIONS);
  if (contextHelp) {
    return contextHelp;
  }

  const referenceEntry = getReferenceEntry(segments, key);
  const referenceHelp = buildReferenceHelp(referenceEntry);

  if (segments?.[segments.length - 1] === 'features') {
    const featureDefinition = getConfigFeatureDefinition(String(key));
    if (referenceHelp) {
      return {
        ...referenceHelp,
        usage: featureDefinition?.deprecation || referenceHelp.usage || featureDefinition?.usage || null,
        deprecation: featureDefinition?.deprecation || referenceHelp.deprecation,
      };
    }

    return getConfigFeatureDefinitionOrFallback(key);
  }

  if (referenceHelp) {
    return referenceHelp;
  }

  return null;
};

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

  const context = getContextEntry(segments, key, CONFIG_PATH_OPTIONS);
  if (context) {
    return context.values;
  }

  if (referenceEntry?.enumValues?.length > 0) {
    return referenceEntry.enumValues;
  }

  if (Object.prototype.hasOwnProperty.call(CONFIG_VALUE_OPTIONS, key)) {
    return CONFIG_VALUE_OPTIONS[key];
  }

  return null;
};

export const getConfigOptionExplanation = (segments, key, option) => {
  const context = getContextEntry(segments, key, CONFIG_PATH_OPTIONS);
  if (context?.explanations) {
    return context.explanations[String(option)] || null;
  }

  return CONFIG_OPTION_EXPLANATIONS[key]?.[String(option)] || null;
};

export const getConfigDefaultOption = (segments, key, kind, options) => {
  if (kind !== 'value' || !Array.isArray(options) || options.length === 0) {
    return null;
  }

  const fullPath = makePathSegments(segments, key);
  const pathKey = fullPath.join('.');
  const parentPath = fullPath.slice(0, -1);
  const explicitDefaults = {
    approval_policy: 'on-request',
    cli_auth_credentials_store: 'file',
    file_opener: 'vscode',
    'history.persistence': 'save-all',
    mcp_oauth_credentials_store: 'auto',
    model_reasoning_summary: 'auto',
    model_verbosity: 'medium',
    personality: 'pragmatic',
    sandbox_mode: 'read-only',
    'shell_environment_policy.inherit': 'all',
    'tui.alternate_screen': 'auto',
    'tui.notification_method': 'auto',
  };

  if (parentPath[parentPath.length - 1] === 'features') {
    const definition = getConfigFeatureDefinition(String(key));
    const featureDefault = definition?.defaultValue;

    if (typeof featureDefault === 'boolean') {
      return options.some((option) => Object.is(option, featureDefault))
        ? featureDefault
        : null;
    }
  }

  if (
    fullPath.length >= 3 &&
    fullPath[0] === 'projects' &&
    fullPath[fullPath.length - 1] === 'trust_level'
  ) {
    return options.some((option) => option === 'untrusted') ? 'untrusted' : null;
  }

  if (pathKey === 'web_search') {
    return options.some((option) => option === 'cached') ? 'cached' : null;
  }

  if (
    fullPath.length >= 3 &&
    fullPath[0] === 'profiles' &&
    fullPath[fullPath.length - 1] === 'web_search'
  ) {
    return options.some((option) => option === 'cached') ? 'cached' : null;
  }

  if (Object.prototype.hasOwnProperty.call(explicitDefaults, pathKey)) {
    const explicitDefault = explicitDefaults[pathKey];
    return options.some((option) => Object.is(option, explicitDefault))
      ? explicitDefault
      : null;
  }

  return null;
};
