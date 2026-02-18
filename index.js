#!/usr/bin/env node

import fs from 'fs';
import os from 'os';
import path from 'path';
import * as toml from 'toml';
import React, { useState } from 'react';
import { render, useInput, useApp, useStdout, Text, Box } from 'ink';

const CONTROL_HINT = '↑/↓ move • Enter: open table/item • ←/Backspace: go up • r: reload • q: quit';
const BRAND = 'Codex Configurator';
const CONFIG_PATH = path.join(os.homedir(), '.codex', 'config.toml');
const CONFIG_TAGS = ['Node.js', 'React', 'Ink', 'TOML'];
const MAX_DETAIL_CHARS = 2200;

const MenuItem = ({ isSelected, children }) =>
  React.createElement(Text, { bold: isSelected, color: isSelected ? 'yellow' : 'white' }, children);

const isPlainObject = (value) =>
  Object.prototype.toString.call(value) === '[object Object]';

const isBackspaceKey = (input, key) =>
  key.backspace === true || key.delete === true || key.name === 'backspace' || input === '\b' || input === '\u007f';

const getNodeKind = (value) => {
  if (isPlainObject(value)) {
    return 'table';
  }

  if (Array.isArray(value)) {
    if (value.length > 0 && value.every(isPlainObject)) {
      return 'tableArray';
    }

    return 'array';
  }

  return 'value';
};

