#!/usr/bin/env node

import React, { useState, useEffect } from 'react';
import { execSync } from 'node:child_process';
import { render, useInput, useApp, useStdout, Text, Box } from 'ink';
import { CONTROL_HINT, EDIT_CONTROL_HINT } from './src/constants.js';
import {
  readConfig,
  getNodeAtPath,
  buildRows,
  deleteValueAtPath,
  setValueAtPath,
  writeConfig,
} from './src/configParser.js';
import { getConfigOptions } from './src/configHelp.js';
import {
  getReferenceOptionForPath,
  getReferenceCustomIdPlaceholder,
} from './src/configReference.js';
import { normalizeCustomPathId } from './src/customPathId.js';
import { pathToKey, clamp } from './src/layout.js';
import {
  isBackspaceKey,
  isDeleteKey,
  isPageUpKey,
  isPageDownKey,
  isHomeKey,
  isEndKey,
} from './src/interaction.js';
import { Header } from './src/components/Header.js';
import { ConfigNavigator } from './src/components/ConfigNavigator.js';

const computeListViewportHeight = (rows, terminalRows) =>
  Math.max(4, Math.min(rows.length, Math.min(20, Math.max(4, terminalRows - 14))));

const isBooleanOnlyOptions = (options) =>
  Array.isArray(options) &&
  options.length === 2 &&
  options.every((option) => typeof option === 'boolean') &&
  options.includes(false) &&
  options.includes(true);

const isStringReferenceType = (type) => /^string(?:\s|$)/.test(String(type || '').trim());

const isStringField = (pathSegments, value) => {
  if (typeof value === 'string') {
    return true;
  }

  return isStringReferenceType(getReferenceOptionForPath(pathSegments)?.type);
};

const isCustomIdTableRow = (pathSegments, row) =>
  row?.kind === 'table' &&
  typeof row?.pathSegment === 'string' &&
  Boolean(getReferenceCustomIdPlaceholder(pathSegments));

