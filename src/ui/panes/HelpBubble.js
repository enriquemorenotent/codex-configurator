import React from 'react';
import { Box, Text } from 'ink';

const HINTS = {
  browse: '↑/↓/PgUp/PgDn navigate • Enter open/edit • Del unset • ←/Backspace parent • :filter • :file • :reload • :help • :quit',
  edit: '↑/↓/PgUp/PgDn pick • Enter confirm • Esc cancel • Del remove char (text)',
  filter: 'Type to filter • Enter/Esc done • Del clear last • Ctrl+U clear',
  'file-switch': '↑/↓ or PgUp/PgDn choose file • Enter switch • Esc cancel',
  command: 'Type :command then Enter • :help to exit help mode • Esc to cancel mode',
};

export const HelpBubble = ({ appMode }) =>
  React.createElement(
    Box,
    { borderStyle: 'round', borderColor: 'blue', paddingX: 1, marginTop: 1 },
    React.createElement(Text, { color: 'blue' }, HINTS[appMode] || HINTS.browse)
  );