const previewValue = (value) => {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.length} item(s)]`;
  }

  if (isPlainObject(value)) {
    return '{}';
  }

  return String(value);
};

const toPathString = (segments) =>
  segments.length === 0 ? 'root' : ['root', ...segments.map(String)].join(' / ');

const pathToKey = (segments) => JSON.stringify(segments);

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const computePaneWidths = (terminalWidth, rows) => {
  const available = Math.max(40, terminalWidth - 2);
  const contentRows = rows.length === 0 ? [] : rows;
  const longestRow = contentRows.reduce(
    (max, row) => Math.max(max, String(row.label).length + 6),
    26
  );
  const minLeftWidth = 30;
  const minRightWidth = 24;

  const leftNeed = Math.max(minLeftWidth, longestRow);
  const leftWidth = clamp(leftNeed, minLeftWidth, available - minRightWidth - 2);
  const rightWidth = available - leftWidth - 2;

  return { leftWidth, rightWidth };
};

const readConfig = () => {
  try {
    const fileContents = fs.readFileSync(CONFIG_PATH, 'utf8');
    const data = toml.parse(fileContents);
    return {
      ok: true,
      path: CONFIG_PATH,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      path: CONFIG_PATH,
      error: error?.message || 'Unable to read or parse configuration file.',
    };
  }
};

const getNodeAtPath = (root, segments) => {
  let current = root;

  for (const segment of segments) {
    if (current == null) {
      return undefined;
    }

    if (Array.isArray(current) && Number.isInteger(segment)) {
      current = current[segment];
      continue;
    }

    if (!isPlainObject(current) && !Array.isArray(current)) {
      return undefined;
    }

    if (typeof current === 'object' && segment in current) {
      current = current[segment];
    } else {
      return undefined;
    }
  }

  return current;
};

const buildRows = (node) => {
  if (node == null) {
    return [];
  }

  if (isPlainObject(node)) {
    return Object.entries(node).map(([key, value]) => {
      const kind = getNodeKind(value);
      const label =
        kind === 'table'
          ? `${key} /`
          : kind === 'tableArray'
            ? `${key} / [array:${value.length}]`
            : `${key} = ${previewValue(value)}`;

      return {
        key,
        kind,
        value,
        pathSegment: key,
        label,
        preview: previewValue(value),
      };
    });
  }

  if (Array.isArray(node)) {
    if (node.length === 0) {
      return [];
    }

    return node.map((value, index) => {
      const kind = getNodeKind(value);
      const label = kind === 'table' ? `[${index}] /` : `[${index}] = ${previewValue(value)}`;
      return {
        key: String(index),
        kind,
        value,
        pathSegment: index,
        label,
        preview: previewValue(value),
      };
    });
  }

  return [];
};

const formatDetails = (value) => {
  if (isPlainObject(value) || Array.isArray(value)) {
    const text = JSON.stringify(value, null, 2);
    return text.length > MAX_DETAIL_CHARS ? `${text.slice(0, MAX_DETAIL_CHARS)}\u2026` : text;
  }

  return String(value);
};

const Header = () =>
  React.createElement(
    Box,
    {
      flexDirection: 'column',
      borderStyle: 'round',
      borderColor: 'cyan',
      paddingX: 1,
      marginBottom: 1,
    },
    React.createElement(
      Box,
      { flexDirection: 'row', alignItems: 'center', marginBottom: 1 },
      React.createElement(Text, { color: 'cyan', bold: true }, '✦'),
      React.createElement(Text, { color: 'cyan', bold: true }, ` ${BRAND}`)
    ),
    React.createElement(
      Text,
      { color: 'gray' },
      'Navigate .toml tables and keys using structural hierarchy'
    ),
    React.createElement(
      Box,
      { flexDirection: 'row', gap: 1, marginTop: 1 },
      ...CONFIG_TAGS.map((tag) =>
        React.createElement(
          Text,
          { key: `tag-${tag}`, color: 'black', backgroundColor: 'blue' },
          ` ${tag} `
        )
      )
    )
  );

const ConfigNavigator = ({ snapshot, pathSegments, selectedIndex, terminalWidth }) => {
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

  return React.createElement(
    Box,
    { flexDirection: 'row', gap: 2 },
    React.createElement(
      Box,
      { flexDirection: 'column', width: leftWidth },
      React.createElement(Text, { color: 'yellow' }, `Path: ${toPathString(pathSegments)}`),
      React.createElement(Text, { color: 'gray' }, `Items: ${rows.length}`),
      React.createElement(
        Box,
        {
          flexDirection: 'column',
          marginTop: 1,
          borderStyle: 'single',
          borderColor: 'gray',
          padding: 1,
        },
        rows.length === 0
          ? React.createElement(Text, { color: 'gray' }, '[no entries in this table]')
          : rows.map((row, index) => {
              const isSelected = index === selected;
              return React.createElement(
                MenuItem,
                { isSelected, key: `${row.key}-${index}` },
                `${isSelected ? '▶' : ' '} ${row.label}`
              );
            })
      )
    ),
    React.createElement(
      Box,
      { flexDirection: 'column', width: rightWidth },
      React.createElement(Text, { color: 'white', bold: true }, 'Details'),
      rows.length === 0
        ? React.createElement(Text, { color: 'gray' }, 'No selection available.')
        : rows.map((row, index) => {
            if (index !== selected) {
              return null;
            }

            return React.createElement(
              React.Fragment,
              { key: `details-${row.key}` },
              React.createElement(Text, { color: 'gray' }, `Node: ${row.key}`),
              React.createElement(Text, { color: 'gray' }, `Type: ${row.kind}`),
              row.kind === 'value'
                ? React.createElement(Text, { color: 'white' }, `Value: ${formatDetails(row.value)}`)
                : React.createElement(
                    Text,
                    { color: 'white' },
                    `Contains ${isPlainObject(row.value) ? 'table entries' : 'items'}: ${
                      isPlainObject(row.value) ? Object.keys(row.value).length : row.value.length
                    }`
                  )
            );
          })
    )
  );
};

const App = () => {
  const isInteractive = process.stdin.isTTY && process.stdout.isTTY;
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns || 100;
  const [snapshot, setSnapshot] = useState(readConfig);
  const [pathSegments, setPathSegments] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectionByPath, setSelectionByPath] = useState({});

  if (!isInteractive) {
    return React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      React.createElement(Header),
      React.createElement(ConfigNavigator, {
        snapshot,
        pathSegments,
        selectedIndex: 0,
        terminalWidth,
      }),
      React.createElement(Text, { color: 'yellow' }, 'Non-interactive mode: input is disabled.')
    );
  }

  const { exit } = useApp();
  const currentNode = getNodeAtPath(snapshot.ok ? snapshot.data : {}, pathSegments);
  const rows = buildRows(currentNode);
  const safeSelected = rows.length === 0 ? 0 : Math.min(selectedIndex, rows.length - 1);
  const currentPathKey = pathToKey(pathSegments);

  const getSavedIndex = (segments, fallback = 0) => {
    const key = pathToKey(segments);
    const maybe = selectionByPath[key];
    if (Number.isInteger(maybe)) {
      return maybe;
    }

    return fallback;
  };

  useInput((input, key) => {
    if (input === 'q') {
      exit();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((previous) => (rows.length === 0 ? 0 : Math.max(previous - 1, 0)));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((previous) => (rows.length === 0 ? 0 : Math.min(previous + 1, rows.length - 1)));
      return;
    }

    if (key.return && rows[safeSelected]) {
      const target = rows[safeSelected];

      if (target.kind === 'table' || target.kind === 'tableArray') {
        const nextPath = [...pathSegments, target.pathSegment];
        const nextPathKey = pathToKey(nextPath);
        setPathSegments((previous) => [...previous, target.pathSegment]);
        setSelectionByPath((previous) => ({
          ...previous,
          [currentPathKey]: safeSelected,
        }));

        const nextNode = getNodeAtPath(snapshot.ok ? snapshot.data : {}, nextPath);
        const nextRows = buildRows(nextNode);
        const savedIndex = getSavedIndex(nextPath, 0);
        setSelectedIndex(
          nextRows.length === 0 ? 0 : clamp(savedIndex, 0, nextRows.length - 1)
        );
      }
    }

    if (input === 'r') {
      setSnapshot(readConfig());
      setPathSegments([]);
      setSelectedIndex(0);
      setSelectionByPath({});
      return;
    }

    if (key.leftArrow || isBackspaceKey(input, key)) {
      if (pathSegments.length === 0) {
        return;
      }

      const parentPath = pathSegments.slice(0, -1);
      const parentNode = getNodeAtPath(snapshot.ok ? snapshot.data : {}, parentPath);
      const parentRows = buildRows(parentNode);
      const savedIndex = getSavedIndex(parentPath, 0);

      setPathSegments(parentPath);
      setSelectionByPath((previous) => ({
        ...previous,
        [currentPathKey]: safeSelected,
      }));
      setSelectedIndex(
        parentRows.length === 0 ? 0 : clamp(savedIndex, 0, parentRows.length - 1)
      );
      return;
    }
  });

  return React.createElement(
    Box,
    { flexDirection: 'column', padding: 1 },
    React.createElement(Header),
    React.createElement(ConfigNavigator, {
      snapshot,
      pathSegments,
      selectedIndex: safeSelected,
      terminalWidth,
    }),
    React.createElement(Text, { color: 'gray' }, CONTROL_HINT)
  );
};

render(React.createElement(App));
