const prettifyFeatureName = (key) =>
  key
    .split('_')
    .map((segment) => `${segment[0]?.toUpperCase() || ''}${segment.slice(1)}`)
    .join(' ');

const makeFeatureDefinition = (
  key,
  short,
  usage = 'Uses the feature flag value in your config.',
  options = {}
) => {
  const deprecation = options?.deprecation;
  const defaultValue = typeof options?.defaultValue === 'boolean' ? options.defaultValue : false;
  const isDocumented = options?.isDocumented === true;

  return {
    key,
    short,
    usage: deprecation ? `[!] ${deprecation}` : usage,
    deprecation,
    defaultValue,
    isDocumented,
  };
};

export const CONFIG_FEATURE_DEFINITIONS = [
  makeFeatureDefinition(
    'apply_patch_freeform',
    'Enable freeform apply_patch style for code edits.',
    'When enabled, patch edits can use larger freeform blocks.',
    { isDocumented: true }
  ),
  makeFeatureDefinition(
    'apps',
    'Enable built-in app/connector features.',
    'Toggle access to app integrations used by Codex.',
    { isDocumented: true }
  ),
  makeFeatureDefinition(
    'apps_mcp_gateway',
    'Use the MCP app gateway.',
    'Route app calls through the MCP gateway when available.',
    { isDocumented: true }
  ),
  makeFeatureDefinition(
    'child_agents_md',
    'Allow child-agent markdown workflows.',
    'Enable loading child-agent instructions from markdown files.',
    { isDocumented: true }
  ),
  makeFeatureDefinition('codex_git_commit', 'Enable Codex-assisted git commit workflows.', 'Allows additional git-oriented agent workflows.'),
  makeFeatureDefinition(
    'collab',
    'Enable collaboration mode helpers.',
    'Turn on multi-party collaboration flow features.',
    { deprecation: 'collab is deprecated; use [features].multi_agent instead.' }
  ),
  makeFeatureDefinition(
    'collaboration_modes',
    'Enable multiple collaboration modes.',
    'Allow the assistant to switch between interaction modes.',
    { defaultValue: true, isDocumented: true }
  ),
  makeFeatureDefinition('connectors', 'Enable external connector support.', 'Controls optional third-party connector behavior.'),
  makeFeatureDefinition(
    'elevated_windows_sandbox',
    'Enable elevated Windows sandbox.',
    'Allows higher-permission sandbox behavior on Windows.',
    { isDocumented: true }
  ),
  makeFeatureDefinition('enable_experimental_windows_sandbox', 'Enable experimental Windows sandbox.', 'Turns on experimental Windows sandbox behavior.'),
  makeFeatureDefinition('enable_request_compression', 'Enable request compression.', 'Compress request payloads for matching model endpoints.'),
  makeFeatureDefinition('experimental_use_freeform_apply_patch', 'Enable experimental freeform apply_patch usage.', 'Allows experimental patching behavior in edit flows.'),
  makeFeatureDefinition('experimental_use_unified_exec_tool', 'Enable experimental unified exec tool.', 'Use unified execution routing when invoking shell tools.'),
  makeFeatureDefinition(
    'experimental_windows_sandbox',
    'Enable experimental Windows sandbox.',
    'Turns on a newer Windows sandbox implementation.',
    { isDocumented: true }
  ),
  makeFeatureDefinition('include_apply_patch_tool', 'Expose the apply_patch tool.', 'Makes apply patch tool calls available to the model.'),
  makeFeatureDefinition('js_repl', 'Enable JavaScript REPL.', 'Allow JavaScript-based REPL style tooling.'),
  makeFeatureDefinition('js_repl_tools_only', 'Restrict js_repl to tool-only mode.', 'Limits js_repl usage to explicit tool calls.'),
  makeFeatureDefinition('memory_tool', 'Enable memory tool support.', 'Allows Codex to use memory-related workflow tools.'),
  makeFeatureDefinition(
    'multi_agent',
    'Enable multi-agent support.',
    'Allows multiple coordinated agent contexts.',
    { isDocumented: true }
  ),
  makeFeatureDefinition(
    'personality',
    'Enable personality controls.',
    'Turns on personality-related routing flags.',
    { defaultValue: true, isDocumented: true }
  ),
  makeFeatureDefinition(
    'powershell_utf8',
    'Use UTF-8 in PowerShell sessions.',
    'Keep PowerShell command output in UTF-8 encoding.',
    { defaultValue: true, isDocumented: true }
  ),
  makeFeatureDefinition('prevent_idle_sleep', 'Prevent idle sleep while running.', 'Keeps the system awake during active sessions.'),
  makeFeatureDefinition(
    'remote_models',
    'Enable remote model discovery.',
    'Allows loading model lists from remote model providers.',
    { isDocumented: true }
  ),
  makeFeatureDefinition(
    'request_rule',
    'Enable request rule controls.',
    'Turn on request routing/validation policy behavior.',
    { defaultValue: true, isDocumented: true }
  ),
  makeFeatureDefinition('responses_websockets', 'Enable Responses WebSocket transport.', 'Use websocket transport for Responses API calls.'),
  makeFeatureDefinition('responses_websockets_v2', 'Enable Responses WebSocket v2 transport.', 'Use the next-generation websocket transport stack.'),
  makeFeatureDefinition(
    'runtime_metrics',
    'Enable runtime metrics collection.',
    'Record runtime metrics for analysis and telemetry.',
    { isDocumented: true }
  ),
  makeFeatureDefinition(
    'search_tool',
    'Enable internal search tool.',
    'Turns on the built-in search execution tool.',
    { isDocumented: true }
  ),
  makeFeatureDefinition(
    'shell_snapshot',
    'Enable shell snapshots.',
    'Capture shell environment state before runs.',
    { isDocumented: true }
  ),
  makeFeatureDefinition(
    'shell_tool',
    'Enable shell tool access.',
    'Allows Codex to run shell commands through the tool interface.',
    { defaultValue: true, isDocumented: true }
  ),
  makeFeatureDefinition('shell_zsh_fork', 'Enable zsh forked shell tool.', 'Runs shell commands through a forked zsh process.'),
  makeFeatureDefinition('skill_env_var_dependency_prompt', 'Enable environment variable prompts for skills.', 'Prompts when skills require missing environment variables.'),
  makeFeatureDefinition('skill_mcp_dependency_install', 'Enable auto install MCP skill dependencies.', 'Installs missing MCP dependencies for skill execution.'),
  makeFeatureDefinition('sqlite', 'Enable SQLite support features.', 'Turns SQLite-specific feature behavior on or off.'),
  makeFeatureDefinition('steer', 'Enable steering control mode.', 'Allows steering the tool call strategy for some actions.'),
  makeFeatureDefinition('undo', 'Enable undo behavior.', 'Expose undo controls for reversible operations.'),
  makeFeatureDefinition(
    'unified_exec',
    'Use unified execution layer.',
    'Route execution commands through the unified tool layer.',
    { isDocumented: true }
  ),
  makeFeatureDefinition(
    'use_linux_sandbox_bwrap',
    'Enable Linux bubblewrap sandbox.',
    'Use bwrap for Linux sandbox isolation.',
    { isDocumented: true }
  ),
  makeFeatureDefinition(
    'web_search',
    'Enable web search tool.',
    'Allows the model to call a web search tool.',
    {
      deprecation: '[features].web_search is deprecated; use the top-level web_search setting instead.',
      isDocumented: true,
    }
  ),
  makeFeatureDefinition(
    'web_search_cached',
    'Enable cached web search only.',
    'Restricts web search calls to cached results.',
    {
      deprecation:
        '[features].web_search_cached is deprecated legacy toggle. `true` maps to `web_search = "cached"`.',
      isDocumented: true,
    }
  ),
  makeFeatureDefinition(
    'web_search_request',
    'Enable web search request flow.',
    'Turns on request-mode web search behavior.',
    {
      deprecation:
        '[features].web_search_request is deprecated legacy toggle. `true` maps to `web_search = "live"`.',
      isDocumented: true,
    }
  ),
];

const FEATURE_DEFINITION_MAP = CONFIG_FEATURE_DEFINITIONS.reduce((acc, definition) => {
  acc[definition.key] = definition;

  return acc;
}, {});

export const getConfigFeatureKeys = () =>
  CONFIG_FEATURE_DEFINITIONS
    .filter((definition) => definition.isDocumented === true)
    .map((definition) => definition.key);

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
