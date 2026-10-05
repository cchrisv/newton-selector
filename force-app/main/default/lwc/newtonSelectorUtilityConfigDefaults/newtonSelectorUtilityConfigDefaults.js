export function parseRemValue(value, fallback) {
  if (value == null || value === "") return fallback;
  const match = String(value)
    .trim()
    .match(/^([\d.]+)\s*rem$/i);
  if (!match) return fallback;
  const n = parseFloat(match[1]);
  return Number.isFinite(n) ? n : fallback;
}

export function formatRem(n) {
  const rounded = Math.round(n * 100) / 100;
  return `${rounded}rem`;
}

const DEFAULT_NONE_OPTION_LABEL = "--None--";
const DEFAULT_MANUAL_INPUT_LABEL = "Other";

const AUTO_BOX = {
  top: "",
  right: "",
  bottom: "",
  left: "",
  linked: true
};

const DEFAULT_BADGE_CONFIG = {
  position: "bottom-inline",
  variant: "neutral",
  shape: "pill",
  variantHex: ""
};

const BASE_GRID_CONFIG = {
  margin: AUTO_BOX,
  padding: AUTO_BOX,
  badge: DEFAULT_BADGE_CONFIG,
  columns: null,
  selectionIndicator: "frame",
  elevation: "outlined",
  pattern: "none",
  patternTone: "neutral",
  patternHoverTone: "neutral",
  patternSelectedTone: "brand",
  patternDisabledTone: "neutral",
  cornerStyle: "none",
  cornerTone: "neutral",
  surfaceStyle: "solid",
  surfaceTone: "neutral",
  surfaceHoverTone: "neutral",
  surfaceSelectedTone: "brand",
  surfaceDisabledTone: "neutral",
  iconDecor: "square",
  iconStyle: "soft",
  iconShading: "flat",
  iconTone: "brand",
  iconToneHex: "",
  iconGlyphTone: "auto",
  iconGlyphToneHex: "",
  // "auto" scales the glyph with the tile size.
  iconSize: "auto",
  patternToneHex: "",
  patternHoverToneHex: "",
  patternSelectedToneHex: "",
  patternDisabledToneHex: "",
  cornerToneHex: "",
  surfaceToneHex: "",
  surfaceHoverToneHex: "",
  surfaceSelectedToneHex: "",
  surfaceDisabledToneHex: "",
  showIcons: true,
  showBadges: true
};

// Per-layout geometry: tile footprint and the SLDS spacing tokens between tiles.
const LAYOUT_PRESETS = {
  grid: {
    minWidth: "7.5rem",
    gapH: "2",
    gapV: "2",
    size: "small",
    aspectRatio: "1:1"
  },
  list: {
    minWidth: "100%",
    gapH: "none",
    gapV: "1",
    size: "small",
    aspectRatio: "auto"
  },
  horizontal: {
    minWidth: "7.5rem",
    gapH: "2",
    gapV: "none",
    size: "small",
    aspectRatio: "1:1"
  },
  picklist: {
    minWidth: "100%",
    gapH: "none",
    gapV: "1",
    size: "small",
    aspectRatio: "auto"
  },
  radio: {
    minWidth: "100%",
    gapH: "none",
    gapV: "1",
    size: "small",
    aspectRatio: "auto"
  },
  columns: {
    minWidth: "100%",
    gapH: "3",
    gapV: "1",
    size: "small",
    aspectRatio: "auto"
  },
  dualListbox: {
    minWidth: "100%",
    gapH: "3",
    gapV: "1",
    size: "small",
    aspectRatio: "auto"
  }
};

export function normalizeLayoutKey(value) {
  return Object.prototype.hasOwnProperty.call(LAYOUT_PRESETS, value)
    ? value
    : "grid";
}

