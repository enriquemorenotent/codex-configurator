import React from 'react';
import { Box, Text } from 'ink';

export const CommandBar = ({
	appMode,
	isCommandMode,
	commandInput,
	commandMessage,
	modeHint,
}) => {
	const isAutocomplete = isCommandMode && typeof commandInput === 'string';
	const cleanInput = isAutocomplete
		? commandInput.replace(/^:/, '').trim().toLowerCase()
		: '';
	const isError = Boolean(commandMessage);

	return React.createElement(
		Box,
		{
			paddingX: 1,
			paddingY: 0,
			marginTop: 0,
			minHeight: 1,
			borderStyle: 'round',
			borderColor:
				appMode === 'edit'
					? 'yellow'
					: isCommandMode
						? 'magenta'
						: 'gray',
			flexDirection: 'column',
		},
		isCommandMode
			? React.createElement(
					Box,
					{ flexDirection: 'row', gap: 1 },
					React.createElement(
						Text,
						{ color: 'yellow', wrap: 'truncate-end', bold: true },
						`${commandInput || ':'}`,
						React.createElement(
							Text,
							{ color: 'whiteBright' },
							'█',
						),
					),
					React.createElement(
						Text,
						{ color: isError ? 'redBright' : 'gray' },
						isError ? commandMessage : modeHint || '',
					),
				)
			: React.createElement(
					Text,
					{ color: 'gray', wrap: 'truncate-end' },
					commandMessage || modeHint || '',
				),
		isCommandMode
			? React.createElement(
					Box,
					{ flexDirection: 'row', gap: 2, paddingX: 1, marginTop: 0 },
					...[
						{ cmd: 'quit', desc: 'exit app' },
						{ cmd: 'file', desc: 'switch file' },
						{ cmd: 'filter', desc: 'search' },
						{ cmd: 'reload', desc: 'refresh' },
					].map(({ cmd, desc }) => {
						const matches = cmd.startsWith(cleanInput);
						return React.createElement(
							Text,
							{
								key: cmd,
								color:
									cleanInput && matches
										? 'cyanBright'
										: 'gray',
								bold: cleanInput && matches,
							},
							`:${cmd} `,
							React.createElement(
								Text,
								{ color: 'gray', dimColor: true },
								`${desc}`,
							),
						);
					}),
				)
			: null,
	);
};
