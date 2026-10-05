import {
  defaultGridConfig,
  normalizeLayoutKey
} from "c/newtonSelectorUtilityConfigDefaults";

// SOQL source query defaults; the runtime applies the same ones.
export const DEFAULT_QUERY_LIMIT = 50;
export const MAX_QUERY_LIMIT = 2000;

// Flow Builder resources that can hold a record collection, and the key each
// one uses for its object type.
const RECORD_RESOURCE_OBJECT_KEYS = {
  variables: "objectType",
  recordLookups: "object",
  recordCreates: "object",
  recordUpdates: "object"
};

// The parts of gridConfig that belong to a layout (tile footprint and grid
// gaps). Everything else in gridConfig is style (tones, pattern, corners,
// surface, elevation, icons, badges, selection indicator, spacing) and is
// shared across layouts.
const LAYOUT_GEOMETRY_KEYS = Object.freeze([
  "minWidth",
  "size",
  "aspectRatio",
  "columns",
  "gapH",
  "gapV"
]);

function pickGeometry(gridConfig) {
  const source = gridConfig || {};
  return Object.fromEntries(
    LAYOUT_GEOMETRY_KEYS.map((key) => [key, source[key] ?? null])
  );
}

// Switch layouts without losing work: style settings carry over, the current
// layout's geometry is remembered in `layoutGeometry`, and the target layout
// gets its own remembered geometry (or its preset the first time).
export function switchLayout(config, nextLayout) {
  const current = config || {};
  const from = normalizeLayoutKey(current.layout || "grid");
  const to = normalizeLayoutKey(nextLayout || "grid");
  if (from === to) return current;

  const gridConfig = current.gridConfig || defaultGridConfig(from);
  const layoutGeometry = {
    ...(current.layoutGeometry || {}),
    [from]: pickGeometry(gridConfig)
  };
  const geometry = layoutGeometry[to] || pickGeometry(defaultGridConfig(to));

  return {
    ...current,
    layout: to,
    layoutGeometry,
    gridConfig: { ...gridConfig, ...geometry }
  };
}

// "Reset appearance": every appearance setting back to the current layout's
// defaults, and forget remembered per-layout geometry. Callers keep the
// previous gridConfig/layoutGeometry to offer Undo.
export function resetAppearance(config) {
  const current = config || {};
  const layout = normalizeLayoutKey(current.layout || "grid");
  return {
    ...current,
    layoutGeometry: {},
    gridConfig: defaultGridConfig(layout)
  };
}

export function setConfigPath(config, path, value) {
  if (!Array.isArray(path)) return config;
  if (path.length === 0) return value;
  const [head, ...tail] = path;
  if (tail.length === 0) {
    return { ...(config || {}), [head]: value };
  }
  return {
    ...(config || {}),
    [head]: setConfigPath(config?.[head] || {}, tail, value)
  };
}

export function buildSobjectConfigForQuery(config) {
  const sobject = config?.sobject || {};
  return {
    sObjectApiName: sobject.sObjectApiName || "",
    whereClause: sobject.whereClause || "",
    orderByField: sobject.orderByField || "",
    orderByDirection: sobject.orderByDirection || "ASC",
    queryLimit: Number(sobject.limit || DEFAULT_QUERY_LIMIT),
    labelField: sobject.labelField || "Name",
    valueField: sobject.valueField || "Id",
    sublabelField: sobject.sublabelField || "",
    iconField: sobject.iconField || "",
    badgeField: sobject.badgeField || "",
    helpField: sobject.helpField || ""
  };
}

// Object API name of the Flow record collection that rawRef ("{!Name}" or
// "Name") points at, looked up in Flow Builder's builderContext.
export function resolveRecordCollectionMetadataFromBuilderContext(
  builderContext,
  rawRef
) {
  const ref = String(rawRef || "")
    .replace(/^\{!\s*/, "")
    .replace(/\s*\}$/, "")
    .trim();
  for (const [bucket, objectKey] of Object.entries(
    RECORD_RESOURCE_OBJECT_KEYS
  )) {
    const match = (builderContext?.[bucket] || []).find(
      (resource) => resource.name === ref
    );
    if (match) return { objectApiName: match[objectKey] || "" };
  }
  return { objectApiName: "" };
}
