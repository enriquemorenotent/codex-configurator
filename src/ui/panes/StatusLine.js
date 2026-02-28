import React from 'react';
import { Box, Text } from 'ink';
import { formatActiveFileSummary } from '../../layout.js';

export const StatusLine = ({
	codexVersion,
	codexVersionStatus,
	activeConfigFile,
	appMode,
}) => {
	const statusText = codexVersionStatus || 'checking...';
	const isUpToDate = statusText === 'up to date';
	const isUpdateAvailable =
		typeof statusText === 'string' &&
		statusText.startsWith('update available');
	const statusPrefix = isUpToDate ? '✓' : isUpdateAvailable ? '⚠️' : '';
	const activeFileSummary = formatActiveFileSummary(activeConfigFile);

	return React.createElement(
		Box,
		{
			paddingX: 1,
			paddingY: 0,
			marginTop: 1,
			flexDirection: 'row',
			justifyContent: 'space-between',
			backgroundColor: 'blue',
			width: '100%',
		},
		React.createElement(
			Box,
			{ flexDirection: 'row', gap: 2 },
			React.createElement(
				Text,
				{ color: 'white', backgroundColor: 'magenta', bold: true },
				` ${appMode.toUpperCase()} `,
			),
			React.createElement(
				Text,
				{ color: 'white', bold: true },
				`📝 ${activeFileSummary}`,
			),
		),

		React.createElement(
			Box,
			{ flexDirection: 'row', gap: 2 },
			React.createElement(
				Text,
				{ color: 'white' },
				`Codex installed: ${codexVersion || '—'}`,
			),
			React.createElement(
				Box,
				{ flexDirection: 'row' },
				statusPrefix
					? React.createElement(
							Text,
							{
								color: isUpToDate ? 'white' : 'black',
								backgroundColor: isUpToDate
									? undefined
									: 'yellow',
							},
							` ${statusPrefix} `,
						)
					: null,
				React.createElement(
					Text,
					{
						color: isUpToDate ? 'white' : 'black',
						backgroundColor: isUpToDate ? undefined : 'yellow',
						bold: true,
					},
					`${statusText} `,
				),
			),
		),
	);
};
