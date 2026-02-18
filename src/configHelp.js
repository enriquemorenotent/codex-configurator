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

const CONFIG_VALUE_OPTIONS = {
  model_reasoning_effort: ['low', 'medium', 'high', 'xhigh'],
  personality: ['pragmatic', 'concise', 'helpful', 'neutral'],
  trust_level: ['trusted', 'untrusted', 'ask'],
  approval_policy: ['untrusted', 'on-failure', 'on-request', 'never'],
  sandbox_mode: ['read-only', 'workspace-write', 'danger-full-access'],
  model_reasoning_summary: ['auto', 'concise', 'detailed', 'none'],
  model_verbosity: ['low', 'medium', 'high'],
};

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

export const getConfigHelp = (key) => CONFIG_KEY_EXPLANATIONS[key] || null;

export const getConfigOptions = (key, value, kind) => {
  if (kind !== 'value') {
    return null;
  }

  if (typeof value === 'boolean') {
    return [false, true];
  }

  if (Object.prototype.hasOwnProperty.call(CONFIG_VALUE_OPTIONS, key)) {
    return CONFIG_VALUE_OPTIONS[key];
  }

  return null;
};

export const getConfigOptionExplanation = (key, option) =>
  CONFIG_OPTION_EXPLANATIONS[key]?.[String(option)] || null;
