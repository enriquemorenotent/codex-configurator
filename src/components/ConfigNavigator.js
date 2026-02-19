import React from 'react';
import { Text, Box } from 'ink';
import {
  getConfigHelp,
  getConfigOptions,
  getConfigOptionExplanation,
  getConfigDefaultOption,
} from '../configHelp.js';
import { computePaneWidths, clamp } from '../layout.js';
import { getNodeAtPath, buildRows } from '../configParser.js';

const MenuItem = ({ isSelected, isDimmed, isDeprecated, label }) =>
  React.createElement(
    Text,
    {
      bold: isSelected,
      color: isSelected ? 'yellow' : isDimmed ? 'gray' : 'white',
      dimColor: !isSelected && isDimmed,
    },
    label,
    isDeprecated ? React.createElement(Text, { color: 'yellow' }, ' [!]') : null
  );

const formatArrayItem = (value) => {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.length} item(s)]`;
  }

  if (Object.prototype.toString.call(value) === '[object Object]') {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return '{}';
    }

    return `{${keys.join(', ')}}`;
  }

  return String(value);
};

const formatOptionValue = (value) => {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'boolean' || value === null) {
    return String(value);
  }

  return String(value);
};

const truncate = (text, maxLength) =>
  text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 1))}…`;

const isBooleanOnlyOptions = (options) =>
  Array.isArray(options) &&
  options.length === 2 &&
  options.every((option) => typeof option === 'boolean') &&
  options.includes(false) &&
  options.includes(true);

const renderArrayDetails = (rows) => {
  const items = rows.slice(0, 5).map((item, index) =>
    React.createElement(Text, { key: `array-item-${index}` }, `  ${index + 1}. ${formatArrayItem(item)}`)
  );
  const overflow = rows.length - items.length;

  return React.createElement(
    React.Fragment,
    null,
    ...items,
    overflow > 0 ? React.createElement(Text, { key: 'array-more' }, `  … and ${overflow} more`) : null
  );
};

const renderTextEditor = (draftValue) =>
  React.createElement(
    React.Fragment,
    null,
    React.createElement(Text, { color: 'white' }, `> ${draftValue}`),
    React.createElement(Text, { color: 'gray' }, 'Type to edit • Enter: save • Esc: cancel')
  );

const renderIdEditor = (placeholder, draftValue) =>
  React.createElement(
    React.Fragment,
    null,
    React.createElement(Text, { color: 'white' }, `${placeholder || 'id'}: ${draftValue}`),
    React.createElement(Text, { color: 'gray' }, 'Type id • Enter: create • Esc: cancel')
  );

const formatSectionSummary = (row) => {
  if (row?.kind === 'table') {
    const entryCount =
      Object.prototype.toString.call(row?.value) === '[object Object]'
        ? Object.keys(row.value).length
        : 0;

    if (entryCount === 0) {
      return 'Empty section.';
    }

    return `Section with ${entryCount} configured ${entryCount === 1 ? 'entry' : 'entries'}.`;
  }

  if (row?.kind === 'tableArray') {
    const entryCount = Array.isArray(row?.value) ? row.value.length : 0;
    if (entryCount === 0) {
      return 'Section with no entries.';
    }

    return `Section list with ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}.`;
  }

  return 'This section groups related settings.';
};

