import React from 'react';
import { Text, Box } from 'ink';

export const Header = ({ packageVersion }) =>
	React.createElement(
		Box,
		{
			flexDirection: 'row',
			paddingX: 1,
			paddingY: 0,
			justifyContent: 'space-between',
			backgroundColor: 'magenta',
			marginBottom: 0,
		},
		React.createElement(
			Box,
			{ gap: 1 },
			React.createElement(
				Text,
				{ color: 'white', bold: true },
				' CODEX CONFIGURATOR',
			),
			React.createElement(
				Text,
				{ color: 'white', dimColor: false },
				`v${packageVersion || 'unknown'}`,
			),
		),
		React.createElement(
			Text,
			{ color: 'white', dimColor: false },
			'TUI Mode ',
		),
	);
