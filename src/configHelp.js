import {
  getConfigFeatureDefinition,
  getConfigFeatureDefinitionOrFallback,
} from './configFeatures.js';

export const CONFIG_KEY_EXPLANATIONS = {
  approval_policy: {
    short: 'Sets when Codex asks for approval before executing shell commands.',
    usage: 'Stricter policies require more confirmation prompts.',
  },
  agents: {
    short: 'Defines reusable named sub-agent profiles.',
    usage: 'Each entry customizes defaults for a specific agent persona.',
  },
  apps: {
    short: 'Configures app connectors and routing behavior.',
    usage: 'Use this section to tune app-level tool integration.',
  },
  chatgpt_base_url: {
    short: 'Overrides the base URL used for ChatGPT account authentication.',
    usage: 'Set this only when you need a non-default ChatGPT auth endpoint.',
  },
  check_for_update_on_startup: {
    short: 'Controls whether Codex checks for updates at startup.',
    usage: 'Disable it if you want to avoid startup update checks.',
  },
  cli_auth_credentials_store: {
    short: 'Controls where CLI authentication credentials are stored.',
    usage: 'Choose file, keyring, or auto selection.',
  },
  compact_prompt: {
    short: 'Prompt template used by the `/compact` command.',
    usage: 'Customize this text to shape compaction output.',
  },
  developer_instructions: {
    short: 'Static instructions prepended to every model request.',
    usage: 'Use this for consistent project-wide assistant behavior.',
  },
  disable_paste_burst: {
    short: 'Disables paste-burst detection in the CLI.',
    usage: 'Enable this when paste handling conflicts with your terminal workflow.',
  },
  experimental_compact_prompt_file: {
    short: 'Path to a custom compact-prompt file (experimental).',
    usage: 'Use a file path when you want to externalize compact prompt text.',
  },
  experimental_use_freeform_apply_patch: {
    short: 'Enables freeform `apply_patch` handling (experimental).',
    usage: 'Toggle this only if you want the experimental patch flow.',
  },
  experimental_use_unified_exec_tool: {
    short: 'Enables the unified execution tool path (experimental).',
    usage: 'Use this to opt into the newer execution backend.',
  },
  feedback: {
    short: 'Controls in-product feedback collection behavior.',
    usage: 'Open this section to enable or disable feedback prompts.',
  },
  features: {
    short: 'Feature switches that control optional Codex behaviors.',
    usage: 'Open this section to turn features on or off.',
  },
  file_opener: {
    short: 'Selects which editor opens file references from Codex.',
    usage: 'Choose your preferred editor integration or disable it.',
  },
  forced_chatgpt_workspace_id: {
    short: 'Forces a specific ChatGPT workspace ID for auth.',
    usage: 'Set this only when you need to pin workspace selection.',
  },
  forced_login_method: {
    short: 'Forces a specific login path (`chatgpt` or `api`).',
    usage: 'Use this to bypass automatic login method selection.',
  },
  hide_agent_reasoning: {
    short: 'Hides summarized agent reasoning in progress output.',
    usage: 'Enable this if you want quieter progress text.',
  },
  history: {
    short: 'Controls local conversation history persistence.',
    usage: 'Open this section to tune how history is stored.',
  },
  include_apply_patch_tool: {
    short: 'Controls whether `apply_patch` is exposed as a tool.',
    usage: 'Disable this if you want to prevent patch tool usage.',
  },
  instructions: {
    short: 'Legacy alias for `developer_instructions`.',
    usage: 'Prefer `developer_instructions`; this key is for compatibility.',
  },
  log_dir: {
    short: 'Directory where Codex writes log files.',
    usage: 'Set an explicit path when you need predictable log location.',
  },
  mcp_oauth_callback_port: {
    short: 'Local callback port for MCP OAuth flows.',
    usage: 'Override when the default callback port conflicts locally.',
  },
  mcp_oauth_credentials_store: {
    short: 'Controls where MCP OAuth credentials are stored.',
    usage: 'Choose auto, file, or keyring storage.',
  },
  mcp_servers: {
    short: 'Connections to MCP servers that Codex can use.',
    usage: 'Open this section to configure MCP server endpoints and launch details.',
  },
  model: {
    short: 'Model identifier used for Codex responses.',
    usage: 'This picker shows curated model presets from this project.',
  },
  model_auto_compact_token_limit: {
    short: 'Token threshold that triggers automatic context compaction.',
    usage: 'Lower values compact earlier; higher values compact later.',
  },
  model_context_window: {
    short: 'Maximum context window size (in tokens) for model requests.',
    usage: 'Set this only when you need a custom context limit.',
  },
  model_instructions_file: {
    short: 'Path to a file containing model instruction text.',
    usage: 'Use this to load instructions from disk instead of inline config.',
  },
  model_provider: {
    short: 'Selects which configured model provider entry to use.',
    usage: 'Point this to a key defined under `model_providers`.',
  },
  model_providers: {
    short: 'Provider definitions for non-default model backends.',
    usage: 'Configure provider credentials/endpoints in this section.',
  },
  model_reasoning_effort: {
    short: 'Controls how much reasoning effort the model should use.',
    usage: 'Use lower levels for speed and higher levels for deeper reasoning.',
  },
  model_reasoning_summary: {
    short: 'Controls the verbosity of reasoning summaries.',
    usage: 'Choose concise, detailed, auto, or none.',
  },
  model_supports_reasoning_summaries: {
    short: 'Overrides automatic detection of reasoning-summary support.',
    usage: 'Set this only if you need to force support on or off.',
  },
  model_verbosity: {
    short: 'Controls verbosity of Codex status and response text.',
    usage: 'Lower values reduce output volume; higher values add context.',
  },
  notice: {
    short: 'Stores notice/banner dismissal preferences.',
    usage: 'Use this section to suppress specific informational prompts.',
  },
  notify: {
    short: 'Runs a command when Codex emits a notification event.',
    usage: 'Use this to trigger local alerts such as sound or desktop notifications.',
  },
  oss_provider: {
    short: 'Legacy alias for selecting an OSS model provider.',
    usage: 'Prefer `model_provider` for new configuration.',
  },
  otel: {
    short: 'OpenTelemetry export settings for Codex telemetry.',
    usage: 'Configure OTEL endpoint and metadata in this section.',
  },
  personality: {
    short: 'Controls the response style profile.',
    usage: 'Choose a personality preset to shape assistant tone.',
  },
  profile: {
    short: 'Selects the active named profile from `[profiles]`.',
    usage: 'Set this to apply a profile’s overrides by default.',
  },
  profiles: {
    short: 'Named profile definitions for grouped configuration overrides.',
    usage: 'Use profiles to switch between saved config modes.',
  },
  project_doc_fallback_filenames: {
    short: 'Fallback filenames checked for project instructions.',
    usage: 'Customize which files are searched when no project doc is found.',
  },
  project_doc_max_bytes: {
    short: 'Maximum bytes read from project instruction documents.',
    usage: 'Increase if your project docs are longer than the default limit.',
  },
  project_root_markers: {
    short: 'Markers used to detect project root directories.',
    usage: 'Add marker files/folders that identify root boundaries.',
  },
  projects: {
    short: 'Per-project overrides keyed by filesystem path.',
    usage: 'Use this section to set trust and behavior by project root.',
  },
  review_model: {
    short: 'Model used for code review workflows (such as `/review`).',
    usage: 'Set this when you want review tasks to use a different model.',
  },
  sandbox_mode: {
    short: 'Defines filesystem/command sandbox level for command execution.',
    usage: 'Use stricter modes for safety and broader modes for flexibility.',
  },
  sandbox_workspace_write: {
    short: 'Detailed settings for `workspace-write` sandbox behavior.',
    usage: 'Configure network access and writable root exceptions here.',
  },
  shell_environment_policy: {
    short: 'Controls which environment variables are inherited by shell tools.',
    usage: 'Use include/exclude rules to limit command environment exposure.',
  },
  show_raw_agent_reasoning: {
    short: 'Shows raw reasoning text from agents (unsafe output).',
    usage: 'Enable only if you explicitly want unfiltered raw reasoning.',
  },
  skills: {
    short: 'Skill loading and discovery configuration.',
    usage: 'Use this section to control additional skill config sources.',
  },
  suppress_unstable_features_warning: {
    short: 'Suppresses warnings about unstable features.',
    usage: 'Enable only if you want to hide unstable-feature notices.',
  },
  tool_output_token_limit: {
    short: 'Maximum token budget for tool outputs sent back to the model.',
    usage: 'Lower this to reduce tool-output verbosity in model context.',
  },
  tools: {
    short: 'Legacy tool-specific settings.',
    usage: 'Prefer current top-level settings where available.',
  },
  tui: {
    short: 'Terminal UI behavior and display settings.',
    usage: 'Open this section to configure alternate screen, notifications, and status line.',
  },
  web_search: {
    short: 'Controls web-search mode for model tool use.',
    usage: 'Use disabled, cached, or live.',
  },
  windows_wsl_setup_acknowledged: {
    short: 'Records whether WSL setup guidance has been acknowledged.',
    usage: 'Used by setup flows to avoid repeating first-run prompts.',
  },
};

