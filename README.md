# Codex Configurator

Codex Configurator is a terminal user interface (TUI) built with Node.js, React, and Ink.
It shows the current contents of `~/.codex/config.toml` and can reload them on demand.

## Requirements

- Node.js >= 18

## Install

```bash
npm install
```

## Usage

```bash
npm start
```

To run directly from an installed package:

```bash
codex-configurator
```

## Controls

- `↑` `↓` : move selection
- `Enter`: open selected table or open picker for preset values
- `Del`: unset selected value (remove the key from `config.toml`)
- `←` / `Backspace`: move up one level (to parent table)
- `r`: reload `~/.codex/config.toml`
- `q`: quit

The right-hand pane shows what each setting means, plus a picker when a value has preset options.
Deprecated settings are marked with a `[!]` warning marker; only that marker is highlighted.

## TOML-aware navigation

The table view follows TOML structure, with a root catalog of common keys:

- At the root level, common top-level settings are shown even when unset (displayed with `default`).
- The `features` section remains browsable even when it is not present in the file.
- Unset feature flags use each feature’s documented default behavior when toggling.
- Feature rows tagged with `[not in official list]` come from your file but are not in the curated official set.

- Dotted/table sections become navigable table nodes.
- Inline key-value pairs are shown as leaf entries.
- Arrays of tables are represented as entries you can expand into indexed rows.

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
- `npm run build`: syntax check for distributable entrypoint and modules
- `npm test`: runs lint

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
- `.gitignore`: ignore list for Node/TUI artifacts
- `package.json`: package metadata and scripts
