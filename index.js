#!/usr/bin/env node

import React, { useEffect, useReducer, useRef, useState } from 'react';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import { render, useInput, useApp, useStdout, Text, Box } from 'ink';
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
import { getConfigOptions, getConfigVariantMeta } from './src/configHelp.js';
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
import {
	APP_MODES,
	APP_STATE_ACTION,
	appStateReducer,
	buildInitialAppState,
} from './src/appState.js';
import { pathToKey, clamp, computeListViewportRows } from './src/layout.js';
import { Header } from './src/components/Header.js';
import { ConfigNavigator } from './src/components/ConfigNavigator.js';
import { filterRowsByQuery } from './src/fuzzySearch.js';
import { executeInputCommand, getModeHint } from './src/ui/commands.js';
import { CommandBar } from './src/ui/panes/CommandBar.js';
import { HelpBubble } from './src/ui/panes/HelpBubble.js';
import { LayoutShell } from './src/ui/panes/LayoutShell.js';
import { StatusLine } from './src/ui/panes/StatusLine.js';

const require = createRequire(import.meta.url);
const { version: PACKAGE_VERSION = 'unknown' } = require('./package.json');

const isStringReferenceType = (type) =>
	/^string(?:\s|$)/.test(String(type || '').trim());

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

const VERSION_COMMAND_TIMEOUT_MS = 3000;
const UPDATE_COMMAND_TIMEOUT_MS = 180000;
const COMMAND_MAX_BUFFER_BYTES = 1024 * 1024;
const UPDATE_MAX_BUFFER_BYTES = 10 * 1024 * 1024;
const CODEX_BIN_ENV_VAR = 'CODEX_CONFIGURATOR_CODEX_BIN';
const NPM_BIN_ENV_VAR = 'CODEX_CONFIGURATOR_NPM_BIN';
const CONFIGURATOR_PACKAGE_NAME = 'codex-configurator';
const FILE_SWITCH_MAX_VISIBLE_ENTRIES = 6;
const FILE_SWITCH_PANEL_BASE_ROWS = 3;
const FILE_SWITCH_LAYOUT_EXTRA_GAP_ROWS = 1;
const ENABLE_ALT_SCREEN = '\u001b[?1049h';
const DISABLE_ALT_SCREEN = '\u001b[?1049l';
const HIDE_CURSOR = '\u001b[?25l';
const SHOW_CURSOR = '\u001b[?25h';
const CLEAR_SCREEN = '\u001b[2J';
const CURSOR_HOME = '\u001b[H';

const supportsFullScreenTerminal = () =>
	Boolean(process.stdout?.isTTY && process.stderr?.isTTY);

const setFullScreenState = (isActive) => {
	if (!supportsFullScreenTerminal()) {
		return;
	}

	if (isActive) {
		process.stdout.write(
			`${ENABLE_ALT_SCREEN}${CLEAR_SCREEN}${CURSOR_HOME}${HIDE_CURSOR}`,
		);
		return;
	}

	process.stdout.write(`${SHOW_CURSOR}${DISABLE_ALT_SCREEN}`);
};

const activateTerminalMode = () => {
	if (!supportsFullScreenTerminal()) {
		return false;
	}

	let isActive = true;
	setFullScreenState(true);

	const restore = () => {
		if (!isActive) {
			return;
		}

		isActive = false;
		setFullScreenState(false);
	};

	process.once('exit', restore);
	process.once('SIGINT', () => {
		restore();
		process.exit(130);
	});
	process.once('SIGTERM', () => {
		restore();
		process.exit(143);
	});

	return true;
};

const computeFileSwitchPanelRows = (entryCount) => {
	const totalEntries = Math.max(0, entryCount);
	const visibleEntries = Math.min(
		FILE_SWITCH_MAX_VISIBLE_ENTRIES,
		totalEntries,
	);
	const hasOverflow = totalEntries > visibleEntries;

	return FILE_SWITCH_PANEL_BASE_ROWS + visibleEntries + (hasOverflow ? 1 : 0);
};

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
			},
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
	const configuredCommand = String(
		process.env[environmentVariableName] || '',
	).trim();
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

	const mainPath =
		String(mainConfigPath || '').trim() ||
		path.resolve(process.cwd(), '.codex', 'config.toml');
	const mainDirectory = path.dirname(mainPath);

	return path.resolve(mainDirectory, normalizedValue);
};

