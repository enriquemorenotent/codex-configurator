export const CONFIG_KEY_EXPLANATIONS = {
  model: {
    short: 'This is the model that powers Codex responses.',
    usage: 'Change it when you want a different behavior, speed, or capability.',
  },
  model_reasoning_effort: {
    short: 'This sets how carefully Codex thinks before replying.',
    usage: 'Use higher values when you need better quality and lower values when you want speed.',
  },
  model_reasoning_summary: {
    short: 'Controls how verbose the assistant’s internal recap is.',
    usage: 'Use a lighter summary when the session is noisy, or detailed when you need clarity.',
  },
  model_verbosity: {
    short: 'Controls how verbose Codex is in status text and responses.',
    usage: 'Lower values reduce log volume; higher values show more context.',
  },
  approval_policy: {
    short: 'Controls when Codex asks for permission before risky actions.',
    usage: 'Use stricter modes for sensitive tasks.',
  },
  sandbox_mode: {
    short: 'Defines how much file and command control Codex has.',
    usage: 'Use a stronger mode for convenience, a safer mode for routine browsing.',
  },
  notify: {
    short: 'Runs commands on your machine when Codex sends a notification.',
    usage: 'Use this to trigger a sound, popup, or log whenever Codex completes work.',
  },
  trust_level: {
    short: 'Controls how much command trust Codex gets for that project path.',
    usage: 'Use trusted for reliable folders and less trusted for caution.',
  },
  personality: {
    short: 'Controls the tone and style of Codex replies.',
    usage: 'Use it to make responses friendlier, more direct, or more neutral.',
  },
  features: {
    short: 'Feature switches that control optional Codex behaviors.',
    usage: 'Open this section to turn things on or off globally.',
  },
  mcp_servers: {
    short: 'Connections to MCP servers your CLI can use.',
    usage: 'Use it to review or manage external tool providers.',
  },
  projects: {
    short: 'Project folders and path preferences for Codex.',
    usage: 'Open this section to see how each project is listed.',
  },
  tui: {
    short: 'Settings that affect the terminal interface style.',
    usage: 'Open this section to adjust terminal appearance and behavior.',
  },
};

const CONFIG_PATH_EXPLANATIONS = [
  {
    path: ['features', 'rmcp_client'],
    short: 'Enable RMCP integration for external tools and workflows.',
    usage: 'Turn it off to keep tool calls strictly local to this CLI.',
  },
  {
    path: ['features', 'unified_exec'],
    short: 'Let Codex treat command execution through one unified flow.',
    usage: 'Disable for stricter separation of execution environments.',
  },
  {
    path: ['features', 'shell_snapshot'],
    short: 'Capture shell context before running a command.',
    usage: 'Disable only if you want faster startup for very short commands.',
  },
  {
    path: ['features', 'steer'],
    short: 'Allow interactive route-control for ambiguous steps.',
    usage: 'Turn off if you prefer fully automatic execution flow.',
  },
  {
    path: ['features', 'apps'],
    short: 'Enable helper app integrations used by the Codex CLI.',
    usage: 'Disable if you want the CLI to run with fewer external integrations.',
  },
  {
    path: ['features', 'multi_agent'],
    short: 'Allow multiple background agent helpers to coordinate.',
    usage: 'Disable for a simple single-agent flow.',
  },
  {
    path: ['projects', '*', 'trust_level'],
    short: 'Controls how much trust this project gets for command execution.',
    usage: 'Use trusted for known folders, untrusted for extra prompts.',
  },
  {
    path: ['mcp_servers', '*', 'url'],
    short: 'Endpoint used to reach the MCP server.',
    usage: 'Keep this URL correct so the server can be reached.',
  },
  {
    path: ['mcp_servers', '*', 'command'],
    short: 'Command used to start an MCP server process.',
    usage: 'Use a stable command so MCP comes up reliably.',
  },
  {
    path: ['mcp_servers', '*', 'args'],
    short: 'Arguments passed to the MCP server command.',
    usage: 'Edit carefully so the server process can still start.',
  },
  {
    path: ['mcp_servers', '*', 'http_headers'],
    short: 'HTTP headers for MCP transport requests.',
    usage: 'Keep authentication and custom headers with your endpoint needs.',
  },
  {
    path: ['tui', 'status_line'],
    short: 'Status widgets shown in the TUI status line.',
    usage: 'Reorder this array to match what you want visible while working.',
  },
];

