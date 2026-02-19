import React from 'react';
import { Text, Box } from 'ink';

const WORDMARK = [
  ' ██████╗ ██████╗ ██████╗ ███████╗██╗  ██╗     ██████╗ ██████╗ ███╗   ██╗███████╗██╗ ██████╗ ██╗   ██╗██████╗  █████╗ ████████╗ ██████╗ ██████╗ ',
  '██╔════╝██╔═══██╗██╔══██╗██╔════╝╚██╗██╔╝    ██╔════╝██╔═══██╗████╗  ██║██╔════╝██║██╔════╝ ██║   ██║██╔══██╗██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗',
  '██║     ██║   ██║██║  ██║█████╗   ╚███╔╝     ██║     ██║   ██║██╔██╗ ██║█████╗  ██║██║  ███╗██║   ██║██████╔╝███████║   ██║   ██║   ██║██████╔╝',
  '██║     ██║   ██║██║  ██║██╔══╝   ██╔██╗     ██║     ██║   ██║██║╚██╗██║██╔══╝  ██║██║   ██║██║   ██║██╔══██╗██╔══██║   ██║   ██║   ██║██╔══██╗',
  '╚██████╗╚██████╔╝██████╔╝███████╗██╔╝ ██╗    ╚██████╗╚██████╔╝██║ ╚████║██║     ██║╚██████╔╝╚██████╔╝██║  ██║██║  ██║   ██║   ╚██████╔╝██║  ██║',
  ' ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝     ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝     ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝',
];

export const Header = ({ codexVersion, codexVersionStatus }) =>
  React.createElement(
    Box,
    {
      flexDirection: 'column',
      paddingX: 1,
      marginBottom: 1,
    },
      React.createElement(
        Box,
        { flexDirection: 'column', marginBottom: 1, gap: 0 },
        ...WORDMARK.map((line, index) =>
          React.createElement(Text, { color: 'magentaBright', bold: true, key: `word-${index}` }, line)
        )
      ),
    React.createElement(
      Text,
      { color: 'gray' },
      codexVersionStatus ? `Codex ${codexVersion} (${codexVersionStatus})` : `Codex ${codexVersion}`
    )
  );
