# Codex Configurator

Codex Configurator is a terminal user interface (TUI) built with Node.js, React, and Ink.
It shows the current contents of Codex TOML configuration files and can edit them inline.
The TUI uses a fixed full-screen shell so row/list geometry does not shift as modes change.

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

Optional workspace override:

```bash
codex-configurator --codex-dir /path/to/workspace
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
- `Enter`: open selected table; for mixed scalar/object settings, choose a preset first (object presets open nested settings); for boolean settings, toggle directly; for string settings, open inline input; for other preset values, open picker
- `Del`: unset selected value or remove selected custom `<id>` entry from `config.toml`
- `←` / `Backspace`: move up one level (to parent table)
- `:`: enter command mode
- `:filter`: start fuzzy filter mode for the current list
- `:file`: switch between TOML config files in the current workspace
- `:reload`: reload the active config file
- `:help`: toggle quick help overlay
- `:quit` (or `:q`): quit

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

You can override the workspace with either:

- CLI: `--codex-dir /absolute/or/relative/path`
- Env: `CODEX_CONFIGURATOR_CODEX_DIR`

Precedence is CLI first, then environment variable, then the default path.
The resolved workspace is normalized and `/path/.codex/config.toml` is used as the config file.
If the active file is missing or unreadable, the TUI displays the read error and resolved path.

The active config file can also be changed at runtime with `:file`:

- `main config` is always the resolved workspace main file (`~/.codex/config.toml` by default).
- each `agents.<name>.config_file` entry contributes an additional editable file.
  If that file does not exist yet, saving `agents.<name>.config_file` in the main file creates it as an empty TOML file before the main update is written.
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

- Canonical config schema: https://developers.openai.com/codex/config-schema.json
- The local menu reads directly from `src/reference/config-schema.json`, which is downloaded from the canonical schema.
- To refresh the reference snapshot after a new stable Codex release:
  - `npm run sync:reference`
- Snapshot currently synced against Codex stable reference updates published on 2026-02-25.
- Release notes and change history: `CHANGELOG.md`

## Scripts

- `npm run dev`: run the TUI in a temporary workspace (`.codex-configurator.scratch`) without resetting it
- `npm run dev:reset`: reset the temporary workspace (`.codex-configurator.scratch`) and run the TUI
- `npm start`: run the TUI directly (no scratch isolation)
- `npm run lint`: ESLint static analysis for `index.js`, `src`, and `test`
- `npm run build`: validates the npm package archive (`npm pack --dry-run --ignore-scripts --cache .npm-cache`)
- `npm test`: runs the Node.js unit test suite (`node --test`)
- `npm run sync:reference`: downloads the latest `config-schema.json` into `src/reference/config-schema.json`

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
- `src/reference/config-schema.json`: downloaded canonical schema used directly by the UI menu
- `.gitignore`: ignore list for Node/TUI artifacts
- `package.json`: package metadata and scripts
