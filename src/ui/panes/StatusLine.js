import React from 'react';
import { Box, Text } from 'ink';

export const StatusLine = ({
  codexVersion,
  codexVersionStatus,
  packageVersion,
  activeConfigFile,
  rowsLength,
  filteredLength,
  appMode,
}) => {
  const statusText = codexVersionStatus || 'checking...';
  const topLine = `v${packageVersion || 'unknown'}  Codex ${codexVersion || 'version unavailable'} (${statusText})  mode:${appMode}`;
  const bottomLine = `active file: ${activeConfigFile?.label || 'unknown'}  rows ${rowsLength}/${filteredLength}`;

  return (
  React.createElement(
    Box,
    { borderStyle: 'single', borderColor: 'gray', paddingX: 1, flexDirection: 'column' },
    React.createElement(Text, { color: 'gray', wrap: 'truncate-end' }, topLine),
    React.createElement(
      Text,
      {
        color: 'gray',
        wrap: 'truncate-end',
      },
      bottomLine
    )
  )
  );
};
