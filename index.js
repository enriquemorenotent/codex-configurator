#!/usr/bin/env node

import React, { useState, useEffect } from 'react';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import { render, useInput, useApp, useStdout, Text, Box } from 'ink';
import {
  CONTROL_HINT,
  EDIT_CONTROL_HINT,
  FILE_SWITCH_HINT,
  FILTER_CONTROL_HINT,
} from './src/constants.js';
import {
  buildConfigFileCatalog,
  MAIN_CONFIG_FILE_ID,
} from './src/fileContext.js';
import {
  ensureConfigFileExists,
  readConfig,
  getNodeAtPath,
  buildRows,
  deleteValueAtPathPruningEmptyObjects,
  setValueAtPath,
  writeConfig,
} from './src/configParser.js';
import {
  getConfigOptions,
  getConfigVariantMeta,
} from './src/configHelp.js';
import {
  getReferenceOptionForPath,
  getReferenceCustomIdPlaceholder,
} from './src/configReference.js';
import { normalizeCustomPathId } from './src/customPathId.js';
import {
  applyVariantSelection,
  buildVariantSelectorOptions,
  isObjectValue,
  objectMatchesVariant,
  resolveMixedVariantBackNavigationPath,
  resolveObjectVariantNavigationPath,
} from './src/variantPresets.js';
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
import { filterRowsByQuery } from './src/fuzzySearch.js';

const require = createRequire(import.meta.url);
const { version: PACKAGE_VERSION = 'unknown' } = require('./package.json');

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
const VERSION_COMMAND_TIMEOUT_MS = 3000;
const UPDATE_COMMAND_TIMEOUT_MS = 180000;
const COMMAND_MAX_BUFFER_BYTES = 1024 * 1024;
const UPDATE_MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const CODEX_BIN_ENV_VAR = 'CODEX_CONFIGURATOR_CODEX_BIN';
const NPM_BIN_ENV_VAR = 'CODEX_CONFIGURATOR_NPM_BIN';
const CONFIGURATOR_PACKAGE_NAME = 'codex-configurator';

const runCommandWithResult = (command, args = [], options = {}) =>
  new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        encoding: 'utf8',
        timeout: options.timeout || VERSION_COMMAND_TIMEOUT_MS,
        maxBuffer: options.maxBuffer || COMMAND_MAX_BUFFER_BYTES,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          stdout: String(stdout || '').trim(),
          stderr: String(stderr || '').trim(),
        });
      }
    );
  });

const runCommand = async (command, args = [], options = {}) => {
  const result = await runCommandWithResult(command, args, options);
  if (!result.ok) {
    return '';
  }

  return result.stdout;
};

const getConfiguredCommand = (environmentVariableName, fallbackCommand) => {
  const configuredCommand = String(process.env[environmentVariableName] || '').trim();
  return configuredCommand || fallbackCommand;
};

const expandTildePath = (value, homeDir = os.homedir()) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return '';
  }

  if (normalized === '~') {
    return homeDir;
  }

  if (normalized.startsWith('~/') || normalized.startsWith('~\\')) {
    return path.join(homeDir, normalized.slice(2));
  }

  return normalized;
};

const resolveAgentConfigFilePath = (mainConfigPath, configFileValue) => {
  const normalizedValue = expandTildePath(configFileValue);
  if (!normalizedValue) {
    return '';
  }

  const mainPath = String(mainConfigPath || '').trim() || path.resolve(process.cwd(), '.codex', 'config.toml');
  const mainDirectory = path.dirname(mainPath);

  return path.resolve(mainDirectory, normalizedValue);
};

const getVersionCommands = () => ({
  codexCommand: getConfiguredCommand(CODEX_BIN_ENV_VAR, 'codex'),
  npmCommand: getConfiguredCommand(NPM_BIN_ENV_VAR, 'npm'),
});

const getLatestPackageVersion = async (npmCommand, packageName) => {
  const latestOutput = await runCommand(npmCommand, ['view', packageName, 'version', '--json']);
  return normalizeVersion(latestOutput) || latestOutput.trim();
};

