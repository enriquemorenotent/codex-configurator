# Codex Configurator

Codex Configurator is a terminal user interface (TUI) built with Node.js, React, and Ink.
It shows the current contents of a Codex TOML configuration file and can reload it on demand.

## Requirements

- Node.js >= 18

## Install

```bash
npm i -g codex-configurator
```

## Usage

```bash
codex-configurator
```

Optional config-path override:

```bash
codex-configurator --config /path/to/config.toml
```

For local development in this repository:

```bash
npm install
npm start
```

## Controls

- `↑` `↓` : move selection
- `PgUp` `PgDn`: move one page up/down
- `Home` `End`: jump to first/last item
- `Enter`: open selected table; for boolean settings, toggle directly; for string settings, open inline input; for other preset values, open picker
- `/`: start fuzzy filter mode for the current list
- `Del`: unset selected value or remove selected custom `<id>` entry from `config.toml`
- `←` / `Backspace`: move up one level (to parent table)
- `r`: reload the active config file
- `q`: quit

The right-hand pane shows what each setting means, plus a picker when a value has preset options.
Deprecated settings are marked with a `[!]` warning marker; only that marker is highlighted.
Model picker entries are curated presets maintained by this project.
In select lists, `[default]` marks the default option.
The header banner shows the configurator package version (for example `v0.2.2`) next to the wordmark.
Section help includes purpose-driven guidance (what a section is for), not generic placeholder copy.
Fuzzy filter mode matches section/value rows by label and key as you type.
The list panel shows a breadcrumb title on its top border with your current path (for example `projects > /home/me/repo`).

## TOML-aware navigation

The table view follows TOML structure, with a root catalog of common keys:

- At the root level, common top-level settings are shown even when unset (displayed with `default`).
- The `features` section remains browsable even when it is not present in the file.
- Unset feature flags use each feature’s documented default behavior when toggling.
- Feature rows tagged with `[not in official list]` come from your file but are not in the curated official set.
- Selected sections such as `history`, `tui`, `feedback`, and `shell_environment_policy` also show common unset keys.
- Attributes and subattributes are shown in strict alphabetical order.
- Unset boolean settings display explicit defaults as `true [default]` or `false [default]`.
- For placeholder keys like `<path>`, IDs entered in the UI are normalized under your home directory, and traversal outside home is rejected.
- New `<path>` entries are written as explicit tables (for example `[projects."/home/me/repo"]`) instead of inline empty objects.

- Dotted/table sections become navigable table nodes.
- Inline key-value pairs are shown as leaf entries.
- Arrays of tables are represented as entries you can expand into indexed rows.
- Placeholder-based sections (for example `apps.<id>.*`) include a `+ add ...` row to create custom IDs directly from the UI.

## Configuration source

By default the app reads from:

```bash
~/.codex/config.toml
```

You can override this path with either:

- CLI: `--config /absolute/or/relative/path.toml`
- Env: `CODEX_CONFIGURATOR_CONFIG_PATH`

Precedence is CLI first, then environment variable, then the default path.
If the file is missing or unreadable, the TUI displays the read error and the resolved path.
Configuration writes are atomic and create the target file (and parent directories) when missing.

## Error logging

Read/write failures are appended to a JSON-lines log file.

- Default path: `~/.codex-configurator-errors.log`
- Override path: `CODEX_CONFIGURATOR_ERROR_LOG_PATH`
- Max log size before single-file rotation: `CODEX_CONFIGURATOR_ERROR_LOG_MAX_BYTES` (default `1048576`)

When the log exceeds the size limit, it is rotated to `<log-path>.1` before writing the new event.

## Version checks

Codex version checks are always enabled.
By default, the app runs global `codex` and `npm` from `PATH`.
You can override either command with:

- `CODEX_CONFIGURATOR_CODEX_BIN=<command-or-path>`
- `CODEX_CONFIGURATOR_NPM_BIN=<command-or-path>`

## Self-update behavior

On startup, the app checks the npm registry for the latest `codex-configurator` version.
If the running version is older, it automatically runs:

- `npm install -g codex-configurator@latest`

This uses the `npm` command from `PATH` (or `CODEX_CONFIGURATOR_NPM_BIN` if set).

## Upstream reference

- Codex configuration reference: https://developers.openai.com/codex/config-reference/
- Snapshot currently synced against Codex `rust-v0.105.0` reference updates (published 2026-02-25).
- Reference sync is intentionally manual and review-driven; this repo does not run automated remote-content sync scripts.
- Release notes and change history: `CHANGELOG.md`

## Scripts

- `npm start`: run the TUI
- `npm run dev`: same as `npm start`
- `npm run dev:scratch`: run the TUI against a temporary copy (`.codex-configurator.scratch.toml`) in the project folder
- `npm run lint`: ESLint static analysis for `index.js`, `src`, and `test`
- `npm run build`: validates the npm package archive (`npm pack --dry-run --ignore-scripts --cache .npm-cache`)
- `npm test`: runs the Node.js unit test suite (`node --test`)

## Continuous integration

GitHub Actions runs production dependency audit (`npm audit --omit=dev --audit-level=high`), `npm run lint`, `npm test`, `npm run build`, and `npm pack --dry-run` on every push and pull request across:

- `ubuntu-latest`, `macos-latest`, and `windows-latest`
- Node.js `18` and `20`

## Project structure

- `index.js`: application entrypoint, state wiring, and input handling
- `src/configParser.js`: TOML file parsing, traversal, and row formatting
- `src/components`: Ink components split by responsibility
- `src/components/Header.js`: title and tags
- `src/components/ConfigNavigator.js`: left list and right detail rendering
- `src/constants.js`: UI copy and labels
- `src/configHelp.js`: user-facing copy for key explanations
- `src/layout.js`: pane width and path-key helpers
- `src/interaction.js`: input helpers
- `src/reference/config-reference.json`: source-of-truth schema extracted from upstream config reference and used to drive which UI settings are shown
- `.gitignore`: ignore list for Node/TUI artifacts
- `package.json`: package metadata and scripts
