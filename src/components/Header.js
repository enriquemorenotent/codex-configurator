import React from 'react';
import { Text, Box } from 'ink';
import { computeHeaderRows, formatActiveFileSummary } from '../layout.js';

const WORDMARK = [
  ' ██████╗ ██████╗ ██████╗ ███████╗██╗  ██╗     ██████╗ ██████╗ ███╗   ██╗███████╗██╗ ██████╗ ██╗   ██╗██████╗  █████╗ ████████╗ ██████╗ ██████╗ ',
  '██╔════╝██╔═══██╗██╔══██╗██╔════╝╚██╗██╔╝    ██╔════╝██╔═══██╗████╗  ██║██╔════╝██║██╔════╝ ██║   ██║██╔══██╗██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗',
  '██║     ██║   ██║██║  ██║█████╗   ╚███╔╝     ██║     ██║   ██║██╔██╗ ██║█████╗  ██║██║  ███╗██║   ██║██████╔╝███████║   ██║   ██║   ██║██████╔╝',
  '██║     ██║   ██║██║  ██║██╔══╝   ██╔██╗     ██║     ██║   ██║██║╚██╗██║██╔══╝  ██║██║   ██║██║   ██║██╔══██╗██╔══██║   ██║   ██║   ██║██╔══██╗',
  '╚██████╗╚██████╔╝██████╔╝███████╗██╔╝ ██╗    ╚██████╗╚██████╔╝██║ ╚████║██║     ██║╚██████╔╝╚██████╔╝██║  ██║██║  ██║   ██║   ╚██████╔╝██║  ██║',
  ' ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝     ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝     ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝',
];

export const Header = ({
  codexVersion,
  codexVersionStatus,
  packageVersion,
  activeConfigFile,
  terminalWidth,
}) =>
  React.createElement(
    Box,
    {
      flexDirection: 'column',
      paddingX: 1,
    },
    (() => {
      const headerInfo = computeHeaderRows({
        terminalWidth: terminalWidth || 0,
        activeConfigFile,
        packageVersion,
        codexVersion,
        codexVersionStatus,
      });
      const activeFileSummary = formatActiveFileSummary(activeConfigFile);

      return headerInfo.isCompact
        ? React.createElement(
            React.Fragment,
            null,
            React.createElement(Text, { color: 'magentaBright', bold: true }, 'CODEX CONFIGURATOR'),
            React.createElement(Text, { color: 'gray' }, `v${packageVersion || 'unknown'}`),
            React.createElement(
              Box,
              { flexDirection: 'row' },
              React.createElement(Text, { color: 'gray' }, `Codex ${codexVersion || 'version unavailable'}`),
              codexVersionStatus
                ? React.createElement(
                    Text,
                    { color: codexVersionStatus === 'up to date' ? 'green' : 'gray' },
                    codexVersionStatus === 'up to date' ? ' ✓' : ` (${codexVersionStatus})`
                  )
                : null
            ),
            React.createElement(
              Text,
              { color: 'gray' },
              `Active file: ${activeFileSummary}`
            )
          )
        : React.createElement(
            React.Fragment,
            null,
            React.createElement(
              Box,
              { flexDirection: 'row', marginBottom: 1, gap: 0, alignItems: 'flex-end' },
              React.createElement(
                Box,
                { flexDirection: 'column' },
                ...WORDMARK.map((line, index) =>
                  React.createElement(Text, { color: 'magentaBright', bold: true, key: `word-${index}` }, line)
                )
              ),
              React.createElement(
                Box,
                { marginLeft: 1 },
                React.createElement(Text, { color: 'gray', bold: true }, `v${packageVersion || 'unknown'}`)
              )
            ),
            React.createElement(
              Box,
              { flexDirection: 'row' },
              React.createElement(Text, { color: 'gray' }, `Codex ${codexVersion || 'version unavailable'}`),
              codexVersionStatus
                ? codexVersionStatus === 'up to date'
                  ? React.createElement(
                      React.Fragment,
                      null,
                      React.createElement(Text, { color: 'gray' }, ' ('),
                      React.createElement(Text, { color: 'green' }, '✓'),
                      React.createElement(Text, { color: 'gray' }, ` ${codexVersionStatus})`)
                    )
                  : React.createElement(Text, { color: 'gray' }, ` (${codexVersionStatus})`)
                : null
            ),
            React.createElement(
              Box,
              { marginTop: 1 },
              React.createElement(
                Text,
                { color: 'gray' },
                `Active file: ${activeFileSummary}`
              )
            )
          );
    })()
  );