export function defaultGridConfig(layout = "grid") {
  return {
    ...BASE_GRID_CONFIG,
    ...LAYOUT_PRESETS[normalizeLayoutKey(layout)],
    margin: { ...AUTO_BOX },
    padding: { ...AUTO_BOX },
    badge: { ...DEFAULT_BADGE_CONFIG }
  };
}

function mergeGridConfig(layout, gridConfig) {
  const base = defaultGridConfig(layout);
  return {
    ...base,
    ...gridConfig,
    margin: { ...base.margin, ...gridConfig.margin },
    padding: { ...base.padding, ...gridConfig.padding },
    badge: { ...base.badge, ...gridConfig.badge }
  };
}

export function defaultSelectorConfig() {
  return {
    dataSource: "",
    layout: "grid",
    selectionMode: "single",
    autoAdvance: false,
    enableSearch: false,
    showSelectAll: false,
    minSelections: 0,
    maxSelections: null,
    required: false,
    customErrorMessage: "",
    label: "",
    helpText: "",
    fieldLevelHelp: "",
    emptyStateMessage: "No options available.",
    errorStateMessage: "Could not load options.",
    picklist: {
      objectApiName: "",
      fieldApiName: "",
      recordTypeId: "",
      valueSource: "apiName"
    },
    collection: {
      objectApiName: "",
      fieldMap: {
        label: "",
        sublabel: "",
        icon: "",
        value: "",
        badge: "",
        helpText: ""
      }
    },
    sobject: {
      sObjectApiName: "",
      whereClause: "",
      orderByField: "",
      orderByDirection: "ASC",
      limit: 50,
      labelField: "Name",
      valueField: "Id",
      sublabelField: "",
      iconField: "",
      badgeField: "",
      helpField: ""
    },
    custom: { items: [] },
    includeNoneOption: false,
    noneOptionLabel: DEFAULT_NONE_OPTION_LABEL,
    noneOptionPosition: "start",
    manualInput: {
      enabled: false,
      label: DEFAULT_MANUAL_INPUT_LABEL,
      minLength: 0,
      maxLength: null
    },
    overrides: {},
    display: { sortBy: "none", sortDirection: "asc", limit: null },
    gridConfig: defaultGridConfig("grid")
  };
}

// Deep-merges a saved (possibly partial) config over the defaults. The CPE and
// the runtime both read configs through this, so every key is always present.
export function mergeSelectorConfig(initialConfig) {
  const base = defaultSelectorConfig();
  const incoming = initialConfig
    ? JSON.parse(JSON.stringify(initialConfig))
    : {};
  const layout = normalizeLayoutKey(incoming.layout || base.layout);

  return {
    ...base,
    ...incoming,
    layout,
    picklist: { ...base.picklist, ...incoming.picklist },
    collection: {
      ...base.collection,
      ...incoming.collection,
      fieldMap: {
        ...base.collection.fieldMap,
        ...incoming.collection?.fieldMap
      }
    },
    sobject: { ...base.sobject, ...incoming.sobject },
    custom: { items: incoming.custom?.items || [] },
    manualInput: { ...base.manualInput, ...incoming.manualInput },
    overrides:
      incoming.overrides && typeof incoming.overrides === "object"
        ? incoming.overrides
        : {},
    display: { ...base.display, ...incoming.display },
    gridConfig: mergeGridConfig(layout, incoming.gridConfig || {})
  };
}

// A blank label would render an empty tile, so it falls back to the default.
function labelOrDefault(label, fallback) {
  return label?.trim() ? label : fallback;
}

/**
 * Maps a merged selector config to the public properties of
 * c-newton-selector-data-selector. `appearance` holds the properties the data
 * selector hands to c-newton-selector-group unchanged.
 * @param {object} config - output of mergeSelectorConfig
 * @param {Array<object>} records - Flow record collection (collection source)
 */
