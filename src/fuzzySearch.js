const normalizeText = (value) => String(value || '').toLowerCase();

export const isFuzzyMatch = (query, text) => {
  const normalizedQuery = normalizeText(query).trim();
  if (!normalizedQuery) {
    return true;
  }

  const normalizedText = normalizeText(text);
  let queryIndex = 0;

  for (let textIndex = 0; textIndex < normalizedText.length; textIndex += 1) {
    if (normalizedText[textIndex] === normalizedQuery[queryIndex]) {
      queryIndex += 1;
      if (queryIndex >= normalizedQuery.length) {
        return true;
      }
    }
  }

  return false;
};

const rowSearchableTexts = (row) => [
  row?.label,
  row?.key,
  row?.preview,
];

export const filterRowsByQuery = (rows, query) => {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) {
    return rows;
  }

  return rows.filter((row) =>
    rowSearchableTexts(row).some((value) => isFuzzyMatch(normalizedQuery, value))
  );
};