const CONFIG_PATH_EXPLANATIONS = [
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
    path: ['tools', 'web_search'],
    short: 'Deprecated legacy web search flag.',
    usage: 'Use the top-level web_search setting instead.',
    deprecation: 'tools.web_search is deprecated; use the top-level web_search setting instead.',
  },
  {
    path: ['feedback', 'enabled'],
    short: 'Enables or disables feedback collection prompts.',
    usage: 'Set false to turn off feedback prompts.',
  },
  {
    path: ['history', 'max_bytes'],
    short: 'Maximum size for stored chat history on disk.',
    usage: 'Lower this value to reduce on-disk history footprint.',
  },
  {
    path: ['history', 'persistence'],
    short: 'Controls whether chat history is persisted.',
    usage: 'Use save-all to persist history, or none to disable persistence.',
  },
  {
    path: ['notice', 'hide_full_access_warning'],
    short: 'Hides the full-access sandbox warning banner.',
    usage: 'Set true to suppress this warning.',
  },
  {
    path: ['notice', 'hide_gpt5_1_migration_prompt'],
    short: 'Hides the GPT-5.1 migration prompt.',
    usage: 'Set true if you do not want this migration notice shown.',
  },
  {
    path: ['notice', 'hide_gpt-5.1-codex-max_migration_prompt'],
    short: 'Hides the gpt-5.1-codex-max migration prompt.',
    usage: 'Set true if you do not want this migration notice shown.',
  },
  {
    path: ['notice', 'hide_rate_limit_model_nudge'],
    short: 'Hides model-switch nudges shown during rate limiting.',
    usage: 'Set true to suppress this helper notice.',
  },
  {
    path: ['notice', 'hide_world_writable_warning'],
    short: 'Hides warnings about world-writable paths.',
    usage: 'Set true to suppress this warning banner.',
  },
  {
    path: ['notice', 'model_migrations'],
    short: 'Tracks migration-notice state for model changes.',
    usage: 'This table stores per-migration dismissal markers.',
  },
  {
    path: ['projects', '*', 'trust_level'],
    short: 'Controls how much trust this project gets for command execution.',
    usage: 'Use trusted for known folders, untrusted for extra prompts.',
  },
  {
    path: ['sandbox_workspace_write', 'network_access'],
    short: 'Allows or blocks network access in workspace-write sandbox mode.',
    usage: 'Set true only when commands need outbound network access.',
  },
  {
    path: ['sandbox_workspace_write', 'writable_roots'],
    short: 'Additional writable root paths in workspace-write sandbox mode.',
    usage: 'Add paths that Codex should be allowed to modify.',
  },
  {
    path: ['sandbox_workspace_write', 'exclude_slash_tmp'],
    short: 'Excludes `/tmp` from default writable roots.',
    usage: 'Use this when you do not want `/tmp` to be writable by default.',
  },
  {
    path: ['sandbox_workspace_write', 'exclude_tmpdir_env_var'],
    short: 'Excludes `$TMPDIR` from default writable roots.',
    usage: 'Use this to avoid granting write access through TMPDIR.',
  },
  {
    path: ['shell_environment_policy', 'inherit'],
    short: 'Base inheritance policy for environment variables.',
    usage: 'Use all, core, or none to define default inheritance scope.',
  },
  {
    path: ['shell_environment_policy', 'ignore_default_excludes'],
    short: 'Ignores built-in exclusion rules for environment inheritance.',
    usage: 'Enable only when you want full control over include/exclude rules.',
  },
  {
    path: ['shell_environment_policy', 'experimental_use_profile'],
    short: 'Uses shell profile loading for command environments (experimental).',
    usage: 'Enable only if you need profile-based environment loading.',
  },
  {
    path: ['shell_environment_policy', 'include_only'],
    short: 'Allowlist of environment variables to inherit.',
    usage: 'Only listed variables are inherited when this list is set.',
  },
  {
    path: ['shell_environment_policy', 'exclude'],
    short: 'Blocklist of environment variables to remove.',
    usage: 'Use this to strip sensitive or noisy variables.',
  },
  {
    path: ['shell_environment_policy', 'set'],
    short: 'Explicit environment variable overrides.',
    usage: 'Values in this table are injected into tool command environments.',
  },
  {
    path: ['skills', 'config'],
    short: 'Additional skill-config files to load.',
    usage: 'List extra skill config paths as strings.',
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
  {
    path: ['tui', 'alternate_screen'],
    short: 'Controls alternate-screen usage in the TUI.',
    usage: 'Use auto, always, or never.',
  },
  {
    path: ['tui', 'animations'],
    short: 'Enables or disables terminal UI animations.',
    usage: 'Set false for a more static interface.',
  },
  {
    path: ['tui', 'notification_method'],
    short: 'Selects terminal notification mechanism.',
    usage: 'Use auto, osc9, or bel.',
  },
  {
    path: ['tui', 'notifications'],
    short: 'Enables or disables TUI notifications.',
    usage: 'Set false to silence terminal notifications.',
  },
  {
    path: ['tui', 'show_tooltips'],
    short: 'Shows or hides UI tooltips in the TUI.',
    usage: 'Set false for a cleaner, less verbose interface.',
  },
];

