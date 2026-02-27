export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const pathToKey = (segments) => JSON.stringify(segments);

const MIN_LEFT_WIDTH = 32;
const MIN_RIGHT_WIDTH = 24;
const SPLIT_GAP = 2;
const LEFT_PANE_WIDTH_RATIO = 0.3;
const MIN_TERMINAL_WIDTH = 58;
const SHELL_VERTICAL_PADDING = 2;
const COMMAND_BAR_ROWS = 3;
const STATUS_BAR_ROWS = 4;
const FULL_HEADER_WIDTH_THRESHOLD = 170;
const MIN_HEADER_WRAP_WIDTH = 20;
const HEADER_MARGIN_BOTTOM = 0;
const NON_INTERACTIVE_POST_LIST_ROWS = 1;
const NAVIGATOR_FRAME_ROWS = 4;

const wrapLineCount = (value, width) =>
  Math.max(1, Math.ceil(String(value || '').length / Math.max(1, width)));

export const isCompactHeader = (terminalWidth) => terminalWidth < FULL_HEADER_WIDTH_THRESHOLD;

export const formatActiveFileSummary = (activeConfigFile) => {
  const label = String(activeConfigFile?.label || 'unknown');
  const filePath = String(activeConfigFile?.path || 'path unavailable');
  return label.includes(filePath) ? label : `${label} (${filePath})`;
};

export const computeHeaderRows = ({
  terminalWidth,
  activeConfigFile,
  packageVersion,
  codexVersion,
  codexVersionStatus,
}) => {
  const width = Math.max(1, terminalWidth - 2);
  const compact = isCompactHeader(terminalWidth);
  const activeLine = `Active file: ${formatActiveFileSummary(activeConfigFile)}`;
  const statusLine = `Codex ${codexVersion || 'version unavailable'}${codexVersionStatus ? ` (${codexVersionStatus})` : ''}`;
  const versionLine = `v${packageVersion || 'unknown'}`;
  const activeLines = wrapLineCount(activeLine, width);

  if (compact) {
    return {
      isCompact: true,
      rows: 1 + wrapLineCount(versionLine, width) + wrapLineCount(statusLine, width) + activeLines,
    };
  }

  return {
    isCompact: false,
    rows: 6 + 1 + wrapLineCount(statusLine, width) + 1 + activeLines,
  };
};

export const computeChromeRows = ({
  terminalWidth,
  isInteractive,
  activeConfigFile,
  packageVersion,
  codexVersion,
  codexVersionStatus,
}) => {
  const header = computeHeaderRows({
    terminalWidth: Math.max(MIN_HEADER_WRAP_WIDTH, terminalWidth),
    activeConfigFile,
    packageVersion,
    codexVersion,
    codexVersionStatus,
  });
  const gaps = isInteractive ? 3 : 0;
  const commandRows = isInteractive ? COMMAND_BAR_ROWS : 0;
  const statusRows = isInteractive ? STATUS_BAR_ROWS : 0;
  const postListRows = isInteractive ? 0 : NON_INTERACTIVE_POST_LIST_ROWS;

  return (
    SHELL_VERTICAL_PADDING
    + HEADER_MARGIN_BOTTOM
    + NAVIGATOR_FRAME_ROWS
    + header.rows
    + gaps
    + commandRows
    + statusRows
    + postListRows
  );
};

export const computeListViewportRows = ({
  terminalHeight,
  terminalWidth,
  activeConfigFile,
  packageVersion,
  codexVersion,
  codexVersionStatus,
  isInteractive = true,
  chromeRows,
  extraChromeRows = 0,
}) => {
  const resolvedChromeRows = chromeRows || computeChromeRows({
    terminalWidth: Math.max(MIN_HEADER_WRAP_WIDTH, terminalWidth),
    isInteractive,
    activeConfigFile,
    packageVersion,
    codexVersion,
    codexVersionStatus,
  });
  const availableRows = (terminalHeight || 24) - resolvedChromeRows - Math.max(0, extraChromeRows);

  return Math.max(1, availableRows);
};

export const computePaneWidths = (terminalWidth) => {
  const available = Math.max(MIN_TERMINAL_WIDTH, terminalWidth - 2);
  const leftWidth = clamp(
    Math.floor(available * LEFT_PANE_WIDTH_RATIO),
    MIN_LEFT_WIDTH,
    available - MIN_RIGHT_WIDTH - SPLIT_GAP
  );
  const rightWidth = available - leftWidth - SPLIT_GAP;

  return { leftWidth, rightWidth };
};
