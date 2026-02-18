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
- `Enter`: enter selected table (for section/object/array-of-tables)
- `←` / `Backspace`: move up one level (to parent table)
- `r`: reload `~/.codex/config.toml`
- `q`: quit

The right-hand pane shows type and rendered contents for the selected TOML node.

## TOML-aware navigation

The table view is generated from TOML structure:

- Dotted/table sections become navigable table nodes.
- Inline key-value pairs are shown as leaf entries.
- Arrays of tables are represented as entries you can expand into indexed rows.

## Configuration source

The app reads from:

```bash
~/.codex/config.toml
```

If the file is missing or unreadable, the TUI displays the read error and the expected path.

## Scripts

- `npm start`: run the TUI
- `npm run dev`: same as `npm start`
- `npm run lint`: syntax check for `index.js`
- `npm test`: runs lint

## Project structure

- `index.js`: application entrypoint and Ink UI
- `.gitignore`: ignore list for Node/TUI artifacts
- `package.json`: package metadata and scripts
