#!/usr/bin/env node

import React, { useState } from 'react';
import { render, useInput, useApp, Text, Box } from 'ink';

const MENU_ITEMS = ['Overview', 'Settings', 'Profiles', 'Diagnostics', 'Exit'];
const CONTROL_HINT = 'Use arrow keys to move, Enter to select, q to quit';
const BRAND = 'Codex Configurator';
const TAGS = ['Node.js', 'React', 'Ink'];

const MenuItem = ({ isSelected, children }) =>
  React.createElement(Text, { bold: isSelected, color: isSelected ? 'yellow' : 'white' }, children);

const Header = () =>
  React.createElement(
    Box,
    {
      flexDirection: 'column',
      borderStyle: 'round',
      borderColor: 'cyan',
      paddingX: 1,
      marginBottom: 1,
    },
    React.createElement(
      Box,
      { flexDirection: 'row', alignItems: 'center', marginBottom: 1 },
      React.createElement(Text, { color: 'cyan', bold: true }, '✦'),
      React.createElement(Text, { color: 'cyan', bold: true }, ` ${BRAND}`),
      React.createElement(Text, { color: 'gray' }, ' •')
    ),
    React.createElement(
      Text,
      { color: 'gray' },
      'Configuration workspace for structured interactive tooling sessions'
    ),
    React.createElement(
      Box,
      { flexDirection: 'row', gap: 1, marginTop: 1 },
      ...TAGS.map((tag) =>
        React.createElement(
          Text,
          { key: `tag-${tag}`, color: 'black', backgroundColor: 'blue' },
          ` ${tag} `
        )
      )
    )
  );

const App = () => {
  const isInteractive = process.stdin.isTTY && process.stdout.isTTY;

  if (!isInteractive) {
    return React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      React.createElement(Header),
      React.createElement(
        Box,
        { marginTop: 1, flexDirection: 'column' },
        MENU_ITEMS.map((item) =>
          React.createElement(Text, { key: `menu-${item}`, color: 'white' }, `  ${item}`)
        )
      ),
      React.createElement(Text, { color: 'yellow' }, 'Non-interactive mode: input disabled')
    );
  }

  const { exit } = useApp();
  const [selected, setSelected] = useState(0);

  useInput((input, key) => {
    if (input === 'q') {
      exit();
      return;
    }

    if (key.upArrow) {
      setSelected((previous) => (previous - 1 + MENU_ITEMS.length) % MENU_ITEMS.length);
      return;
    }

    if (key.downArrow) {
      setSelected((previous) => (previous + 1) % MENU_ITEMS.length);
      return;
    }

    if (key.return && MENU_ITEMS[selected] === 'Exit') {
      exit();
    }
  });

  return React.createElement(
    Box,
    { flexDirection: 'column', padding: 1 },
    React.createElement(Header),
    React.createElement(
      Box,
      { marginTop: 1, flexDirection: 'column' },
      MENU_ITEMS.map((item, index) => {
        const isSelected = index === selected;
        return React.createElement(
          MenuItem,
          { isSelected, key: `menu-${item}-${index}` },
          `${isSelected ? '▶' : ' '} ${item}`
        );
      })
    ),
    React.createElement(Text, { color: 'gray' }, CONTROL_HINT)
  );
};

render(React.createElement(App));
