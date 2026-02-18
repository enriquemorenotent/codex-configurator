import React from 'react';
import { Text, Box } from 'ink';
import { BRAND, CONFIG_TAGS } from '../constants.js';

export const Header = () =>
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
      React.createElement(Text, { color: 'cyan', bold: true }, ` ${BRAND}`)
    ),
    React.createElement(Text, { color: 'gray' }, 'Browse your Codex settings and see what each one does'),
    React.createElement(
      Box,
      { flexDirection: 'row', gap: 1, marginTop: 1 },
      ...CONFIG_TAGS.map((tag) =>
        React.createElement(
          Text,
          { key: `tag-${tag}`, color: 'black', backgroundColor: 'blue' },
          ` ${tag} `
        )
      )
    )
  );