export function selectorPropsFromConfig(config, records = []) {
  const grid = config.gridConfig;
  // A blank gap is the editor's "Auto": the layout's standard gap.
  const preset = LAYOUT_PRESETS[config.layout];
  return {
    label: config.label,
    helpText: config.helpText,
    fieldLevelHelp: config.fieldLevelHelp,
    sourceType: config.dataSource,
    layout: config.layout,
    selectionMode: config.selectionMode,
    required: config.required,
    minSelections: config.minSelections,
    maxSelections: config.maxSelections,
    enableSearch: config.enableSearch,
    showSelectAll: config.showSelectAll,
    emptyStateMessage: config.emptyStateMessage,
    errorStateMessage: config.errorStateMessage,
    picklistConfig: config.picklist,
    collectionConfig: { records, fieldMap: config.collection.fieldMap },
    sobjectConfig: config.sobject,
    customConfig: config.custom,
    overrides: config.overrides,
    displayConfig: config.display,
    includeNoneOption: config.includeNoneOption,
    noneOptionLabel: labelOrDefault(
      config.noneOptionLabel,
      DEFAULT_NONE_OPTION_LABEL
    ),
    noneOptionPosition: config.noneOptionPosition,
    allowManualInput: config.manualInput.enabled,
    manualInputLabel: labelOrDefault(
      config.manualInput.label,
      DEFAULT_MANUAL_INPUT_LABEL
    ),
    manualInputMinLength: config.manualInput.minLength,
    manualInputMaxLength: config.manualInput.maxLength,
    appearance: {
      gridMinWidth: grid.minWidth,
      gapHorizontal: grid.gapH || preset.gapH,
      gapVertical: grid.gapV || preset.gapV,
      marginTop: grid.margin.top,
      marginRight: grid.margin.right,
      marginBottom: grid.margin.bottom,
      marginLeft: grid.margin.left,
      paddingTop: grid.padding.top,
      paddingRight: grid.padding.right,
      paddingBottom: grid.padding.bottom,
      paddingLeft: grid.padding.left,
      columns: grid.columns,
      size: grid.size,
      aspectRatio: grid.aspectRatio,
      iconSize: grid.iconSize,
      badgePosition: grid.badge.position,
      badgeVariant: grid.badge.variant,
      badgeShape: grid.badge.shape,
      badgeVariantHex: grid.badge.variantHex,
      selectionIndicator: grid.selectionIndicator,
      elevation: grid.elevation,
      pattern: grid.pattern,
      patternTone: grid.patternTone,
      patternHoverTone: grid.patternHoverTone,
      patternSelectedTone: grid.patternSelectedTone,
      patternDisabledTone: grid.patternDisabledTone,
      patternToneHex: grid.patternToneHex,
      patternHoverToneHex: grid.patternHoverToneHex,
      patternSelectedToneHex: grid.patternSelectedToneHex,
      patternDisabledToneHex: grid.patternDisabledToneHex,
      cornerStyle: grid.cornerStyle,
      cornerTone: grid.cornerTone,
      cornerToneHex: grid.cornerToneHex,
      surfaceStyle: grid.surfaceStyle,
      surfaceTone: grid.surfaceTone,
      surfaceHoverTone: grid.surfaceHoverTone,
      surfaceSelectedTone: grid.surfaceSelectedTone,
      surfaceDisabledTone: grid.surfaceDisabledTone,
      surfaceToneHex: grid.surfaceToneHex,
      surfaceHoverToneHex: grid.surfaceHoverToneHex,
      surfaceSelectedToneHex: grid.surfaceSelectedToneHex,
      surfaceDisabledToneHex: grid.surfaceDisabledToneHex,
      iconDecor: grid.iconDecor,
      iconStyle: grid.iconStyle,
      iconShading: grid.iconShading,
      iconTone: grid.iconTone,
      iconToneHex: grid.iconToneHex,
      iconGlyphTone: grid.iconGlyphTone,
      iconGlyphToneHex: grid.iconGlyphToneHex,
      showIcons: grid.showIcons,
      showBadges: grid.showBadges
    }
  };
}
