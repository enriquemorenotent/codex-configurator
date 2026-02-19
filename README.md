# Codex Configurator

Codex Configurator is a terminal user interface (TUI) built with Node.js, React, and Ink.
It shows the current contents of `~/.codex/config.toml` and can reload them on demand.

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
- `Del`: unset selected value or remove selected custom `<id>` entry from `config.toml`
- `←` / `Backspace`: move up one level (to parent table)
- `r`: reload `~/.codex/config.toml`
- `q`: quit

The right-hand pane shows what each setting means, plus a picker when a value has preset options.
Deprecated settings are marked with a `[!]` warning marker; only that marker is highlighted.
Model picker entries are curated presets maintained by this project.
In select lists, `[default]` marks the default option.

## TOML-aware navigation

The table view follows TOML structure, with a root catalog of common keys:

- At the root level, common top-level settings are shown even when unset (displayed with `default`).
- The `features` section remains browsable even when it is not present in the file.
- Unset feature flags use each feature’s documented default behavior when toggling.
- Feature rows tagged with `[not in official list]` come from your file but are not in the curated official set.
- Selected sections such as `history`, `tui`, `feedback`, and `shell_environment_policy` also show common unset keys.
- Attributes and subattributes are shown in strict alphabetical order.
- Unset boolean settings display explicit defaults as `true [default]` or `false [default]`.
- For placeholder keys like `<path>`, IDs entered in the UI are normalized under your home directory.

- Dotted/table sections become navigable table nodes.
- Inline key-value pairs are shown as leaf entries.
- Arrays of tables are represented as entries you can expand into indexed rows.
- Placeholder-based sections (for example `apps.<id>.*`) include a `+ add ...` row to create custom IDs directly from the UI.

## Configuration source

The app reads from:

```bash
~/.codex/config.toml
```

If the file is missing or unreadable, the TUI displays the read error and the expected path.

## Upstream reference

- Codex configuration reference: https://developers.openai.com/codex/config-reference/

## Scripts

- `npm start`: run the TUI
- `npm run dev`: same as `npm start`
- `npm run lint`: syntax check for all source files
- `npm run build`: runs lint
- `npm test`: runs the Node.js unit test suite (`node --test`)

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
