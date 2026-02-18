#!/usr/bin/env node

import React, { useState, useEffect } from 'react';
import { execSync } from 'node:child_process';
import { render, useInput, useApp, useStdout, Text, Box } from 'ink';
import { CONTROL_HINT, EDIT_CONTROL_HINT } from './src/constants.js';
import {
  readConfig,
  getNodeAtPath,
  buildRows,
  setValueAtPath,
  writeConfig,
} from './src/configParser.js';
import { getConfigOptions } from './src/configHelp.js';
import { pathToKey, clamp } from './src/layout.js';
import { isBackspaceKey } from './src/interaction.js';
import { Header } from './src/components/Header.js';
import { ConfigNavigator } from './src/components/ConfigNavigator.js';

const computeListViewportHeight = (rows, terminalRows) =>
  Math.max(4, Math.min(rows.length, Math.max(4, terminalRows - 14)));

const getCodexVersion = () => {
  try {
    const output = execSync('codex --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
    const firstLine = output.split('\n')[0].trim();

    if (!firstLine) {
      return 'version unavailable';
    }

    return firstLine.startsWith('codex') ? firstLine : `version ${firstLine}`;
  } catch {
    return 'version unavailable';
  }
};

const normalizeVersion = (value) => {
  const match = String(value || '').match(/(\d+\.\d+\.\d+(?:[-+._][0-9A-Za-z.-]+)*)/);
  return match ? match[1] : '';
};

const toVersionParts = (value) =>
  normalizeVersion(value)
    .split(/[-+._]/)[0]
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .filter(Number.isFinite);

const compareVersions = (left, right) => {
  const leftParts = toVersionParts(left);
  const rightParts = toVersionParts(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const a = leftParts[index] || 0;
    const b = rightParts[index] || 0;

    if (a > b) {
      return 1;
    }

    if (a < b) {
      return -1;
    }
  }

  return 0;
};

const getCodexUpdateStatus = () => {
  const installed = normalizeVersion(getCodexVersion());

  if (!installed) {
    return {
      installed: 'version unavailable',
      latest: 'unknown',
      status: 'version check unavailable',
    };
  }

  try {
    const latestOutput = execSync('npm view @openai/codex version --json', {
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
    const latest = normalizeVersion(latestOutput) || latestOutput.trim();

    if (!latest) {
      return {
        installed,
        latest: 'unknown',
        status: 'version check unavailable',
      };
    }

    const comparison = compareVersions(installed, latest);
    if (comparison < 0) {
      return {
        installed,
        latest,
        status: 'update available',
      };
    }

    return {
      installed,
      latest,
      status: 'up to date',
    };
  } catch {
    return {
      installed,
      latest: 'unknown',
      status: 'version check unavailable',
    };
  }
};

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
  const [editMode, setEditMode] = useState(null);
  const [editError, setEditError] = useState('');
  const [codexVersion, setCodexVersion] = useState('version loading...');
  const [codexVersionStatus, setCodexVersionStatus] = useState('');
  const { exit } = useApp();

  useEffect(() => {
    const check = getCodexUpdateStatus();
    setCodexVersion(check.installed);
    setCodexVersionStatus(check.status);
  }, []);

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

  const beginEditing = (target, targetPath) => {
    const options = getConfigOptions(targetPath, target.key, target.value, target.kind) || [];
    if (options.length === 0) {
      return;
    }

    setEditError('');
    setEditMode({
      path: targetPath,
      options,
      selectedOptionIndex: clamp(options.findIndex((option) => Object.is(option, target.value)), 0, options.length - 1),
      savedOptionIndex: null,
    });
  };

  const applyEdit = () => {
    if (!editMode) {
      return;
    }

    const nextIndex = editMode.selectedOptionIndex;
    const nextValue = editMode.options[nextIndex];
    const nextData = setValueAtPath(snapshot.ok ? snapshot.data : {}, editMode.path, nextValue);
    const writeResult = writeConfig(nextData, snapshot.path);

    if (!writeResult.ok) {
      setEditError(writeResult.error);
      return;
    }

    setSnapshot({
      ok: true,
      path: snapshot.path,
      data: nextData,
    });
    setEditMode(null);
    setEditError('');
  };

  const applyBooleanToggle = (target, targetPath) => {
    const nextData = setValueAtPath(snapshot.ok ? snapshot.data : {}, targetPath, !target.value);
    const writeResult = writeConfig(nextData, snapshot.path);

    if (!writeResult.ok) {
      setEditError(writeResult.error);
      return;
    }

    setSnapshot({
      ok: true,
      path: snapshot.path,
      data: nextData,
    });
    setEditError('');
  };

  useInput((input, key) => {
    if (input === 'q') {
      exit();
      return;
    }

    if (editMode) {
      if (key.upArrow) {
        setEditMode((previous) => ({
          ...previous,
          selectedOptionIndex: clamp(previous.selectedOptionIndex - 1, 0, previous.options.length - 1),
        }));
        return;
      }

      if (key.downArrow) {
        setEditMode((previous) => ({
          ...previous,
          selectedOptionIndex: clamp(previous.selectedOptionIndex + 1, 0, previous.options.length - 1),
        }));
        return;
      }

      if (key.return) {
        applyEdit();
        return;
      }

      if (key.leftArrow || isBackspaceKey(input, key)) {
        setEditMode(null);
        setEditError('');
        return;
      }

      if (key.escape) {
        setEditMode(null);
        setEditError('');
        return;
      }
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
        return;
      }

      const targetPath = [...pathSegments, target.pathSegment];
      const options = getConfigOptions(targetPath, target.key, target.value, target.kind) || [];
      if (typeof target.value === 'boolean') {
        applyBooleanToggle(target, targetPath);
        return;
      }

      if (options.length > 0) {
        beginEditing(target, targetPath);
      }
      return;
    }

    if (input === 'r') {
      setSnapshot(readConfig());
      setPathSegments([]);
      setSelectedIndex(0);
      setSelectionByPath({});
      setScrollOffset(0);
      setEditMode(null);
      setEditError('');
      return;
    }

    if (key.leftArrow || isBackspaceKey(input, key) || key.escape) {
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
      setEditMode(null);
      setEditError('');
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
      React.createElement(Header, { codexVersion, codexVersionStatus }),
      React.createElement(ConfigNavigator, {
        snapshot,
        pathSegments,
        selectedIndex: 0,
        terminalWidth,
        terminalHeight,
        scrollOffset: 0,
        editMode: null,
        editError: editError,
      }),
      React.createElement(Text, { color: 'yellow' }, 'Non-interactive mode: input is disabled.')
    );
  }

  return React.createElement(
    Box,
    { flexDirection: 'column', padding: 1 },
    React.createElement(Header, { codexVersion, codexVersionStatus }),
    React.createElement(ConfigNavigator, {
      snapshot,
      pathSegments,
      selectedIndex: safeSelected,
      terminalWidth,
      terminalHeight,
      scrollOffset,
      editMode,
      editError,
    }),
    React.createElement(Text, { color: 'gray' }, editMode ? EDIT_CONTROL_HINT : CONTROL_HINT)
  );
};

render(React.createElement(App));
