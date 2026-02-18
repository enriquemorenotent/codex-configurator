export const CONFIG_KEY_EXPLANATIONS = {
  model: {
    short: 'This is the model that powers Codex responses.',
    usage: 'Change it when you want a different behavior, speed, or capability.',
  },
  model_reasoning_effort: {
    short: 'This sets how carefully Codex thinks before replying.',
    usage: 'Use higher values when you need better quality and lower values when you want speed.',
  },
  notify: {
    short: 'Runs commands on your machine when Codex sends a notification.',
    usage: 'Use this to trigger a sound, popup, or log whenever Codex completes work.',
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

export const getConfigHelp = (key) => CONFIG_KEY_EXPLANATIONS[key] || null;
