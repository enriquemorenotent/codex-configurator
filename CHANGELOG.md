# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.5] - 2026-02-28

### Changed
- Bumped package version for the new release.

## [0.2.4] - 2026-02-25

### Added
- Added this `CHANGELOG.md` file to track release history in one place.
- Added detailed coverage for newly documented `config.toml` keys in the local reference snapshot:
  - `agents.max_depth`
  - `allow_login_shell`
  - `approval_policy.reject.sandbox_approval`
  - `approval_policy.reject.rules`
  - `approval_policy.reject.mcp_elicitations`
  - `apps._default.enabled`
  - `apps._default.destructive_enabled`
  - `apps._default.open_world_enabled`
  - `apps.<id>.destructive_enabled`
  - `apps.<id>.open_world_enabled`
  - `apps.<id>.default_tools_enabled`
  - `apps.<id>.default_tools_approval_mode`
  - `apps.<id>.tools.<tool>.enabled`
  - `apps.<id>.tools.<tool>.approval_mode`
  - `background_terminal_max_timeout`
  - `mcp_oauth_callback_url`
  - `model_catalog_json`
  - `profiles.<name>.model_catalog_json`
  - `windows.sandbox`

### Changed
- Synced `src/reference/config-reference.json` to Codex `rust-v0.105.0` reference updates (published on February 25, 2026).
- Snapshot totals now reflect the upstream tables:
  - `config.toml`: `167` options
  - `requirements.toml`: `14` options
- `approval_policy` type metadata now includes object reject form:
  - from: `untrusted | on-request | never`
  - to: `untrusted | on-request | never | { reject = { sandbox_approval = bool, rules = bool, mcp_elicitations = bool } }`
- `projects.<path>.trust_level` reference type metadata now matches upstream generalized typing (`string`).
- Updated feature/deprecation handling to remove stale local overrides and rely on upstream reference metadata.
- Updated README reference documentation to include the snapshot sync workflow and current upstream baseline.

### Fixed
- Removed the unsafe automated reference sync script and `npm run sync:reference` command to prevent execution of downloaded remote content.
- Removed stale forced deprecation handling for `tools.web_search` when upstream does not mark it deprecated.
- Removed stale local options that are no longer in upstream `config.toml` reference:
  - `apps.<id>.disabled_reason`
  - `features.elevated_windows_sandbox`
  - `features.experimental_windows_sandbox`
- Corrected deprecation-state mismatches to follow upstream reference metadata for:
  - `approval_policy`
  - `features.web_search`
  - `features.web_search_cached`
  - `features.web_search_request`
  - `tools.web_search`
