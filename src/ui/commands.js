import {
	isBackspaceKey,
	isDeleteKey,
	isEndKey,
	isHomeKey,
	isPageDownKey,
	isPageUpKey,
} from '../interaction.js';
import {
	COMMAND_HINT,
	COMMAND_INPUT_HINT,
	CONTROL_HINT,
	EDIT_CONTROL_HINT,
	FILE_SWITCH_HINT,
	FILTER_CONTROL_HINT,
} from '../constants.js';

const isInlineTextMode = (mode) => mode === 'text' || mode === 'add-id';

const isBooleanOnlyOptions = (options) =>
	Array.isArray(options) &&
	options.length === 2 &&
	options.every((option) => typeof option === 'boolean') &&
	options.includes(false) &&
	options.includes(true);

const readCommand = (value) =>
	String(value || '')
		.trim()
		.toLowerCase();

const readCommandInput = (context) =>
	typeof context.getCommandInput === 'function'
		? String(context.getCommandInput() || '')
		: String(context.commandInput || '');

const isArrowKey = (key) =>
	key.rightArrow || key.leftArrow || key.upArrow || key.downArrow;

const isNamedArrowKey = (key) =>
	key.name === 'right' ||
	key.name === 'left' ||
	key.name === 'up' ||
	key.name === 'down';

const isNamedPageOrBoundaryKey = (key) =>
	key.name === 'pageup' ||
	key.name === 'page-up' ||
	key.name === 'pagedown' ||
	key.name === 'page-down' ||
	key.name === 'home' ||
	key.name === 'end';

const isTerminalEscapeInput = (input) =>
	typeof input === 'string' && input.startsWith('\u001b');

const isCommandNavigationCaptureKey = (input, key) =>
	isArrowKey(key) ||
	isNamedArrowKey(key) ||
	isPageUpKey(input, key) ||
	isPageDownKey(input, key) ||
	isHomeKey(input, key) ||
	isEndKey(input, key) ||
	isNamedPageOrBoundaryKey(key) ||
	isTerminalEscapeInput(input);

const clearInlineEditState = (context) => {
	context.setEditMode(null);
	context.setEditError('');
};

const isUnsetShortcut = (input, key) =>
	isDeleteKey(input, key) ||
	isBackspaceKey(input, key) ||
	(key.ctrl && key.name === 'd');

const runCommand = (context, rawInput) => {
	const commandInput =
		typeof rawInput === 'string' ? rawInput : readCommandInput(context);
	const command = readCommand(commandInput).replace(/^:/, '');

	if (!command) {
		return false;
	}

	if (command === 'q' || command === 'quit' || command === 'exit') {
		context.exit();
		return true;
	}

	if (command === 'file' || command === 'switch') {
		context.beginFileSwitchMode();
		return true;
	}

	if (command === 'filter') {
		context.setIsFilterEditing(true);
		return true;
	}

	if (command === 'reload') {
		context.reloadActiveConfig();
		return true;
	}

	context.setCommandMessage(`Unknown command: ${commandInput || ':'}`);
	return false;
};

const navigateToParentPath = ({
	context,
	pathSegments,
	snapshot,
	safeSelected,
}) => {
	if (pathSegments.length === 0) {
		return true;
	}

	const fallbackParentPath = pathSegments.slice(0, -1);
	const backTargetPath =
		context.resolveMixedVariantBackNavigationPath({
			pathSegments,
			resolveVariantMeta: context.getConfigVariantMeta,
		}) || fallbackParentPath;
	const parentNode = context.getNodeAtPath(
		snapshot.ok ? snapshot.data : {},
		backTargetPath,
	);
	const parentRows = context.buildRows(parentNode, backTargetPath);
	const savedIndex = context.getSavedIndex(backTargetPath, 0);
	const parentViewportHeight = context.listViewportHeight;
	const parentSelected =
		parentRows.length === 0
			? 0
			: context.clamp(savedIndex, 0, parentRows.length - 1);

	context.setStateBatch({
		pathSegments: backTargetPath,
		selectionByPath: {
			...context.selectionByPath,
			[context.currentPathKey]: safeSelected,
		},
		selectedIndex: parentSelected,
		scrollOffset: context.clamp(
			parentSelected,
			0,
			Math.max(0, parentRows.length - parentViewportHeight),
		),
		editMode: null,
		editError: '',
	});

	return true;
};

