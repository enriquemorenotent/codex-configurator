import React from 'react';
import { Box } from 'ink';

export const LayoutShell = ({ children }) =>
	React.createElement(
		Box,
		{
			flexDirection: 'column',
			position: 'relative',
			paddingX: 0,
			paddingY: 0,
			gap: 0,
			width: '100%',
			height: '100%',
		},
		...children,
	);
