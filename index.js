#!/usr/bin/env node

import React, { useState, useEffect } from 'react';
import { render, useInput, useApp, useStdout, Text, Box } from 'ink';
import { CONTROL_HINT } from './src/constants.js';
import { readConfig, getNodeAtPath, buildRows } from './src/configParser.js';
import { pathToKey, clamp } from './src/layout.js';
import { isBackspaceKey } from './src/interaction.js';
import { Header } from './src/components/Header.js';
import { ConfigNavigator } from './src/components/ConfigNavigator.js';

const computeListViewportHeight = (rows, terminalRows) =>
  Math.max(4, Math.min(rows.length, Math.max(4, terminalRows - 14)));

const App = () => {
  const isInteractive = process.stdin.isTTY && process.stdout.isTTY;
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns || 100;
  const terminalHeight = stdout?.rows || 24;

  const [snapshot, setSnapshot] = useState(readConfig);
  const [pathSegments, setPathSegments] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectionByPath, setSelectionByPath] = useState({});
  const [scrollOffset, setScrollOffset] = useState(0);
  const { exit } = useApp();

  const currentNode = getNodeAtPath(snapshot.ok ? snapshot.data : {}, pathSegments);
  const rows = buildRows(currentNode);
  const safeSelected = rows.length === 0 ? 0 : Math.min(selectedIndex, rows.length - 1);
  const listViewportHeight = computeListViewportHeight(rows, terminalHeight);
  const currentPathKey = pathToKey(pathSegments);

  const getSavedIndex = (segments, fallback = 0) => {
    const key = pathToKey(segments);
    const maybe = selectionByPath[key];

    if (Number.isInteger(maybe)) {
      return maybe;
    }

    return fallback;
  };

  const adjustScrollForSelection = (nextSelection, nextViewportHeight, totalRows) => {
    const maxOffset = Math.max(0, totalRows - nextViewportHeight);
    const minOffset = 0;

    setScrollOffset((previous) => {
      if (nextSelection < previous) {
        return clamp(nextSelection, minOffset, maxOffset);
      }

      if (nextSelection > previous + nextViewportHeight - 1) {
        return clamp(nextSelection - nextViewportHeight + 1, minOffset, maxOffset);
      }

      return clamp(previous, minOffset, maxOffset);
    });
  };

  useInput((input, key) => {
    if (input === 'q') {
      exit();
      return;
    }

    if (key.upArrow) {
      if (rows.length === 0) {
        return;
      }

      setSelectedIndex((previous) => {
        const next = Math.max(previous - 1, 0);
        adjustScrollForSelection(next, listViewportHeight, rows.length);
        return next;
      });
      return;
    }

    if (key.downArrow) {
      if (rows.length === 0) {
        return;
      }

      setSelectedIndex((previous) => {
        const next = Math.min(previous + 1, rows.length - 1);
        adjustScrollForSelection(next, listViewportHeight, rows.length);
        return next;
      });
      return;
    }

    if (key.return && rows[safeSelected]) {
      const target = rows[safeSelected];

      if (target.kind === 'table' || target.kind === 'tableArray') {
        const nextPath = [...pathSegments, target.pathSegment];

        setPathSegments((previous) => [...previous, target.pathSegment]);
        setSelectionByPath((previous) => ({
          ...previous,
          [currentPathKey]: safeSelected,
        }));

        const nextNode = getNodeAtPath(snapshot.ok ? snapshot.data : {}, nextPath);
        const nextRows = buildRows(nextNode);
        const nextViewportHeight = computeListViewportHeight(nextRows, terminalHeight);
        const nextSavedIndex = getSavedIndex(nextPath, 0);
        const nextSelected = nextRows.length === 0 ? 0 : clamp(nextSavedIndex, 0, nextRows.length - 1);

        setSelectedIndex(nextSelected);
        setScrollOffset(clamp(nextSelected, 0, Math.max(0, nextRows.length - nextViewportHeight)));
      }
      return;
    }

    if (input === 'r') {
      setSnapshot(readConfig());
      setPathSegments([]);
      setSelectedIndex(0);
      setSelectionByPath({});
      setScrollOffset(0);
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

      const parentViewportHeight = computeListViewportHeight(parentRows, terminalHeight);
      const parentSelected = parentRows.length === 0 ? 0 : clamp(savedIndex, 0, parentRows.length - 1);
      setSelectedIndex(parentSelected);
      setScrollOffset(clamp(parentSelected, 0, Math.max(0, parentRows.length - parentViewportHeight)));
      return;
    }
  });

  useEffect(() => {
    const maxOffset = Math.max(0, rows.length - listViewportHeight);
    setScrollOffset((previous) => clamp(previous, 0, maxOffset));
  }, [rows.length, listViewportHeight]);

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
        terminalHeight,
        scrollOffset: 0,
      }),
      React.createElement(Text, { color: 'yellow' }, 'Non-interactive mode: input is disabled.')
    );
  }

  return React.createElement(
    Box,
    { flexDirection: 'column', padding: 1 },
    React.createElement(Header),
    React.createElement(ConfigNavigator, {
      snapshot,
      pathSegments,
      selectedIndex: safeSelected,
      terminalWidth,
      terminalHeight,
      scrollOffset,
    }),
    React.createElement(Text, { color: 'gray' }, CONTROL_HINT)
  );
};

render(React.createElement(App));
