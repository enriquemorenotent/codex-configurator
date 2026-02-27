import React from 'react';
import { Box, Text } from 'ink';

export const CommandBar = ({
  appMode,
  isCommandMode,
  commandInput,
  commandMessage,
  modeHint,
}) =>
  React.createElement(
    Box,
    { borderStyle: 'single', borderColor: appMode === 'edit' ? 'yellow' : 'cyan', paddingX: 1 },
    isCommandMode
      ? React.createElement(
          Text,
          { color: 'yellow', wrap: 'truncate-end' },
          commandInput || ':',
          React.createElement(Text, { color: 'gray' }, '█'),
          React.createElement(Text, { color: commandMessage ? 'red' : 'gray' }, ` ${commandMessage || modeHint || ''}`)
        )
      : React.createElement(
          Text,
          { color: 'gray', wrap: 'truncate-end' },
          commandMessage || modeHint || ''
        )
  );
