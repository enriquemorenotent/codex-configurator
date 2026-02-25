import {
  getConfigFeatureDefinition,
  getConfigFeatureDefinitionOrFallback,
} from './configFeatures.js';
import {
  getReferenceOptionForPath,
  getReferenceCustomIdPlaceholder,
  getReferenceDescendantOptions,
  getReferenceTableDefinitions,
} from './configReference.js';

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
    'gpt-5.3-codex': 'Latest frontier agentic coding model.',
    'gpt-5.3-codex-spark': 'Ultra-fast coding model.',
    'gpt-5.2-codex': 'Frontier agentic coding model.',
    'gpt-5.1-codex-max': 'Codex-optimized flagship for deep and fast reasoning.',
    'gpt-5.2': 'Latest frontier model with improvements across knowledge, reasoning and coding.',
    'gpt-5.1-codex-mini': 'Optimized for codex. Cheaper, faster, but less capable.',
  },
  trust_level: {
    trusted: 'Runs with normal trust for this path.',
    untrusted: 'Limits risky actions and prompts more often.',
  },
};
const SECTION_PURPOSE_OVERRIDES = {
  agents: 'Named agent definitions and per-agent configuration file references.',
  apps: 'Per-app enablement rules and tool-level approval controls.',
  features: 'Feature flags for optional and experimental Codex behavior.',
  feedback: 'Feedback submission settings for Codex surfaces.',
  history: 'Session history retention policy and on-disk size limits.',
  mcp_servers: 'MCP server definitions, transport settings, and authentication configuration.',
  model_providers: 'Model provider definitions, API endpoints, and credential settings.',
  notice: 'Visibility toggles for startup and migration notices.',
  otel: 'OpenTelemetry exporter configuration for telemetry and traces.',
  profiles: 'Named profile overrides you can select per session.',
  projects: 'Project/worktree trust settings scoped by filesystem path.',
  sandbox_workspace_write: 'Workspace-write sandbox behavior, writable roots, and network access rules.',
  shell_environment_policy: 'Shell environment inheritance and variable override policy.',
  skills: 'Skill discovery and loading controls.',
  tools: 'Tool-related configuration, including legacy compatibility flags.',
  tui: 'Terminal UI behavior, notifications, and presentation settings.',
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

const formatPlaceholderLabel = (placeholder) => {
  const cleaned = String(placeholder || '')
    .replace(/^</, '')
    .replace(/>$/, '');

  return cleaned || 'id';
};

const toFirstSentence = (text) => {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  const periodIndex = normalized.indexOf('. ');
  if (periodIndex < 0) {
    return normalized;
  }

  return normalized.slice(0, periodIndex + 1);
};

const getSectionPurposeDescription = (descendantOptions) => {
  for (const option of descendantOptions) {
    const firstSentence = toFirstSentence(option?.description);
    if (firstSentence) {
      return firstSentence;
    }
  }

  return '';
};

const buildInferredSectionHelp = (segments, key) => {
  const sectionPath = makePathSegments(segments, key);
  const childDefinitions = getReferenceTableDefinitions(sectionPath);
  const descendantOptions = getReferenceDescendantOptions(sectionPath);
  const customPlaceholder = getReferenceCustomIdPlaceholder(sectionPath);
  const parentCustomPlaceholder = getReferenceCustomIdPlaceholder(sectionPath.slice(0, -1));

  if (childDefinitions.length === 0 && descendantOptions.length === 0 && !customPlaceholder) {
    return null;
  }

  const rootOverride = sectionPath.length === 1
    ? SECTION_PURPOSE_OVERRIDES[sectionPath[0]]
    : null;
  const customLabel = customPlaceholder ? formatPlaceholderLabel(customPlaceholder) : '';
  const bestPurposeDescription = getSectionPurposeDescription(descendantOptions);
  const dynamicEntryLabel = parentCustomPlaceholder
    ? formatPlaceholderLabel(parentCustomPlaceholder)
    : '';
  const short = rootOverride
    || (dynamicEntryLabel
      ? `Configuration for this ${dynamicEntryLabel} entry.`
      : '')
    || bestPurposeDescription
    || (customLabel
      ? `Section for custom ${customLabel} entries.`
      : 'Section with related settings.');

  return {
    short,
    usage: null,
  };
};

const getReferenceUsage = (entry) => {
  if (entry.deprecated) {
    return 'This option is deprecated in the official configuration reference.';
  }

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

  const inferredSectionHelp = buildInferredSectionHelp(segments, key);
  if (inferredSectionHelp) {
    return inferredSectionHelp;
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
