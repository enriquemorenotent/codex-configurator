export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const pathToKey = (segments) => JSON.stringify(segments);

export const computePaneWidths = (terminalWidth, rows) => {
  const available = Math.max(40, terminalWidth - 2);
  const contentRows = rows.length === 0 ? [] : rows;
  const longestRow = contentRows.reduce(
    (max, row) => Math.max(max, String(row.label).length + 8),
    26
  );
  const minLeftWidth = 30;
  const minRightWidth = 24;

  const leftNeed = Math.max(minLeftWidth, longestRow);
  const leftWidth = clamp(leftNeed, minLeftWidth, available - minRightWidth - 2);
  const rightWidth = available - leftWidth - 2;

  return { leftWidth, rightWidth };
};