const isInlineTextMode = (mode) => mode === 'text' || mode === 'add-id';

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
  const rows = buildRows(currentNode, pathSegments);
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
      mode: 'select',
      path: targetPath,
      options,
      selectedOptionIndex: clamp(options.findIndex((option) => Object.is(option, target.value)), 0, options.length - 1),
      savedOptionIndex: null,
    });
  };

  const beginTextEditing = (target, targetPath) => {
    setEditError('');
    setEditMode({
      mode: 'text',
      path: targetPath,
      draftValue: typeof target.value === 'string' ? target.value : '',
      savedValue: null,
    });
  };

  const beginAddIdEditing = (targetPath, placeholder = 'id') => {
    setEditError('');
    setEditMode({
      mode: 'add-id',
      path: targetPath,
      placeholder,
      draftValue: '',
      savedValue: null,
    });
  };

  const applyEdit = () => {
    if (!editMode || editMode.mode !== 'select') {
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

  const applyTextEdit = () => {
    if (!editMode || editMode.mode !== 'text') {
      return;
    }

    const nextData = setValueAtPath(snapshot.ok ? snapshot.data : {}, editMode.path, editMode.draftValue);
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

  const applyAddId = () => {
    if (!editMode || editMode.mode !== 'add-id') {
      return;
    }

    const nextIdInput = String(editMode.draftValue || '').trim();
    const placeholder = getReferenceCustomIdPlaceholder(editMode.path);
    let nextId = nextIdInput;

    if (placeholder === '<path>') {
      const normalizedPath = normalizeCustomPathId(nextIdInput);
      if (!normalizedPath.ok) {
        setEditError(normalizedPath.error);
        return;
      }

      nextId = normalizedPath.value;
    }

    if (!nextId) {
      setEditError('ID cannot be empty.');
      return;
    }

    const nextPath = [...editMode.path, nextId];
    const data = snapshot.ok ? snapshot.data : {};
    const existingValue = getNodeAtPath(data, nextPath);

    if (typeof existingValue !== 'undefined') {
      setEditError(`ID "${nextId}" already exists.`);
      return;
    }

    const nextData = setValueAtPath(data, nextPath, {});
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
    setPathSegments(nextPath);
    setSelectedIndex(0);
    setScrollOffset(0);
    setEditMode(null);
    setEditError('');
  };

  const applyBooleanToggle = (target, targetPath) => {
    const nextValue = !target.value;
    const data = snapshot.ok ? snapshot.data : {};
    const nextData = setValueAtPath(data, targetPath, nextValue);

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

  const unsetValueAtPath = (targetPath) => {
    const data = snapshot.ok ? snapshot.data : {};
    const hasConfiguredValue = typeof getNodeAtPath(data, targetPath) !== 'undefined';

    if (!hasConfiguredValue) {
      setEditError('');
      return;
    }

    const nextData = deleteValueAtPath(data, targetPath);
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
    const isTextEditing = isInlineTextMode(editMode?.mode);

    if (input === 'q' && !isTextEditing) {
      exit();
      return;
    }

    if (editMode) {
      if (isInlineTextMode(editMode.mode)) {
        if (key.return) {
          if (editMode.mode === 'text') {
            applyTextEdit();
          } else {
            applyAddId();
          }
          return;
        }

        if (key.escape) {
          setEditMode(null);
          setEditError('');
          return;
        }

        if (key.leftArrow || isBackspaceKey(input, key)) {
          setEditMode(null);
          setEditError('');
          return;
        }

        if (isDeleteKey(input, key)) {
          setEditMode((previous) => ({
            ...previous,
            draftValue: previous.draftValue.slice(0, -1),
          }));
          return;
        }

        if (
          key.rightArrow ||
          key.upArrow ||
          key.downArrow ||
          isPageUpKey(input, key) ||
          isPageDownKey(input, key) ||
          isHomeKey(input, key) ||
          isEndKey(input, key)
        ) {
          return;
        }

        if (!key.ctrl && !key.meta && input.length > 0) {
          setEditMode((previous) => ({
            ...previous,
            draftValue: `${previous.draftValue}${input}`,
          }));
        }

        return;
      }

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

      if (isPageUpKey(input, key)) {
        setEditMode((previous) => ({
          ...previous,
          selectedOptionIndex: clamp(
            previous.selectedOptionIndex - listViewportHeight,
            0,
            previous.options.length - 1
          ),
        }));
        return;
      }

      if (isPageDownKey(input, key)) {
        setEditMode((previous) => ({
          ...previous,
          selectedOptionIndex: clamp(
            previous.selectedOptionIndex + listViewportHeight,
            0,
            previous.options.length - 1
          ),
        }));
        return;
      }

      if (isHomeKey(input, key)) {
        setEditMode((previous) => ({
          ...previous,
          selectedOptionIndex: 0,
        }));
        return;
      }

      if (isEndKey(input, key)) {
        setEditMode((previous) => ({
          ...previous,
          selectedOptionIndex: Math.max(0, previous.options.length - 1),
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

      if (isDeleteKey(input, key)) {
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

    if (isPageUpKey(input, key)) {
      if (rows.length === 0) {
        return;
      }

      setSelectedIndex((previous) => {
        const next = Math.max(previous - listViewportHeight, 0);
        adjustScrollForSelection(next, listViewportHeight, rows.length);
        return next;
      });
      return;
    }

    if (isPageDownKey(input, key)) {
      if (rows.length === 0) {
        return;
      }

      setSelectedIndex((previous) => {
        const next = Math.min(previous + listViewportHeight, rows.length - 1);
        adjustScrollForSelection(next, listViewportHeight, rows.length);
        return next;
      });
      return;
    }

    if (isHomeKey(input, key)) {
      if (rows.length === 0) {
        return;
      }

      setSelectedIndex(0);
      adjustScrollForSelection(0, listViewportHeight, rows.length);
      return;
    }

    if (isEndKey(input, key)) {
      if (rows.length === 0) {
        return;
      }

      const next = rows.length - 1;
      setSelectedIndex(next);
      adjustScrollForSelection(next, listViewportHeight, rows.length);
      return;
    }

    if (key.return && rows[safeSelected]) {
      const target = rows[safeSelected];

      if (target.kind === 'action' && target.action === 'add-custom-id') {
        beginAddIdEditing(pathSegments, target.placeholder || 'id');
        return;
      }

      if (target.kind === 'table' || target.kind === 'tableArray') {
        const nextPath = [...pathSegments, target.pathSegment];

        setPathSegments((previous) => [...previous, target.pathSegment]);
        setSelectionByPath((previous) => ({
          ...previous,
          [currentPathKey]: safeSelected,
        }));

        const nextNode = getNodeAtPath(snapshot.ok ? snapshot.data : {}, nextPath);
        const nextRows = buildRows(nextNode, nextPath);
        const nextViewportHeight = computeListViewportHeight(nextRows, terminalHeight);
        const nextSavedIndex = getSavedIndex(nextPath, 0);
        const nextSelected = nextRows.length === 0 ? 0 : clamp(nextSavedIndex, 0, nextRows.length - 1);

        setSelectedIndex(nextSelected);
        setScrollOffset(clamp(nextSelected, 0, Math.max(0, nextRows.length - nextViewportHeight)));
        return;
      }

      const targetPath = [...pathSegments, target.pathSegment];
      const options = getConfigOptions(targetPath, target.key, target.value, target.kind) || [];
      if (typeof target.value === 'boolean' || isBooleanOnlyOptions(options)) {
        applyBooleanToggle(
          typeof target.value === 'boolean'
            ? target
            : { ...target, value: false },
          targetPath
        );
        return;
      }

      if (options.length > 0) {
        beginEditing(target, targetPath);
        return;
      }

      if (isStringField(targetPath, target.value)) {
        beginTextEditing(target, targetPath);
      }
      return;
    }

    if (isDeleteKey(input, key) && rows[safeSelected]) {
      const target = rows[safeSelected];
      const isValueRow = target.kind === 'value';
      const isCustomIdRow = isCustomIdTableRow(pathSegments, target);
      const isInsideArray = Array.isArray(currentNode);

      if ((!isValueRow && !isCustomIdRow) || isInsideArray) {
        return;
      }

      const targetPath = [...pathSegments, target.pathSegment];
      unsetValueAtPath(targetPath);
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
      const parentRows = buildRows(parentNode, parentPath);
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