const renderEditableOptions = (
  options,
  selectedOptionIndex,
  defaultOptionIndex,
  optionPathSegments,
  rowKey,
  savedOptionIndex = null,
  showCursor = false
) => {
  const optionRows = options.map((option, optionIndex) => {
    const optionValueText = formatOptionValue(option);
    const prefix = showCursor && optionIndex === selectedOptionIndex ? '▶ ' : '  ';
    const valueText = `${prefix}${optionValueText}`;
    const explanation = getConfigOptionExplanation(optionPathSegments, rowKey, option);
    const isDefault = optionIndex === defaultOptionIndex;
    const highlightDefault = selectedOptionIndex < 0 && isDefault;
    return { optionIndex, valueText, explanation, optionValueText, isDefault, highlightDefault };
  });

  const valueWidth = optionRows.reduce((max, item) => Math.max(max, item.valueText.length), 0);

  return React.createElement(
    React.Fragment,
    null,
    ...optionRows.map(
      ({ optionIndex, valueText, explanation, optionValueText, isDefault, highlightDefault }) =>
      React.createElement(
        Box,
        {
          key: `option-${rowKey}-${optionIndex}`,
          flexDirection: 'column',
        },
        React.createElement(
          Box,
          {
            flexDirection: 'row',
          },
          React.createElement(
            Text,
            {
              color: optionIndex === selectedOptionIndex
                ? 'yellow'
                : highlightDefault
                  ? 'whiteBright'
                  : 'white',
              bold: optionIndex === selectedOptionIndex || highlightDefault,
            },
            `${valueText.padEnd(valueWidth, ' ')}`
          ),
          explanation
            ? React.createElement(Text, { color: 'gray' }, `  — ${truncate(explanation, 100)}`)
            : null,
          isDefault
            ? React.createElement(Text, { color: 'cyan' }, '  [default]')
            : null
        ),
        savedOptionIndex === optionIndex
          ? React.createElement(Text, { color: 'green' }, `  Saved: ${optionValueText}`)
          : null
      )
    )
  );
};

const formatConfigHelp = (pathSegments, row) => {
  if (row?.kind === 'action' && row?.action === 'add-custom-id') {
    return [
      {
        text: `Create a new custom "${row.placeholder || 'id'}" entry in this section.`,
        color: 'white',
        bold: false,
        showWarningIcon: false,
      },
      {
        text: 'Press Enter to type the id, then Enter again to save.',
        color: 'gray',
        bold: false,
        showWarningIcon: false,
      },
    ];
  }

  const info = getConfigHelp(pathSegments, row.key);
  const isSectionRow = row.kind === 'table' || row.kind === 'tableArray';
  const defaultCollectionText =
    isSectionRow
      ? formatSectionSummary(row)
      : row.kind === 'array'
        ? `This is a list with ${row.value.length} entries.`
        : 'This setting affects Codex behavior.';
  const short = info?.short || defaultCollectionText;
  const usage = isSectionRow ? null : info?.usage;
  const isWarning = Boolean(info?.deprecation);
  const lines = [{ text: short, color: 'white', bold: false, showWarningIcon: false }];

  if (usage) {
    lines.push({
      text: isWarning ? usage.replace(/^\[!\]\s*/, '') : usage,
      color: 'gray',
      bold: false,
      showWarningIcon: isWarning,
    });
  }

  if (row?.key === 'approval_policy' && row?.value === 'on-failure') {
    lines.push({
      text: 'approval_policy = "on-failure" is deprecated; use "untrusted", "on-request", or "never".',
      color: 'gray',
      bold: false,
      showWarningIcon: true,
    });
  }

  if (pathSegments?.[pathSegments.length - 1] === 'features' && row?.isDocumented === false) {
    lines.push({
      text: 'This key is configured in your file but is not in the official feature list.',
      color: 'gray',
      bold: false,
      showWarningIcon: true,
    });
  }

  if (pathSegments.length === 0 && row?.key === 'model') {
    lines.push({
      text: 'Model values shown here are curated presets and not a full upstream model catalog.',
      color: 'gray',
      bold: false,
      showWarningIcon: false,
    });
  }

  return lines;
};

