# Codex Configurator

Codex Configurator is a terminal user interface (TUI) built with Node.js, React, and Ink.
It is currently a dummy scaffold for interactive terminal workflows.

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
- `Enter`: select (currently, `Exit` exits)
- `q`: quit

## Scripts

- `npm start`: run the TUI
- `npm run dev`: same as `npm start`
- `npm run lint`: syntax check for `index.js`
- `npm test`: runs lint

## Project structure

- `index.js`: application entrypoint and Ink UI
- `.gitignore`: ignore list for Node/TUI artifacts
- `package.json`: package metadata and scripts

