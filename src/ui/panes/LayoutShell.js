import React from 'react';
import { Box } from 'ink';

export const LayoutShell = ({ children }) =>
  React.createElement(
    Box,
    {
      flexDirection: 'column',
      position: 'relative',
      padding: 1,
      gap: 1,
    },
    ...children
  );