export const ConfigNavigator = ({
  snapshot,
  pathSegments,
  selectedIndex,
  scrollOffset,
  terminalWidth,
  terminalHeight,
  editMode,
  editError,
}) => {
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
  const rows = buildRows(currentNode, pathSegments);
  const selected = rows.length === 0 ? 0 : Math.min(selectedIndex, rows.length - 1);
  const { leftWidth, rightWidth } = computePaneWidths(terminalWidth, rows);
  const terminalListHeight = Math.max(4, (terminalHeight || 24) - 14);
  const viewportHeight = Math.max(4, Math.min(rows.length, Math.min(20, terminalListHeight)));
  const viewportStart = clamp(scrollOffset, 0, Math.max(0, rows.length - viewportHeight));
  const visibleRows = rows.slice(viewportStart, viewportStart + viewportHeight);
  const canScrollUp = viewportStart > 0;
  const canScrollDown = viewportStart + viewportHeight < rows.length;
  const selectedRow = rows[selected] || null;
  const selectedPath =
    selectedRow && selectedRow.pathSegment != null
      ? [...pathSegments, selectedRow.pathSegment]
      : pathSegments;
  const readOnlyOptions =
    selectedRow && selectedRow.kind === 'value'
      ? getConfigOptions(selectedPath, selectedRow.key, selectedRow.value, selectedRow.kind) || []
      : [];
  const readOnlyOptionIndex = readOnlyOptions.findIndex((option) => Object.is(option, selectedRow?.value));
  const readOnlyDefaultOption = selectedRow
    ? getConfigDefaultOption(selectedPath, selectedRow.key, selectedRow.kind, readOnlyOptions)
    : null;
  const readOnlyDefaultOptionIndex = readOnlyOptions.findIndex((option) =>
    Object.is(option, readOnlyDefaultOption)
  );
  const shouldShowReadOnlyOptions =
    readOnlyOptions.length > 0 &&
    !isBooleanOnlyOptions(readOnlyOptions);

  const editRow = rows[selected] || null;
  const editDefaultOption = editMode && editMode.mode === 'select' && editRow
    ? getConfigDefaultOption(editMode.path, editRow.key, 'value', editMode.options)
    : null;
  const editDefaultOptionIndex = editMode && editMode.mode === 'select'
    ? editMode.options.findIndex((option) => Object.is(option, editDefaultOption))
    : -1;

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

              return React.createElement(
                MenuItem,
                {
                  label,
                  isSelected,
                  isDimmed: !isSelected && row.isConfigured === false,
                  isDeprecated: row.isDeprecated,
                  key: `left-${index}`,
                }
              );
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
              ...formatConfigHelp(pathSegments, rows[selected]).map((line, lineIndex) =>
                React.createElement(
                  Text,
                  {
                    key: `help-${selected}-${lineIndex}`,
                    color: line.color,
                    bold: line.bold,
                  },
                  line.showWarningIcon
                    ? React.createElement(Text, { color: 'yellow' }, '[!] ')
                    : null,
                  line.text
                )
              ),
            editError ? React.createElement(Text, { color: 'red' }, editError) : null,
            editMode ? React.createElement(Text, { color: 'gray' }, ' ') : null,
            editMode
              ? editMode.mode === 'text'
                ? renderTextEditor(editMode.draftValue)
                : editMode.mode === 'add-id'
                  ? renderIdEditor(editMode.placeholder, editMode.draftValue)
                : renderEditableOptions(
                    editMode.options,
                    editMode.selectedOptionIndex,
                    editDefaultOptionIndex,
                    editMode.path.slice(0, -1),
                    rows[selected].key,
                    editMode.savedOptionIndex,
                    true
                  )
              : shouldShowReadOnlyOptions
                  ? React.createElement(
                      React.Fragment,
                      null,
                      React.createElement(Text, { color: 'gray' }, ' '),
                      renderEditableOptions(
                        readOnlyOptions,
                        readOnlyOptionIndex,
                        readOnlyDefaultOptionIndex,
                        selectedPath,
                        selectedRow?.key,
                        null,
                        false
                      )
                    )
                  : rows[selected].kind === 'array'
                      ? renderArrayDetails(rows[selected].value)
                      : null
          )
    )
  );
};
