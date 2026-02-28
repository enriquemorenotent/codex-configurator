export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const pathToKey = (segments) => JSON.stringify(segments);

const MIN_LEFT_WIDTH = 32;
const MIN_RIGHT_WIDTH = 24;
const SPLIT_GAP = 2;
const LEFT_PANE_WIDTH_RATIO = 0.3;
const MIN_TERMINAL_WIDTH = 58;
const SHELL_VERTICAL_PADDING = 0;
const COMMAND_BAR_ROWS = 3; // 2 border + 1 text
const STATUS_BAR_ROWS = 2; // content 1 + margin 1
const HEADER_MARGIN_BOTTOM = 0;
const NON_INTERACTIVE_POST_LIST_ROWS = 1;
const NAVIGATOR_FRAME_ROWS = 4;

export const formatActiveFileSummary = (activeConfigFile) => {
	const label = String(activeConfigFile?.label || 'unknown');
	const filePath = String(activeConfigFile?.path || 'path unavailable');
	return label.includes(filePath) ? label : `${label} (${filePath})`;
};

export const computeHeaderRows = () => {
	return {
		isCompact: true,
		rows: 1,
	};
};

export const computeChromeRows = ({ isInteractive }) => {
	const header = computeHeaderRows();
	const gaps = isInteractive ? 3 : 0;
	const commandRows = isInteractive ? COMMAND_BAR_ROWS : 0;
	const statusRows = isInteractive ? STATUS_BAR_ROWS : 0;
	const postListRows = isInteractive ? 0 : NON_INTERACTIVE_POST_LIST_ROWS;

	return (
		SHELL_VERTICAL_PADDING +
		HEADER_MARGIN_BOTTOM +
		NAVIGATOR_FRAME_ROWS +
		header.rows +
		gaps +
		commandRows +
		statusRows +
		postListRows
	);
};

export const computeListViewportRows = ({
	terminalHeight,
	isInteractive = true,
	chromeRows,
	extraChromeRows = 0,
}) => {
	const resolvedChromeRows =
		chromeRows ||
		computeChromeRows({
			isInteractive,
		});
	const availableRows =
		(terminalHeight || 24) -
		resolvedChromeRows -
		Math.max(0, extraChromeRows);

	return Math.max(1, availableRows);
};

export const computePaneWidths = (terminalWidth) => {
	const available = Math.max(MIN_TERMINAL_WIDTH, terminalWidth - 2);
	const leftWidth = clamp(
		Math.floor(available * LEFT_PANE_WIDTH_RATIO),
		MIN_LEFT_WIDTH,
		available - MIN_RIGHT_WIDTH - SPLIT_GAP,
	);
	const rightWidth = available - leftWidth - SPLIT_GAP;

	return { leftWidth, rightWidth };
};