const getVersionCommands = () => ({
	codexCommand: getConfiguredCommand(CODEX_BIN_ENV_VAR, 'codex'),
	npmCommand: getConfiguredCommand(NPM_BIN_ENV_VAR, 'npm'),
});

const getLatestPackageVersion = async (npmCommand, packageName) => {
	const latestOutput = await runCommand(npmCommand, [
		'view',
		packageName,
		'version',
		'--json',
	]);
	return normalizeVersion(latestOutput) || latestOutput.trim();
};

const updateGlobalPackageToLatest = async (npmCommand, packageName) => {
	const result = await runCommandWithResult(
		npmCommand,
		['install', '-g', `${packageName}@latest`],
		{
			timeout: UPDATE_COMMAND_TIMEOUT_MS,
			maxBuffer: UPDATE_MAX_BUFFER_BYTES,
		},
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
	const match = String(value || '').match(
		/(\d+\.\d+\.\d+(?:[-+._][0-9A-Za-z.-]+)*)/,
	);
	return match ? match[1] : '';
};

const parseVersion = (value) => {
	const normalized = normalizeVersion(value);
	const [core, ...suffixParts] = String(normalized || '').split(/[-+]/);
	const suffix = suffixParts.join('-');
	const coreParts = core
		.split('.')
		.map((part) => Number.parseInt(part, 10))
		.filter(Number.isFinite);

	return {
		hasSuffix: Boolean(suffix),
		suffix,
		parts: coreParts,
	};
};

const comparePreRelease = (leftSuffix, rightSuffix) => {
	const leftParts = String(leftSuffix || '')
		.split('.')
		.filter(Boolean);
	const rightParts = String(rightSuffix || '')
		.split('.')
		.filter(Boolean);
	const maxLength = Math.max(leftParts.length, rightParts.length);

	for (let index = 0; index < maxLength; index += 1) {
		const leftPart = leftParts[index];
		const rightPart = rightParts[index];
		const leftNumber = Number.parseInt(leftPart, 10);
		const rightNumber = Number.parseInt(rightPart, 10);

		const leftIsNumber = Number.isFinite(leftNumber);
		const rightIsNumber = Number.isFinite(rightNumber);

		if (leftIsNumber && rightIsNumber) {
			if (leftNumber > rightNumber) {
				return 1;
			}

			if (leftNumber < rightNumber) {
				return -1;
			}

			continue;
		}

		if (leftIsNumber && !rightIsNumber) {
			return -1;
		}

		if (!leftIsNumber && rightIsNumber) {
			return 1;
		}

		if ((leftPart || '') > (rightPart || '')) {
			return 1;
		}

		if ((leftPart || '') < (rightPart || '')) {
			return -1;
		}
	}

	return 0;
};

const compareVersions = (left, right) => {
	const leftVersion = parseVersion(left);
	const rightVersion = parseVersion(right);
	const leftParts = leftVersion.parts;
	const rightParts = rightVersion.parts;
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

	if (leftVersion.hasSuffix !== rightVersion.hasSuffix) {
		return leftVersion.hasSuffix ? -1 : 1;
	}

	if (leftVersion.hasSuffix) {
		return comparePreRelease(leftVersion.suffix, rightVersion.suffix);
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
			status: `update available: ${latest}`,
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

	const latest = await getLatestPackageVersion(
		npmCommand,
		CONFIGURATOR_PACKAGE_NAME,
	);
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
	const defaultTerminalWidth = 100;
	const defaultTerminalHeight = 24;
	const [terminalSize, setTerminalSize] = useState({
		width: stdout?.columns || defaultTerminalWidth,
		height: stdout?.rows || defaultTerminalHeight,
	});
	const terminalWidth = terminalSize.width || defaultTerminalWidth;
	const terminalHeight = terminalSize.height || defaultTerminalHeight;

	useEffect(() => {
		const handleResize = () => {
			const nextWidth = process.stdout?.columns || defaultTerminalWidth;
			const nextHeight = process.stdout?.rows || defaultTerminalHeight;
			setTerminalSize({
				width: nextWidth,
				height: nextHeight,
			});
		};

		process.stdout?.on('resize', handleResize);
		return () => {
			process.stdout?.off('resize', handleResize);
		};
	}, []);

	const [state, dispatch] = useReducer(
		appStateReducer,
		buildInitialAppState(
			initialMainSnapshot,
			initialCatalog,
			initialActiveFileId,
		),
	);
	const commandModeLockRef = useRef(false);
	const commandInputRef = useRef('');
	const setAppState = (key, valueOrUpdater) =>
		dispatch({
			type: APP_STATE_ACTION,
			payload: { key, valueOrUpdater },
		});
	const setStateBatch = (updates) =>
		dispatch({ type: APP_STATE_ACTION, payload: { updates } });

	const setSnapshot = (valueOrUpdater) =>
		setAppState('snapshot', valueOrUpdater);
	const setSnapshotByFileId = (valueOrUpdater) =>
		setAppState('snapshotByFileId', valueOrUpdater);
	const setConfigFileCatalog = (valueOrUpdater) =>
		setAppState('configFileCatalog', valueOrUpdater);
	const setSelectedIndex = (valueOrUpdater) =>
		setAppState('selectedIndex', valueOrUpdater);
	const setScrollOffset = (valueOrUpdater) =>
		setAppState('scrollOffset', valueOrUpdater);
	const setEditMode = (valueOrUpdater) =>
		setAppState('editMode', valueOrUpdater);
	const setFileSwitchIndex = (valueOrUpdater) =>
		setAppState('fileSwitchIndex', valueOrUpdater);
	const setEditError = (valueOrUpdater) =>
		setAppState('editError', valueOrUpdater);
	const setCommandMode = (valueOrUpdater) => {
		const nextValue =
			typeof valueOrUpdater === 'function'
				? Boolean(valueOrUpdater(isCommandMode))
				: Boolean(valueOrUpdater);
		commandModeLockRef.current = nextValue;
		setAppState('isCommandMode', nextValue);
	};
	const setCommandInput = (valueOrUpdater) => {
		const previous = String(commandInputRef.current || '');
		const resolved =
			typeof valueOrUpdater === 'function'
				? valueOrUpdater(previous)
				: valueOrUpdater;
		const next = String(resolved ?? '');
		commandInputRef.current = next;
		setAppState('commandInput', next);
	};
	const setCommandMessage = (valueOrUpdater) =>
		setAppState('commandMessage', valueOrUpdater);
	const setShowHelp = (valueOrUpdater) =>
		setAppState('showHelp', valueOrUpdater);
	const setFilterQuery = (valueOrUpdater) =>
		setAppState('filterQuery', valueOrUpdater);
	const setIsFilterEditing = (valueOrUpdater) =>
		setAppState('isFilterEditing', valueOrUpdater);
	const setCodexVersion = (valueOrUpdater) =>
		setAppState('codexVersion', valueOrUpdater);
	const setCodexVersionStatus = (valueOrUpdater) =>
		setAppState('codexVersionStatus', valueOrUpdater);
	const {
		snapshot,
		snapshotByFileId,
		configFileCatalog,
		activeConfigFileId,
		pathSegments,
		selectedIndex,
		selectionByPath,
		scrollOffset,
		editMode,
		isFileSwitchMode,
		fileSwitchIndex,
		editError,
		filterQuery,
		isFilterEditing,
		isCommandMode,
		commandInput,
		commandMessage,
		showHelp,
		codexVersion,
		codexVersionStatus,
	} = state;
	commandInputRef.current = String(commandInput || '');
	const { exit } = useApp();
	const appMode = isFilterEditing
		? APP_MODES.FILTER
		: isCommandMode
			? APP_MODES.COMMAND
			: isFileSwitchMode
				? APP_MODES.FILE_SWITCH
				: editMode
					? APP_MODES.EDIT
					: APP_MODES.BROWSE;

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
		const hasActiveFile = configFileCatalog.some(
			(file) => file.id === activeConfigFileId,
		);
		if (hasActiveFile) {
			return;
		}

		const fallbackFile = configFileCatalog[0];
		if (!fallbackFile) {
			return;
		}

		const fallbackSnapshot =
			snapshotByFileId[fallbackFile.id] ||
			(fallbackFile.kind === 'agent'
				? ensureConfigFileExists(fallbackFile.path)
				: readConfig(fallbackFile.path));
		setStateBatch({
			activeConfigFileId: fallbackFile.id,
			snapshotByFileId: {
				...snapshotByFileId,
				...(snapshotByFileId[fallbackFile.id]
					? {}
					: {
							[fallbackFile.id]: fallbackSnapshot,
						}),
			},
			snapshot: fallbackSnapshot,
			pathSegments: [],
			selectedIndex: 0,
			selectionByPath: {},
			scrollOffset: 0,
		});
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

	const activeConfigFile =
		configFileCatalog.find((file) => file.id === activeConfigFileId) ||
		configFileCatalog[0];
	const activeConfigFilePath = activeConfigFile?.path || snapshot.path;
	const readActiveConfigSnapshot = () => {
		const activeEntry = resolveActiveFileEntry();
		const targetPath = activeEntry?.path || activeConfigFilePath;

		if (!activeEntry || activeEntry.kind !== 'agent') {
			return readConfig(targetPath);
		}

		return ensureConfigFileExists(targetPath);
	};

	const currentNode = getNodeAtPath(
		snapshot.ok ? snapshot.data : {},
		pathSegments,
	);
	const allRows = buildRows(currentNode, pathSegments);
	const rows = filterRowsByQuery(allRows, filterQuery);
	const safeSelected =
		rows.length === 0 ? 0 : Math.min(selectedIndex, rows.length - 1);
	const fileSwitchPanelExtraRows =
		isInteractive && isFileSwitchMode
			? computeFileSwitchPanelRows(configFileCatalog.length) +
				FILE_SWITCH_LAYOUT_EXTRA_GAP_ROWS
			: 0;
	const listViewportHeight = computeListViewportRows({
		terminalHeight,
		terminalWidth,
		activeConfigFile,
		packageVersion: PACKAGE_VERSION,
		codexVersion,
		codexVersionStatus,
		isInteractive,
		isCommandMode,
		extraChromeRows: fileSwitchPanelExtraRows,
	});
	const currentPathKey = `${activeConfigFileId}::${pathToKey(pathSegments)}`;

	const getSavedIndex = (segments, fallback = 0) => {
		const key = `${activeConfigFileId}::${pathToKey(segments)}`;
		const maybe = selectionByPath[key];

		if (Number.isInteger(maybe)) {
			return maybe;
		}

		return fallback;
	};

	const adjustScrollForSelection = (
		nextSelection,
		nextViewportHeight,
		totalRows,
	) => {
		const maxOffset = Math.max(0, totalRows - nextViewportHeight);
		const minOffset = 0;

		setScrollOffset((previous) => {
			if (nextSelection < previous) {
				return clamp(nextSelection, minOffset, maxOffset);
			}

			if (nextSelection > previous + nextViewportHeight - 1) {
				return clamp(
					nextSelection - nextViewportHeight + 1,
					minOffset,
					maxOffset,
				);
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

		const isAgentConfigFilePath =
			Array.isArray(editedPath) &&
			editedPath.length === 3 &&
			editedPath[0] === 'agents' &&
			editedPath[2] === 'config_file';
		if (!isAgentConfigFilePath) {
			return true;
		}

		const configFileValue = getNodeAtPath(nextData, editedPath);
		if (typeof configFileValue !== 'string' || !configFileValue.trim()) {
			return true;
		}

		const normalizedTarget = resolveAgentConfigFilePath(
			activeConfigFile?.path || snapshot.path,
			configFileValue,
		);
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
			[`agent:${normalizedTarget}`]:
				previous[`agent:${normalizedTarget}`] || ensureResult,
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
		const nextFile = configFileCatalog.find(
			(file) => file.id === nextFileId,
		);
		if (!nextFile) {
			return;
		}

		const nextSnapshot =
			snapshotByFileId[nextFileId] ||
			(nextFile.kind === 'agent'
				? ensureConfigFileExists(nextFile.path)
				: readConfig(nextFile.path));
		if (!snapshotByFileId[nextFileId]) {
			setSnapshotByFileId((previous) => ({
				...previous,
				[nextFileId]: nextSnapshot,
			}));
		}

		if (nextFileId === activeConfigFileId) {
			return;
		}

		setStateBatch({
			activeConfigFileId: nextFileId,
			snapshot: nextSnapshot,
			pathSegments: [],
			selectedIndex: 0,
			scrollOffset: 0,
			editMode: null,
			isFileSwitchMode: false,
			editError: '',
		});
	};

	const beginEditing = (target, targetPath) => {
		const options =
			getConfigOptions(
				targetPath,
				target.key,
				target.value,
				target.kind,
			) || [];
		if (options.length === 0) {
			return;
		}

		setEditError('');
		setEditMode({
			mode: 'select',
			path: targetPath,
			options,
			selectedOptionIndex: clamp(
				options.findIndex((option) => Object.is(option, target.value)),
				0,
				options.length - 1,
			),
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
					(option) =>
						option.kind === 'object' &&
						objectMatchesVariant(target.value, option),
				)
			: variantOptions.findIndex(
					(option) =>
						option.kind === 'scalar' &&
						Object.is(option.value, String(target.value)),
				);
		const selectedOptionIndex =
			currentVariantIndex >= 0 ? currentVariantIndex : 0;

		setEditError('');
		setEditMode({
			mode: 'variant-select',
			key: target.key,
			path: targetPath,
			options: variantOptions.map((option) => option.label),
			variantOptions,
			selectedOptionIndex: clamp(
				selectedOptionIndex,
				0,
				variantOptions.length - 1,
			),
			savedOptionIndex: null,
		});
	};

	const openPathView = (nextPath, nextData) => {
		const data =
			typeof nextData === 'undefined'
				? snapshot.ok
					? snapshot.data
					: {}
				: nextData;
		const nextNode = getNodeAtPath(data, nextPath);
		const nextRows = buildRows(nextNode, nextPath);
		const nextViewportHeight = computeListViewportRows({
			terminalHeight,
			terminalWidth,
			activeConfigFile,
			packageVersion: PACKAGE_VERSION,
			codexVersion,
			codexVersionStatus,
			isInteractive,
			isCommandMode,
			extraChromeRows: fileSwitchPanelExtraRows,
		});
		const nextSavedIndex = getSavedIndex(nextPath, 0);
		const nextSelected =
			nextRows.length === 0
				? 0
				: clamp(nextSavedIndex, 0, nextRows.length - 1);

		setStateBatch({
			selectionByPath: {
				...selectionByPath,
				[currentPathKey]: safeSelected,
			},
			pathSegments: nextPath,
			selectedIndex: nextSelected,
			scrollOffset: clamp(
				nextSelected,
				0,
				Math.max(0, nextRows.length - nextViewportHeight),
			),
		});
	};

	const applyEdit = () => {
		if (!editMode || editMode.mode !== 'select') {
			return;
		}

		const nextIndex = editMode.selectedOptionIndex;
		const nextValue = editMode.options[nextIndex];
		const nextData = setValueAtPath(
			snapshot.ok ? snapshot.data : {},
			editMode.path,
			nextValue,
		);
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

		const nextData = setValueAtPath(
			snapshot.ok ? snapshot.data : {},
			editMode.path,
			editMode.draftValue,
		);
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
				const requiredOptions =
					getConfigOptions(
						requiredPath,
						requiredKey,
						undefined,
						'value',
					) || [];
				if (requiredOptions.length > 0) {
					return requiredOptions[0];
				}

				if (
					isStringReferenceType(
						getReferenceOptionForPath(requiredPath)?.type,
					)
				) {
					return '';
				}

				return {};
			},
		});

		const shouldPersistSelection =
			selectionResult.changed &&
			(!selectionResult.isObjectSelection ||
				selectionResult.isObjectVariantSwitch);
		let nextData = data;
		if (shouldPersistSelection) {
			nextData = setValueAtPath(
				data,
				editMode.path,
				selectionResult.nextValue,
			);
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
					selectedVariant.kind === 'object' &&
					selectedVariant.requiredKeys.length === 1
						? selectedVariant.requiredKeys[0]
						: null,
			});
			openPathView(nextPath, nextData);
		}

		setEditError('');
		setEditMode(null);
	};

	const reloadActiveConfig = () => {
		const nextSnapshot = readActiveConfigSnapshot();
		updateActiveSnapshot(nextSnapshot);
		setStateBatch({
			pathSegments: [],
			selectedIndex: 0,
			selectionByPath: {},
			scrollOffset: 0,
			editMode: null,
			editError: '',
		});

		if (activeConfigFileId === MAIN_CONFIG_FILE_ID) {
			refreshConfigFileCatalog(nextSnapshot);
		}
	};

	const beginFileSwitchMode = () => {
		if (
			!Array.isArray(configFileCatalog) ||
			configFileCatalog.length === 0
		) {
			return;
		}

		if (configFileCatalog.length === 1) {
			return;
		}

		setStateBatch({
			editError: '',
			isFileSwitchMode: true,
			fileSwitchIndex: Math.max(
				0,
				configFileCatalog.findIndex(
					(file) => file.id === activeConfigFileId,
				),
			),
		});
	};

	const applyFileSwitch = () => {
		if (!isFileSwitchMode) {
			return;
		}

		const nextFile = configFileCatalog[fileSwitchIndex];
		if (!nextFile) {
			setStateBatch({ isFileSwitchMode: false, editError: '' });
			return;
		}

		switchConfigFile(nextFile.id);
		setStateBatch({ isFileSwitchMode: false, editError: '' });
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
		const hasConfiguredValue =
			typeof getNodeAtPath(data, targetPath) !== 'undefined';

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

	useInput(
		(input, key) => {
			const commandHandled = executeInputCommand({
				input,
				key,
				context: {
					appMode,
					isFilterEditing,
					isFileSwitchMode,
					isCommandMode,
					isCommandModeLocked: commandModeLockRef.current,
					activeConfigFileId,
					rows,
					safeSelected,
					editMode,
					listViewportHeight,
					pathSegments,
					snapshot,
					currentNode,
					terminalHeight,
					selectionByPath,
					configFileCatalog,
					fileSwitchIndex,
					currentPathKey,
					clamp,
					setEditMode,
					setFileSwitchIndex,
					setIsFilterEditing,
					setFilterQuery,
					setShowHelp,
					setStateBatch,
					setSelectedIndex,
					setCommandMode,
					setCommandInput,
					getCommandInput: () => commandInputRef.current,
					setCommandMessage,
					setEditError,
					beginAddIdEditing,
					beginTextEditing,
					beginVariantEditing,
					beginEditing,
					beginFileSwitchMode,
					applyFileSwitch,
					applyTextEdit,
					applyAddId,
					applyVariantEdit,
					applyEdit,
					applyBooleanToggle,
					unsetValueAtPath,
					openPathView,
					reloadActiveConfig,
					getConfigOptions: getConfigOptions,
					getConfigVariantMeta,
					getNodeAtPath,
					buildRows,
					isStringField,
					isCustomIdTableRow,
					resolveMixedVariantBackNavigationPath,
					adjustScrollForSelection,
					getSavedIndex,
					readActiveConfigSnapshot,
					refreshConfigFileCatalog,
					exit,
				},
			});

			if (commandHandled) {
				return;
			}
		},
		{ isActive: isInteractive },
	);

	useEffect(() => {
		const maxOffset = Math.max(0, rows.length - listViewportHeight);
		setScrollOffset((previous) => clamp(previous, 0, maxOffset));
	}, [rows.length, listViewportHeight]);

	const renderFileSwitchPanel = () => {
		if (!isFileSwitchMode || configFileCatalog.length === 0) {
			return null;
		}

		const totalEntries = configFileCatalog.length;
		const visibleEntries = Math.min(
			FILE_SWITCH_MAX_VISIBLE_ENTRIES,
			totalEntries,
		);
		const maxStartIndex = Math.max(0, totalEntries - visibleEntries);
		const startIndex = clamp(
			fileSwitchIndex - Math.floor(visibleEntries / 2),
			0,
			maxStartIndex,
		);
		const endIndex = Math.min(totalEntries, startIndex + visibleEntries);
		const visibleFiles = configFileCatalog.slice(startIndex, endIndex);
		const hasOverflow = totalEntries > visibleEntries;

		return React.createElement(
			Box,
			{
				borderStyle: 'round',
				borderColor: 'cyan',
				paddingX: 1,
				flexDirection: 'column',
			},
			React.createElement(
				Text,
				{ bold: true, color: 'cyan' },
				'File Switch',
			),
			...visibleFiles.map((file, offsetIndex) => {
				const index = startIndex + offsetIndex;
				const isSelected = index === fileSwitchIndex;
				const isActiveFile = file.id === activeConfigFileId;
				const fileLabel = `${file.label} (${file.kind === 'main' ? 'main' : 'agent'})`;
				return React.createElement(
					Text,
					{
						key: file.id,
						color: isSelected
							? 'yellow'
							: isActiveFile
								? 'green'
								: 'gray',
						bold: isSelected,
						wrap: 'truncate-end',
					},
					`${isSelected ? '› ' : '  '}${fileLabel}${isActiveFile ? ' [active]' : ''}`,
				);
			}),
			hasOverflow
				? React.createElement(
						Text,
						{
							color: 'gray',
							wrap: 'truncate-end',
							key: 'file-switch-window',
						},
						`Showing ${startIndex + 1}-${endIndex} of ${totalEntries}`,
					)
				: null,
		);
	};

	const commandModeHint = getModeHint({
		appMode,
		isCommandMode,
	});

	if (!isInteractive) {
		return React.createElement(
			Box,
			{ flexDirection: 'column', padding: 1 },
			React.createElement(Header, {
				packageVersion: PACKAGE_VERSION,
				terminalWidth,
			}),
			React.createElement(ConfigNavigator, {
				snapshot,
				pathSegments,
				selectedIndex: 0,
				terminalWidth,
				listViewportHeight,
				scrollOffset: 0,
				editMode: null,
				editError: editError,
				filterQuery,
				isFilterEditing,
				activeConfigFile: activeConfigFile,
			}),
			React.createElement(
				Text,
				{ color: 'yellow' },
				'Non-interactive mode: input is disabled.',
			),
		);
	}

	return React.createElement(
		LayoutShell,
		null,
		React.createElement(Header, {
			packageVersion: PACKAGE_VERSION,
			terminalWidth,
		}),
		React.createElement(ConfigNavigator, {
			snapshot,
			pathSegments,
			selectedIndex: safeSelected,
			terminalWidth,
			listViewportHeight,
			scrollOffset,
			editMode,
			editError,
			filterQuery,
			isFilterEditing,
			activeConfigFile: activeConfigFile,
		}),
		renderFileSwitchPanel(),
		React.createElement(CommandBar, {
			appMode,
			isCommandMode,
			commandInput,
			commandMessage,
			modeHint: commandModeHint,
		}),
		React.createElement(StatusLine, {
			codexVersion,
			codexVersionStatus,
			activeConfigFile,
			appMode,
		}),
		showHelp
			? React.createElement(
					Box,
					{
						position: 'absolute',
						bottom: 3,
						left: 0,
						right: 0,
						marginTop: 0,
						zIndex: 1,
					},
					React.createElement(HelpBubble, { appMode }),
				)
			: null,
	);
};

activateTerminalMode();
render(React.createElement(App));