const updateGlobalPackageToLatest = async (npmCommand, packageName) => {
  const result = await runCommandWithResult(
    npmCommand,
    ['install', '-g', `${packageName}@latest`],
    {
      timeout: UPDATE_COMMAND_TIMEOUT_MS,
      maxBuffer: UPDATE_MAX_BUFFER_BYTES,
    }
  );

  return result.ok;
};

const getCodexVersion = async (codexCommand) => {
  const output = await runCommand(codexCommand, ['--version']);
  const firstLine = output.split('\n')[0]?.trim();

  if (!firstLine) {
    return 'version unavailable';
  }

  return firstLine.startsWith('codex') ? firstLine : `version ${firstLine}`;
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

const getCodexUpdateStatus = async () => {
  const commands = getVersionCommands();
  const installedLabel = await getCodexVersion(commands.codexCommand);
  const installed = normalizeVersion(installedLabel);

  if (!installed) {
    return {
      installed: installedLabel,
      latest: 'unknown',
      status: 'version check unavailable',
    };
  }

  const latestOutput = await runCommand(commands.npmCommand, [
    'view',
    '@openai/codex',
    'version',
    '--json',
  ]);
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
};

const ensureLatestConfiguratorVersion = async (npmCommand) => {
  const installed = normalizeVersion(PACKAGE_VERSION);
  if (!installed) {
    return;
  }

  const latest = await getLatestPackageVersion(npmCommand, CONFIGURATOR_PACKAGE_NAME);
  if (!latest) {
    return;
  }

  if (compareVersions(installed, latest) >= 0) {
    return;
  }

  await updateGlobalPackageToLatest(npmCommand, CONFIGURATOR_PACKAGE_NAME);
};

const App = () => {
  const initialMainSnapshot = readConfig();
  const initialCatalog = buildConfigFileCatalog(initialMainSnapshot);
  const initialActiveFileId = initialCatalog[0]?.id || MAIN_CONFIG_FILE_ID;

  const isInteractive = process.stdin.isTTY && process.stdout.isTTY;
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns || 100;
  const terminalHeight = stdout?.rows || 24;

  const [snapshot, setSnapshot] = useState(initialMainSnapshot);
  const [snapshotByFileId, setSnapshotByFileId] = useState({
    [initialActiveFileId]: initialMainSnapshot,
  });
  const [configFileCatalog, setConfigFileCatalog] = useState(initialCatalog);
  const [activeConfigFileId, setActiveConfigFileId] = useState(initialActiveFileId);
  const [pathSegments, setPathSegments] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectionByPath, setSelectionByPath] = useState({});
  const [scrollOffset, setScrollOffset] = useState(0);
  const [editMode, setEditMode] = useState(null);
  const [isFileSwitchMode, setIsFileSwitchMode] = useState(false);
  const [fileSwitchIndex, setFileSwitchIndex] = useState(0);
  const [editError, setEditError] = useState('');
  const [filterQuery, setFilterQuery] = useState('');
  const [isFilterEditing, setIsFilterEditing] = useState(false);
  const [codexVersion, setCodexVersion] = useState('version loading...');
  const [codexVersionStatus, setCodexVersionStatus] = useState('');
  const { exit } = useApp();

  useEffect(() => {
    let isCancelled = false;

    const loadVersionStatus = async () => {
      const check = await getCodexUpdateStatus();

      if (isCancelled) {
        return;
      }

      setCodexVersion(check.installed);
      setCodexVersionStatus(check.status);
    };

    const ensureLatestConfigurator = async () => {
      const commands = getVersionCommands();
      await ensureLatestConfiguratorVersion(commands.npmCommand);
    };

    loadVersionStatus();
    ensureLatestConfigurator();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const hasActiveFile = configFileCatalog.some((file) => file.id === activeConfigFileId);
    if (hasActiveFile) {
      return;
    }

    const fallbackFile = configFileCatalog[0];
    if (!fallbackFile) {
      return;
    }

    const fallbackSnapshot = snapshotByFileId[fallbackFile.id]
      || (fallbackFile.kind === 'agent'
        ? ensureConfigFileExists(fallbackFile.path)
        : readConfig(fallbackFile.path));
    setActiveConfigFileId(fallbackFile.id);
    setSnapshotByFileId((previous) => (previous[fallbackFile.id] ? previous : {
      ...previous,
      [fallbackFile.id]: fallbackSnapshot,
    }));
    setSnapshot(fallbackSnapshot);
    setPathSegments([]);
    setSelectedIndex(0);
    setSelectionByPath({});
    setScrollOffset(0);
  }, [configFileCatalog, activeConfigFileId, snapshotByFileId]);

  useEffect(() => {
    if (!isFileSwitchMode) {
      return;
    }

    setFileSwitchIndex((previous) => {
      const maxIndex = Math.max(0, configFileCatalog.length - 1);
      return clamp(previous, 0, maxIndex);
    });
  }, [isFileSwitchMode, configFileCatalog]);

  const activeConfigFile = configFileCatalog.find((file) => file.id === activeConfigFileId) || configFileCatalog[0];
  const activeConfigFilePath = activeConfigFile?.path || snapshot.path;
  const readActiveConfigSnapshot = () => {
    const activeEntry = resolveActiveFileEntry();
    const targetPath = activeEntry?.path || activeConfigFilePath;

    if (!activeEntry || activeEntry.kind !== 'agent') {
      return readConfig(targetPath);
    }

    return ensureConfigFileExists(targetPath);
  };

  const currentNode = getNodeAtPath(snapshot.ok ? snapshot.data : {}, pathSegments);
  const allRows = buildRows(currentNode, pathSegments);
  const rows = filterRowsByQuery(allRows, filterQuery);
  const safeSelected = rows.length === 0 ? 0 : Math.min(selectedIndex, rows.length - 1);
  const listViewportHeight = computeListViewportHeight(rows, terminalHeight);
  const currentPathKey = `${activeConfigFileId}::${pathToKey(pathSegments)}`;

  const getSavedIndex = (segments, fallback = 0) => {
    const key = `${activeConfigFileId}::${pathToKey(segments)}`;
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

  const updateActiveSnapshot = (nextSnapshot) => {
    setSnapshot(nextSnapshot);
    setSnapshotByFileId((previous) => ({
      ...previous,
      [activeConfigFileId]: nextSnapshot,
    }));
  };

  const ensureAgentConfigFile = (nextData, editedPath) => {
    if (activeConfigFileId !== MAIN_CONFIG_FILE_ID) {
      return true;
    }

    const isAgentConfigFilePath = Array.isArray(editedPath)
      && editedPath.length === 3
      && editedPath[0] === 'agents'
      && editedPath[2] === 'config_file';
    if (!isAgentConfigFilePath) {
      return true;
    }

    const configFileValue = getNodeAtPath(nextData, editedPath);
    if (typeof configFileValue !== 'string' || !configFileValue.trim()) {
      return true;
    }

    const normalizedTarget = resolveAgentConfigFilePath(activeConfigFile?.path || snapshot.path, configFileValue);
    if (!normalizedTarget) {
      return true;
    }

    const ensureResult = ensureConfigFileExists(normalizedTarget);
    if (!ensureResult.ok) {
      setEditError(ensureResult.error);
      return false;
    }

    setSnapshotByFileId((previous) => ({
      ...previous,
      [`agent:${normalizedTarget}`]: previous[`agent:${normalizedTarget}`] || ensureResult,
    }));
    return true;
  };

  const resolveActiveFileEntry = () =>
    configFileCatalog.find((file) => file.id === activeConfigFileId);

  const refreshConfigFileCatalog = (mainSnapshot) => {
    const nextCatalog = buildConfigFileCatalog(mainSnapshot);
    setConfigFileCatalog(nextCatalog);
    return nextCatalog;
  };

  const switchConfigFile = (nextFileId) => {
    const nextFile = configFileCatalog.find((file) => file.id === nextFileId);
    if (!nextFile) {
      return;
    }

    const nextSnapshot = snapshotByFileId[nextFileId]
      || (nextFile.kind === 'agent' ? ensureConfigFileExists(nextFile.path) : readConfig(nextFile.path));
    if (!snapshotByFileId[nextFileId]) {
      setSnapshotByFileId((previous) => ({
        ...previous,
        [nextFileId]: nextSnapshot,
      }));
    }

    if (nextFileId === activeConfigFileId) {
      return;
    }

    setActiveConfigFileId(nextFileId);
    setSnapshot(nextSnapshot);
    setPathSegments([]);
    setSelectedIndex(0);
    setScrollOffset(0);
    setEditMode(null);
    setIsFileSwitchMode(false);
    setEditError('');
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

  const beginVariantEditing = (target, targetPath, variantMeta) => {
    if (variantMeta?.kind !== 'scalar_object') {
      return;
    }

    const variantOptions = buildVariantSelectorOptions(variantMeta);
    if (variantOptions.length === 0) {
      return;
    }

    const currentVariantIndex = isObjectValue(target.value)
      ? variantOptions.findIndex(
          (option) => option.kind === 'object' && objectMatchesVariant(target.value, option)
        )
      : variantOptions.findIndex(
          (option) => option.kind === 'scalar' && Object.is(option.value, String(target.value))
        );
    const selectedOptionIndex = currentVariantIndex >= 0 ? currentVariantIndex : 0;

    setEditError('');
    setEditMode({
      mode: 'variant-select',
      key: target.key,
      path: targetPath,
      options: variantOptions.map((option) => option.label),
      variantOptions,
      selectedOptionIndex: clamp(selectedOptionIndex, 0, variantOptions.length - 1),
      savedOptionIndex: null,
    });
  };

  const openPathView = (nextPath, nextData) => {
    const data = typeof nextData === 'undefined'
      ? (snapshot.ok ? snapshot.data : {})
      : nextData;
    const nextNode = getNodeAtPath(data, nextPath);
    const nextRows = buildRows(nextNode, nextPath);
    const nextViewportHeight = computeListViewportHeight(nextRows, terminalHeight);
    const nextSavedIndex = getSavedIndex(nextPath, 0);
    const nextSelected = nextRows.length === 0
      ? 0
      : clamp(nextSavedIndex, 0, nextRows.length - 1);

    setSelectionByPath((previous) => ({
      ...previous,
      [currentPathKey]: safeSelected,
    }));
    setPathSegments(nextPath);
    setSelectedIndex(nextSelected);
    setScrollOffset(
      clamp(nextSelected, 0, Math.max(0, nextRows.length - nextViewportHeight))
    );
  };

  const applyEdit = () => {
    if (!editMode || editMode.mode !== 'select') {
      return;
    }

    const nextIndex = editMode.selectedOptionIndex;
    const nextValue = editMode.options[nextIndex];
    const nextData = setValueAtPath(snapshot.ok ? snapshot.data : {}, editMode.path, nextValue);
    if (!ensureAgentConfigFile(nextData, editMode.path)) {
      return;
    }

    const writeResult = writeConfig(nextData, snapshot.path);

    if (!writeResult.ok) {
      setEditError(writeResult.error);
      return;
    }

    const nextSnapshot = {
      ok: true,
      path: snapshot.path,
      data: nextData,
    };
    updateActiveSnapshot(nextSnapshot);

    if (activeConfigFileId === MAIN_CONFIG_FILE_ID) {
      refreshConfigFileCatalog(nextSnapshot);
    }
    setEditMode(null);
    setEditError('');
  };

  const applyTextEdit = () => {
    if (!editMode || editMode.mode !== 'text') {
      return;
    }

    const nextData = setValueAtPath(snapshot.ok ? snapshot.data : {}, editMode.path, editMode.draftValue);
    if (!ensureAgentConfigFile(nextData, editMode.path)) {
      return;
    }

    const writeResult = writeConfig(nextData, snapshot.path);

    if (!writeResult.ok) {
      setEditError(writeResult.error);
      return;
    }

    const nextSnapshot = {
      ok: true,
      path: snapshot.path,
      data: nextData,
    };
    updateActiveSnapshot(nextSnapshot);

    if (activeConfigFileId === MAIN_CONFIG_FILE_ID) {
      refreshConfigFileCatalog(nextSnapshot);
    }
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

    openPathView(nextPath, data);
    setEditMode(null);
    setEditError('');
  };

  const applyVariantEdit = () => {
    if (!editMode || editMode.mode !== 'variant-select') {
      return;
    }

    const selectedVariant = Array.isArray(editMode.variantOptions)
      ? editMode.variantOptions[editMode.selectedOptionIndex]
      : null;
    if (!selectedVariant) {
      setEditMode(null);
      setEditError('');
      return;
    }

    const data = snapshot.ok ? snapshot.data : {};
    const currentValue = getNodeAtPath(data, editMode.path);
    const selectionResult = applyVariantSelection({
      currentValue,
      selectedVariant,
      resolveDefaultValue: (requiredKey) => {
        const requiredPath = [...editMode.path, requiredKey];
        const requiredOptions = getConfigOptions(requiredPath, requiredKey, undefined, 'value') || [];
        if (requiredOptions.length > 0) {
          return requiredOptions[0];
        }

        if (isStringReferenceType(getReferenceOptionForPath(requiredPath)?.type)) {
          return '';
        }

        return {};
      },
    });

    const shouldPersistSelection =
      selectionResult.changed &&
      (
        !selectionResult.isObjectSelection ||
        selectionResult.isObjectVariantSwitch
      );
    let nextData = data;
    if (shouldPersistSelection) {
      nextData = setValueAtPath(data, editMode.path, selectionResult.nextValue);
      const writeResult = writeConfig(nextData, snapshot.path);

      if (!writeResult.ok) {
        setEditError(writeResult.error);
        return;
      }

      const nextSnapshot = {
        ok: true,
        path: snapshot.path,
        data: nextData,
      };
      updateActiveSnapshot(nextSnapshot);

      if (activeConfigFileId === MAIN_CONFIG_FILE_ID) {
        refreshConfigFileCatalog(nextSnapshot);
      }
    }

    if (selectionResult.navigateToObject) {
      const nextPath = resolveObjectVariantNavigationPath({
        basePath: editMode.path,
        nextValue: selectionResult.nextValue,
        preferredKey:
          selectedVariant.kind === 'object' && selectedVariant.requiredKeys.length === 1
            ? selectedVariant.requiredKeys[0]
            : null,
      });
      openPathView(nextPath, nextData);
    }

    setEditError('');
    setEditMode(null);
  };

  const beginFileSwitchMode = () => {
    if (!Array.isArray(configFileCatalog) || configFileCatalog.length === 0) {
      return;
    }

    if (configFileCatalog.length === 1) {
      return;
    }

    setEditError('');
    setIsFileSwitchMode(true);
    setFileSwitchIndex(Math.max(0, configFileCatalog.findIndex((file) => file.id === activeConfigFileId)));
  };

  const applyFileSwitch = () => {
    if (!isFileSwitchMode) {
      return;
    }

    const nextFile = configFileCatalog[fileSwitchIndex];
    if (!nextFile) {
      setIsFileSwitchMode(false);
      setEditError('');
      return;
    }

    switchConfigFile(nextFile.id);
    setIsFileSwitchMode(false);
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

    const nextSnapshot = {
      ok: true,
      path: snapshot.path,
      data: nextData,
    };
    updateActiveSnapshot(nextSnapshot);

    if (activeConfigFileId === MAIN_CONFIG_FILE_ID) {
      refreshConfigFileCatalog(nextSnapshot);
    }
    setEditError('');
  };

  const unsetValueAtPath = (targetPath) => {
    const data = snapshot.ok ? snapshot.data : {};
    const hasConfiguredValue = typeof getNodeAtPath(data, targetPath) !== 'undefined';

    if (!hasConfiguredValue) {
      setEditError('');
      return;
    }

    const nextData = deleteValueAtPathPruningEmptyObjects(data, targetPath);
    const writeResult = writeConfig(nextData, snapshot.path);

    if (!writeResult.ok) {
      setEditError(writeResult.error);
      return;
    }

    const nextSnapshot = {
      ok: true,
      path: snapshot.path,
      data: nextData,
    };
    updateActiveSnapshot(nextSnapshot);

    if (activeConfigFileId === MAIN_CONFIG_FILE_ID) {
      refreshConfigFileCatalog(nextSnapshot);
    }
    setEditError('');
  };

  useInput((input, key) => {
    const isTextEditing = isInlineTextMode(editMode?.mode);

    if (isFilterEditing) {
      if (key.return || key.escape) {
        setIsFilterEditing(false);
        return;
      }

      if ((key.ctrl && key.name === 'u') || input === '\u0015') {
        setFilterQuery('');
        return;
      }

      if (isDeleteKey(input, key) || isBackspaceKey(input, key)) {
        setFilterQuery((previous) => previous.slice(0, -1));
        return;
      }

      if (
        key.rightArrow ||
        key.leftArrow ||
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
        setFilterQuery((previous) => `${previous}${input}`);
      }
      return;
    }

    if (isFileSwitchMode) {
      if (input === 'q') {
        exit();
        return;
      }

      if (key.upArrow) {
        setFileSwitchIndex((previous) => clamp(previous - 1, 0, configFileCatalog.length - 1));
        return;
      }

      if (key.downArrow) {
        setFileSwitchIndex((previous) => clamp(previous + 1, 0, configFileCatalog.length - 1));
        return;
      }

      if (isPageUpKey(input, key)) {
        setFileSwitchIndex((previous) => clamp(previous - listViewportHeight, 0, configFileCatalog.length - 1));
        return;
      }

      if (isPageDownKey(input, key)) {
        setFileSwitchIndex((previous) => clamp(previous + listViewportHeight, 0, configFileCatalog.length - 1));
        return;
      }

      if (isHomeKey(input, key)) {
        setFileSwitchIndex(0);
        return;
      }

      if (isEndKey(input, key)) {
        setFileSwitchIndex(Math.max(0, configFileCatalog.length - 1));
        return;
      }

      if (key.return) {
        applyFileSwitch();
        return;
      }

      if (key.escape || isBackspaceKey(input, key) || key.leftArrow) {
        setIsFileSwitchMode(false);
        setFileSwitchIndex(Math.max(0, configFileCatalog.findIndex((file) => file.id === activeConfigFileId)));
        setEditError('');
        return;
      }

      if (isDeleteKey(input, key)) {
        return;
      }

      return;
    }

    if (input === 'q' && !isTextEditing) {
      exit();
      return;
    }

    if (!editMode && !isFileSwitchMode && input === '/') {
      setIsFilterEditing(true);
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
        if (editMode.mode === 'variant-select') {
          applyVariantEdit();
          return;
        }

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

      const targetPath = [...pathSegments, target.pathSegment];
      const variantMeta =
        typeof target.pathSegment !== 'undefined' &&
        target.pathSegment !== null &&
        typeof target.key === 'string'
          ? getConfigVariantMeta(pathSegments, target.key)
          : null;
      if (variantMeta?.kind === 'scalar_object') {
        beginVariantEditing(target, targetPath, variantMeta);
        return;
      }

      if (target.kind === 'table' || target.kind === 'tableArray') {
        openPathView(targetPath);
        return;
      }

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
      const nextSnapshot = readActiveConfigSnapshot();
      updateActiveSnapshot(nextSnapshot);
      setPathSegments([]);
      setSelectedIndex(0);
      setSelectionByPath({});
      setScrollOffset(0);
      setEditMode(null);
      setEditError('');

      if (activeConfigFileId === MAIN_CONFIG_FILE_ID) {
        refreshConfigFileCatalog(nextSnapshot);
      }

      return;
    }

    if (input === 'f' && !editMode && !isFileSwitchMode) {
      beginFileSwitchMode();
      return;
    }

    if (key.leftArrow || isBackspaceKey(input, key) || key.escape) {
      if (pathSegments.length === 0) {
        return;
      }

      const fallbackParentPath = pathSegments.slice(0, -1);
      const backTargetPath = resolveMixedVariantBackNavigationPath({
        pathSegments,
        resolveVariantMeta: getConfigVariantMeta,
      }) || fallbackParentPath;
      const parentNode = getNodeAtPath(snapshot.ok ? snapshot.data : {}, backTargetPath);
      const parentRows = buildRows(parentNode, backTargetPath);
      const savedIndex = getSavedIndex(backTargetPath, 0);

      setPathSegments(backTargetPath);
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
  }, { isActive: isInteractive });

  useEffect(() => {
    const maxOffset = Math.max(0, rows.length - listViewportHeight);
    setScrollOffset((previous) => clamp(previous, 0, maxOffset));
  }, [rows.length, listViewportHeight]);

  const renderFileSwitchPanel = () => {
    if (!isFileSwitchMode || configFileCatalog.length === 0) {
      return null;
    }

    return React.createElement(
      Box,
      { marginTop: 1, borderStyle: 'round', borderColor: 'cyan', paddingLeft: 1, flexDirection: 'column' },
      React.createElement(Text, { bold: true, color: 'cyan' }, 'File Switch'),
      ...configFileCatalog.map((file, index) => {
        const isSelected = index === fileSwitchIndex;
        const isActiveFile = file.id === activeConfigFileId;
        const fileLabel = `${file.label} (${file.kind === 'main' ? 'main' : 'agent'})`;
        return React.createElement(
          Text,
          {
            key: file.id,
            color: isSelected ? 'yellow' : isActiveFile ? 'green' : 'gray',
            bold: isSelected,
          },
          `${isSelected ? '› ' : '  '}${fileLabel}${isActiveFile ? ' [active]' : ''}`
        );
      })
    );
  };

  if (!isInteractive) {
    return React.createElement(
      Box,
      { flexDirection: 'column', padding: 1 },
      React.createElement(Header, {
        codexVersion,
        codexVersionStatus,
        packageVersion: PACKAGE_VERSION,
        activeConfigFile: activeConfigFile,
      }),
      React.createElement(ConfigNavigator, {
        snapshot,
        pathSegments,
        selectedIndex: 0,
        terminalWidth,
        terminalHeight,
        scrollOffset: 0,
        editMode: null,
        editError: editError,
        filterQuery,
        isFilterEditing,
        activeConfigFile: activeConfigFile,
      }),
      React.createElement(Text, { color: 'yellow' }, 'Non-interactive mode: input is disabled.')
    );
  }

  return React.createElement(
    Box,
    { flexDirection: 'column', padding: 1 },
    React.createElement(Header, {
      codexVersion,
      codexVersionStatus,
      packageVersion: PACKAGE_VERSION,
      activeConfigFile: activeConfigFile,
    }),
    React.createElement(ConfigNavigator, {
      snapshot,
      pathSegments,
      selectedIndex: safeSelected,
      terminalWidth,
      terminalHeight,
      scrollOffset,
      editMode,
      editError,
      filterQuery,
      isFilterEditing,
      activeConfigFile: activeConfigFile,
    }),
    renderFileSwitchPanel(),
    React.createElement(
      Text,
      { color: 'gray' },
      isFilterEditing
        ? FILTER_CONTROL_HINT
        : isFileSwitchMode
          ? FILE_SWITCH_HINT
          : editMode
            ? EDIT_CONTROL_HINT
          : CONTROL_HINT
    )
  );
};

render(React.createElement(App));