const CONFIG_VALUE_OPTIONS = {
  model_reasoning_effort: ['low', 'medium', 'high', 'xhigh'],
  personality: ['pragmatic', 'concise', 'helpful', 'neutral'],
  trust_level: ['trusted', 'untrusted', 'ask'],
  approval_policy: ['untrusted', 'on-failure', 'on-request', 'never'],
  sandbox_mode: ['read-only', 'workspace-write', 'danger-full-access'],
  model_reasoning_summary: ['auto', 'concise', 'detailed', 'none'],
  model_verbosity: ['low', 'medium', 'high'],
};

const CONFIG_PATH_OPTIONS = [
  {
    path: ['projects', '*', 'trust_level'],
    values: ['trusted', 'untrusted', 'ask'],
    explanations: {
      trusted: 'Runs with normal trust for this project.',
      untrusted: 'Limits risky actions and prompts more often.',
      ask: 'Requests confirmation before sensitive work.',
    },
  },
];

const CONFIG_OPTION_EXPLANATIONS = {
  model_reasoning_effort: {
    low: 'Fast and direct responses.',
    medium: 'Balanced reasoning for most tasks.',
    high: 'Deeper thinking and richer answers.',
    xhigh: 'Maximum depth for complex work.',
  },
  personality: {
    pragmatic: 'Practical, direct, and concise direction.',
    concise: 'Shorter responses and fewer details.',
    helpful: 'Friendly explanations and extra context.',
    neutral: 'Minimal style, no extra tone.',
  },
  trust_level: {
    trusted: 'Runs with normal trust for this path.',
    untrusted: 'Limits risky actions and prompts more often.',
    ask: 'Requests confirmation before sensitive work.',
  },
  approval_policy: {
    untrusted: 'Requires approval in more situations.',
    'on-failure': 'Only asks when a command fails.',
    'on-request': 'Requests approval before risky commands.',
    never: 'Tries to proceed without prompts.',
  },
  sandbox_mode: {
    'read-only': 'Read-only filesystem and safer command behavior.',
    'workspace-write': 'Allows edits only in current workspace.',
    'danger-full-access': 'Permits broader file and command access.',
  },
  model_reasoning_summary: {
    auto: 'Adaptive summary verbosity.',
    concise: 'Compact summary text.',
    detailed: 'Full breakdown of reasoning context.',
    none: 'No summary output.',
  },
  model_verbosity: {
    low: 'Quiet status updates.',
    medium: 'Normal status output.',
    high: 'Verbose status output.',
  },
};

const makePathSegments = (segments, key) => {
  const normalizedSegments = Array.isArray(segments)
    ? segments.map((segment) => String(segment))
    : [];

  return [...normalizedSegments, String(key)];
};

const pathMatches = (actualPath, patternPath) =>
  actualPath.length === patternPath.length &&
  actualPath.every((segment, index) => patternPath[index] === '*' || patternPath[index] === segment);

const getContextEntry = (segments, key, candidates) => {
  const fullPath = makePathSegments(segments, key);

  return candidates.find((entry) => pathMatches(fullPath, entry.path)) || null;
};

export const getConfigHelp = (segments, key) =>
  getContextEntry(segments, key, CONFIG_PATH_EXPLANATIONS) ||
  CONFIG_KEY_EXPLANATIONS[key] ||
  null;

export const getConfigOptions = (segments, key, value, kind) => {
  if (kind !== 'value') {
    return null;
  }

  if (typeof value === 'boolean') {
    return [false, true];
  }

  const context = getContextEntry(segments, key, CONFIG_PATH_OPTIONS);
  if (context) {
    return context.values;
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