const CONFIG_VALUE_OPTIONS = {
  model: [
    'gpt-5.3-codex',
    'gpt-5.3-codex-spark',
    'gpt-5.2-codex',
    'gpt-5.1-codex-max',
    'gpt-5.2',
    'gpt-5.1-codex-mini',
  ],
  model_reasoning_effort: ['minimal', 'low', 'medium', 'high', 'xhigh'],
  personality: ['pragmatic', 'friendly', 'none'],
  trust_level: ['trusted', 'untrusted'],
  approval_policy: ['untrusted', 'on-request', 'never'],
  cli_auth_credentials_store: ['file', 'keyring', 'auto'],
  file_opener: ['vscode', 'vscode-insiders', 'windsurf', 'cursor', 'none'],
  forced_login_method: ['chatgpt', 'api'],
  mcp_oauth_credentials_store: ['auto', 'file', 'keyring'],
  oss_provider: ['lmstudio', 'ollama'],
  sandbox_mode: ['read-only', 'workspace-write', 'danger-full-access'],
  web_search: ['disabled', 'cached', 'live'],
  model_reasoning_summary: ['auto', 'concise', 'detailed', 'none'],
  model_verbosity: ['low', 'medium', 'high'],
};

const CONFIG_PATH_OPTIONS = [
  {
    path: ['projects', '*', 'trust_level'],
    values: ['trusted', 'untrusted'],
    explanations: {
      trusted: 'Runs with normal trust for this project.',
      untrusted: 'Limits risky actions and prompts more often.',
    },
  },
  {
    path: ['history', 'persistence'],
    values: ['save-all', 'none'],
    explanations: {
      'save-all': 'Persist chat history to disk.',
      none: 'Disable history persistence.',
    },
  },
  {
    path: ['shell_environment_policy', 'inherit'],
    values: ['all', 'core', 'none'],
    explanations: {
      all: 'Inherit all environment variables.',
      core: 'Inherit only core/safe variables.',
      none: 'Do not inherit environment variables.',
    },
  },
  {
    path: ['tui', 'alternate_screen'],
    values: ['auto', 'always', 'never'],
    explanations: {
      auto: 'Use alternate screen based on terminal capability.',
      always: 'Always use alternate screen mode.',
      never: 'Never use alternate screen mode.',
    },
  },
  {
    path: ['tui', 'notification_method'],
    values: ['auto', 'osc9', 'bel'],
    explanations: {
      auto: 'Choose notification method automatically.',
      osc9: 'Use OSC 9 terminal notification escape.',
      bel: 'Use BEL terminal bell.',
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
  model_reasoning_effort: {
    minimal: 'Minimal reasoning for lowest latency and cost.',
    low: 'Fast and direct responses.',
    medium: 'Balanced reasoning for most tasks.',
    high: 'Deeper thinking and richer answers.',
    xhigh: 'Maximum depth for complex work.',
  },
  personality: {
    pragmatic: 'Practical, direct, and concise direction.',
    friendly: 'Warm, explanatory, and approachable responses.',
    none: 'No personality modifier; keep defaults.',
  },
  trust_level: {
    trusted: 'Runs with normal trust for this path.',
    untrusted: 'Limits risky actions and prompts more often.',
  },
  approval_policy: {
    untrusted: 'Requires approval in more situations.',
    'on-request': 'Requests approval before risky commands.',
    never: 'Tries to proceed without prompts.',
  },
  cli_auth_credentials_store: {
    file: 'Stores credentials in local files.',
    keyring: 'Stores credentials in system keyring.',
    auto: 'Automatically selects the credential store.',
  },
  file_opener: {
    vscode: 'Use Visual Studio Code for opening files.',
    'vscode-insiders': 'Use Visual Studio Code Insiders.',
    windsurf: 'Use Windsurf editor integration.',
    cursor: 'Use Cursor editor integration.',
    none: 'Disable file-opener integration.',
  },
  forced_login_method: {
    chatgpt: 'Force ChatGPT account login flow.',
    api: 'Force API key login flow.',
  },
  mcp_oauth_credentials_store: {
    auto: 'Automatically select MCP OAuth credential store.',
    file: 'Store MCP OAuth credentials in files.',
    keyring: 'Store MCP OAuth credentials in system keyring.',
  },
  oss_provider: {
    lmstudio: 'Use LM Studio as OSS provider.',
    ollama: 'Use Ollama as OSS provider.',
  },
  sandbox_mode: {
    'read-only': 'Read-only filesystem and safer command behavior.',
    'workspace-write': 'Allows edits only in current workspace.',
    'danger-full-access': 'Permits broader file and command access.',
  },
  web_search: {
    disabled: 'Disables web search tool usage.',
    cached: 'Allows only cached web search results.',
    live: 'Allows live web search results from the network.',
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

export const getConfigHelp = (segments, key) =>
  getContextEntry(segments, key, CONFIG_PATH_EXPLANATIONS) ||
  (segments?.[segments.length - 1] === 'features'
    ? getConfigFeatureDefinitionOrFallback(key)
    : null) ||
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