const unsetSelectedValue = ({
	context,
	rows,
	safeSelected,
	pathSegments,
	currentNode,
}) => {
	if (!rows[safeSelected]) {
		return false;
	}

	const target = rows[safeSelected];
	const isValueRow = target.kind === 'value';
	const isCustomIdRow = context.isCustomIdTableRow(pathSegments, target);
	const isInsideArray = Array.isArray(currentNode);

	if ((!isValueRow && !isCustomIdRow) || isInsideArray) {
		return true;
	}

	const targetPath = [...pathSegments, target.pathSegment];
	context.unsetValueAtPath(targetPath);
	return true;
};

export const getModeHint = ({ appMode, isCommandMode }) => {
	if (isCommandMode) {
		return COMMAND_INPUT_HINT;
	}

	if (appMode === 'filter') {
		return FILTER_CONTROL_HINT;
	}

	if (appMode === 'file-switch') {
		return FILE_SWITCH_HINT;
	}

	if (appMode === 'edit') {
		return EDIT_CONTROL_HINT;
	}

	return `${CONTROL_HINT} • ${COMMAND_HINT}`;
};

export const executeInputCommand = ({ input, key, context }) => {
	const {
		isFilterEditing,
		isFileSwitchMode,
		isCommandMode,
		isCommandModeLocked,
		rows = [],
		safeSelected,
		editMode,
		listViewportHeight,
		pathSegments,
		currentNode,
		snapshot,
		configFileCatalog,
	} = context;

	const isTextEditing = isInlineTextMode(editMode?.mode);
	const isCapturingCommand = isCommandModeLocked || isCommandMode;

	if (isCapturingCommand) {
		if (key.escape) {
			context.setCommandMode(false);
			context.setCommandInput('');
			context.setCommandMessage('');
			return true;
		}

		if (key.return) {
			const latestCommandInput = readCommandInput(context);
			const handled = runCommand(context, latestCommandInput);
			if (handled || latestCommandInput === ':') {
				context.setCommandMode(false);
				context.setCommandInput('');
			}

			return true;
		}

		const clearCommandInput = () =>
			context.setCommandInput((previous) => {
				const next = String(previous || ':').slice(0, -1);
				return next.length === 0 ? ':' : next;
			});

		if (
			isBackspaceKey(input, key) ||
			(key.ctrl && key.name === 'h') ||
			isDeleteKey(input, key)
		) {
			clearCommandInput();
			context.setCommandMessage('');
			return true;
		}

		if (isCommandNavigationCaptureKey(input, key)) {
			return true;
		}

		if (!key.ctrl && !key.meta && input.length > 0) {
			context.setCommandInput((previous) => `${previous}${input}`);
			context.setCommandMessage('');
		}

		return true;
	}

	if (isFilterEditing) {
		if (key.return || key.escape) {
			context.setIsFilterEditing(false);
			return true;
		}

		if ((key.ctrl && key.name === 'u') || input === '\u0015') {
			context.setFilterQuery('');
			return true;
		}

		if (isDeleteKey(input, key) || isBackspaceKey(input, key)) {
			context.setFilterQuery((previous) => previous.slice(0, -1));
			return true;
		}

		if (
			isArrowKey(key) ||
			isPageUpKey(input, key) ||
			isPageDownKey(input, key) ||
			isHomeKey(input, key) ||
			isEndKey(input, key)
		) {
			return true;
		}

		if (!key.ctrl && !key.meta && input.length > 0) {
			context.setFilterQuery((previous) => `${previous}${input}`);
		}

		return true;
	}

	if (isFileSwitchMode) {
		if (key.upArrow) {
			context.setFileSwitchIndex((previous) =>
				context.clamp(previous - 1, 0, configFileCatalog.length - 1),
			);
			return true;
		}

		if (key.downArrow) {
			context.setFileSwitchIndex((previous) =>
				context.clamp(previous + 1, 0, configFileCatalog.length - 1),
			);
			return true;
		}

		if (isPageUpKey(input, key)) {
			context.setFileSwitchIndex((previous) =>
				context.clamp(
					previous - listViewportHeight,
					0,
					configFileCatalog.length - 1,
				),
			);
			return true;
		}

		if (isPageDownKey(input, key)) {
			context.setFileSwitchIndex((previous) =>
				context.clamp(
					previous + listViewportHeight,
					0,
					configFileCatalog.length - 1,
				),
			);
			return true;
		}

		if (isHomeKey(input, key)) {
			context.setFileSwitchIndex(0);
			return true;
		}

		if (isEndKey(input, key)) {
			context.setFileSwitchIndex(
				Math.max(0, configFileCatalog.length - 1),
			);
			return true;
		}

		if (key.return) {
			context.applyFileSwitch();
			return true;
		}

		if (key.escape || isBackspaceKey(input, key) || key.leftArrow) {
			context.setStateBatch({
				isFileSwitchMode: false,
				fileSwitchIndex: Math.max(
					0,
					configFileCatalog.findIndex(
						(file) => file.id === context.activeConfigFileId,
					),
				),
				editError: '',
			});
			return true;
		}

		if (isDeleteKey(input, key)) {
			return true;
		}

		return true;
	}

	if (input === ':') {
		context.setCommandMode(true);
		context.setCommandInput(':');
		context.setCommandMessage('');
		context.setShowHelp(false);
		return true;
	}

	if (editMode) {
		if (isTextEditing) {
			if (key.return) {
				if (editMode.mode === 'text') {
					context.applyTextEdit();
					return true;
				}

				context.applyAddId();
				return true;
			}

			if (key.escape) {
				clearInlineEditState(context);
				return true;
			}

			if (key.leftArrow || isBackspaceKey(input, key)) {
				clearInlineEditState(context);
				return true;
			}

			if (isDeleteKey(input, key)) {
				context.setEditMode((previous) => ({
					...previous,
					draftValue: previous.draftValue.slice(0, -1),
				}));
				return true;
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
				return true;
			}

			if (!key.ctrl && !key.meta && input.length > 0) {
				context.setEditMode((previous) => ({
					...previous,
					draftValue: `${previous.draftValue}${input}`,
				}));
			}

			return true;
		}

		if (key.upArrow) {
			context.setEditMode((previous) => ({
				...previous,
				selectedOptionIndex: context.clamp(
					previous.selectedOptionIndex - 1,
					0,
					previous.options.length - 1,
				),
			}));
			return true;
		}

		if (key.downArrow) {
			context.setEditMode((previous) => ({
				...previous,
				selectedOptionIndex: context.clamp(
					previous.selectedOptionIndex + 1,
					0,
					previous.options.length - 1,
				),
			}));
			return true;
		}

		if (isPageUpKey(input, key)) {
			context.setEditMode((previous) => ({
				...previous,
				selectedOptionIndex: context.clamp(
					previous.selectedOptionIndex - listViewportHeight,
					0,
					previous.options.length - 1,
				),
			}));
			return true;
		}

		if (isPageDownKey(input, key)) {
			context.setEditMode((previous) => ({
				...previous,
				selectedOptionIndex: context.clamp(
					previous.selectedOptionIndex + listViewportHeight,
					0,
					previous.options.length - 1,
				),
			}));
			return true;
		}

		if (isHomeKey(input, key)) {
			context.setEditMode((previous) => ({
				...previous,
				selectedOptionIndex: 0,
			}));
			return true;
		}

		if (isEndKey(input, key)) {
			context.setEditMode((previous) => ({
				...previous,
				selectedOptionIndex: Math.max(0, previous.options.length - 1),
			}));
			return true;
		}

		if (key.return) {
			if (editMode.mode === 'variant-select') {
				context.applyVariantEdit();
				return true;
			}

			context.applyEdit();
			return true;
		}

		if (key.leftArrow || isBackspaceKey(input, key)) {
			clearInlineEditState(context);
			return true;
		}

		if (isDeleteKey(input, key)) {
			return true;
		}

		if (key.escape) {
			clearInlineEditState(context);
			return true;
		}

		return true;
	}

	if (key.upArrow) {
		if (rows.length === 0) {
			return true;
		}

		context.setSelectedIndex((previous) => {
			const next = Math.max(previous - 1, 0);
			context.adjustScrollForSelection(
				next,
				listViewportHeight,
				rows.length,
			);
			return next;
		});
		return true;
	}

	if (key.downArrow) {
		if (rows.length === 0) {
			return true;
		}

		context.setSelectedIndex((previous) => {
			const next = Math.min(previous + 1, rows.length - 1);
			context.adjustScrollForSelection(
				next,
				listViewportHeight,
				rows.length,
			);
			return next;
		});
		return true;
	}

	if (isPageUpKey(input, key)) {
		if (rows.length === 0) {
			return true;
		}

		context.setSelectedIndex((previous) => {
			const next = Math.max(previous - listViewportHeight, 0);
			context.adjustScrollForSelection(
				next,
				listViewportHeight,
				rows.length,
			);
			return next;
		});
		return true;
	}

	if (isPageDownKey(input, key)) {
		if (rows.length === 0) {
			return true;
		}

		context.setSelectedIndex((previous) => {
			const next = Math.min(
				previous + listViewportHeight,
				rows.length - 1,
			);
			context.adjustScrollForSelection(
				next,
				listViewportHeight,
				rows.length,
			);
			return next;
		});
		return true;
	}

	if (isHomeKey(input, key)) {
		if (rows.length === 0) {
			return true;
		}

		context.setSelectedIndex(0);
		context.adjustScrollForSelection(0, listViewportHeight, rows.length);
		return true;
	}

	if (isEndKey(input, key)) {
		if (rows.length === 0) {
			return true;
		}

		const next = rows.length - 1;
		context.setSelectedIndex(next);
		context.adjustScrollForSelection(next, listViewportHeight, rows.length);
		return true;
	}

	if (key.return && rows[safeSelected]) {
		const target = rows[safeSelected];
		if (target.kind === 'action' && target.action === 'add-custom-id') {
			context.beginAddIdEditing(pathSegments, target.placeholder || 'id');
			return true;
		}

		const targetPath = [...pathSegments, target.pathSegment];
		const variantMeta =
			typeof target.pathSegment !== 'undefined' &&
			target.pathSegment !== null &&
			typeof target.key === 'string'
				? context.getConfigVariantMeta(pathSegments, target.key)
				: null;

		if (variantMeta?.kind === 'scalar_object') {
			context.beginVariantEditing(target, targetPath, variantMeta);
			return true;
		}

		if (target.kind === 'table' || target.kind === 'tableArray') {
			context.openPathView(targetPath);
			return true;
		}

		const options =
			context.getConfigOptions(
				targetPath,
				target.key,
				target.value,
				target.kind,
			) || [];
		if (
			typeof target.value === 'boolean' ||
			isBooleanOnlyOptions(options)
		) {
			context.applyBooleanToggle(
				typeof target.value === 'boolean'
					? target
					: {
							...target,
							value: false,
						},
				targetPath,
			);
			return true;
		}

		if (options.length > 0) {
			context.beginEditing(target, targetPath);
			return true;
		}

		if (context.isStringField(targetPath, target.value)) {
			context.beginTextEditing(target, targetPath);
		}

		return true;
	}

	if (key.leftArrow) {
		return navigateToParentPath({
			context,
			pathSegments,
			snapshot,
			safeSelected,
		});
	}

	if (isUnsetShortcut(input, key)) {
		return unsetSelectedValue({
			context,
			rows,
			safeSelected,
			pathSegments,
			currentNode,
		});
	}

	return false;
};
