import React from 'react';
import { Text, Box } from 'ink';
import { getConfigHelp } from '../configHelp.js';
import { computePaneWidths, clamp } from '../layout.js';
import { getNodeAtPath, buildRows, formatDetails } from '../configParser.js';

const MenuItem = ({ isSelected, children }) =>
  React.createElement(Text, { bold: isSelected, color: isSelected ? 'yellow' : 'white' }, children);

const formatConfigHelp = (row) => {
  const info = getConfigHelp(row.key);
  const defaultCollectionText =
    row.kind === 'table' || row.kind === 'tableArray'
      ? 'This section groups related settings.'
      : row.kind === 'array'
        ? `This is a list with ${row.value.length} entries.`
        : 'This setting affects Codex behavior.';
  const short = info?.short || defaultCollectionText;
  const usage = info?.usage;

  return usage ? [short, usage] : [short];
};

export const ConfigNavigator = ({ snapshot, pathSegments, selectedIndex, scrollOffset, terminalWidth, terminalHeight }) => {
  if (!snapshot.ok) {
    return React.createElement(
      Box,
      { flexDirection: 'column', marginTop: 1 },
      React.createElement(Text, { color: 'red', bold: true }, 'Unable to read/parse config'),
      React.createElement(Text, { color: 'gray' }, snapshot.error),
      React.createElement(Text, { color: 'gray' }, `Path: ${snapshot.path}`)
    );
  }

  const currentNode = getNodeAtPath(snapshot.data, pathSegments);
  const rows = buildRows(currentNode);
  const selected = rows.length === 0 ? 0 : Math.min(selectedIndex, rows.length - 1);
  const { leftWidth, rightWidth } = computePaneWidths(terminalWidth, rows);
  const viewportHeight = Math.max(4, Math.min(rows.length, Math.max(4, (terminalHeight || 24) - 14)));
  const viewportStart = clamp(scrollOffset, 0, Math.max(0, rows.length - viewportHeight));
  const visibleRows = rows.slice(viewportStart, viewportStart + viewportHeight);
  const canScrollUp = viewportStart > 0;
  const canScrollDown = viewportStart + viewportHeight < rows.length;

  return React.createElement(
    Box,
    { flexDirection: 'row', gap: 2 },
    React.createElement(
      Box,
      { flexDirection: 'column', width: leftWidth },
      React.createElement(
        Box,
        {
          flexDirection: 'column',
          borderStyle: 'single',
          borderColor: 'gray',
          padding: 1,
        },
      rows.length === 0
        ? React.createElement(Text, { color: 'gray' }, '[no entries in this table]')
        : visibleRows.map((row, viewIndex) => {
            const index = viewportStart + viewIndex;
            const showTopCue = canScrollUp && viewIndex === 0;
            const showBottomCue = canScrollDown && viewIndex === visibleRows.length - 1;
            const isSelected = index === selected;
            const label = `${showTopCue ? '↑ ' : showBottomCue ? '↓ ' : '  '}${isSelected ? '▶' : ' '} ${row.label}`;
              return React.createElement(MenuItem, { isSelected, key: `left-${index}` }, label);
            })
      )
    ),
    React.createElement(
      Box,
      { flexDirection: 'column', width: rightWidth, marginTop: 2 },
      rows.length === 0
        ? React.createElement(Text, { color: 'gray' }, 'No selection available.')
        : React.createElement(
            React.Fragment,
            null,
            ...formatConfigHelp(rows[selected]).map((line, lineIndex) =>
              React.createElement(
                Text,
                { key: `help-${selected}-${lineIndex}`, color: 'white' },
                line
              )
            ),
            rows[selected].kind === 'value'
              ? React.createElement(
                  Text,
                  { key: `value-${selected}`, color: 'white' },
                  `${formatDetails(rows[selected].value)}`
                )
              : null
          )
    )
  );
};
