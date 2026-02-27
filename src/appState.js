export const APP_STATE_ACTION = 'APP_STATE_ACTION';

export const APP_MODES = {
  BROWSE: 'browse',
  FILTER: 'filter',
  FILE_SWITCH: 'file-switch',
  EDIT: 'edit',
  COMMAND: 'command',
};

export const appStateReducer = (state, action) => {
  if (action.type !== APP_STATE_ACTION) {
    return state;
  }

  const { key, valueOrUpdater, updates } = action.payload || {};

  if (!action.payload) {
    return state;
  }

  if (typeof updates === 'object' && updates !== null) {
    return {
      ...state,
      ...updates,
    };
  }

  if (typeof key === 'undefined') {
    return state;
  }

  if (typeof valueOrUpdater === 'function') {
    return {
      ...state,
      [key]: valueOrUpdater(state[key]),
    };
  }

  return {
    ...state,
    [key]: valueOrUpdater,
  };
};

export const buildInitialAppState = (initialMainSnapshot, initialCatalog, initialActiveFileId) => ({
  snapshot: initialMainSnapshot,
  snapshotByFileId: {
    [initialActiveFileId]: initialMainSnapshot,
  },
  configFileCatalog: initialCatalog,
  activeConfigFileId: initialActiveFileId,
  pathSegments: [],
  selectedIndex: 0,
  selectionByPath: {},
  scrollOffset: 0,
  editMode: null,
  isFileSwitchMode: false,
  fileSwitchIndex: 0,
  editError: '',
  filterQuery: '',
  isFilterEditing: false,
  isCommandMode: false,
  commandInput: '',
  commandMessage: '',
  showHelp: false,
  codexVersion: 'version loading...',
  codexVersionStatus: '',
});
