import { defaultGridConfig } from "c/newtonSelectorUtilityConfigDefaults";
import { removeFormatting } from "c/newtonSelectorFlowCpeUtilityHelpers";

// Flow Builder resources that can hold a record collection, and the key each
// one uses for its object type.
const RECORD_RESOURCE_OBJECT_KEYS = {
  variables: "objectType",
  recordLookups: "object"
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
  return Object.fromEntries(
    LAYOUT_GEOMETRY_KEYS.map((key) => [key, gridConfig[key] ?? null])
  );
}

// Switch layouts without losing work: style settings carry over, the current
// layout's geometry is remembered in `layoutGeometry`, and the target layout
// gets its own remembered geometry (or its preset the first time).
export function switchLayout(config, nextLayout) {
  const from = config.layout;
  if (from === nextLayout) return config;

  const layoutGeometry = {
    ...(config.layoutGeometry || {}),
    [from]: pickGeometry(config.gridConfig)
  };
  const geometry =
    layoutGeometry[nextLayout] || pickGeometry(defaultGridConfig(nextLayout));

  return {
    ...config,
    layout: nextLayout,
    layoutGeometry,
    gridConfig: { ...config.gridConfig, ...geometry }
  };
}

// "Reset appearance": every appearance setting back to the current layout's
// defaults, and forget remembered per-layout geometry. Callers keep the
// previous gridConfig/layoutGeometry to offer Undo.
export function resetAppearance(config) {
  return {
    ...config,
    layoutGeometry: {},
    gridConfig: defaultGridConfig(config.layout)
  };
}

// Object API name of the Flow record collection that rawRef ("{!Name}" or
// "Name") points at, looked up in Flow Builder's builderContext.
export function recordCollectionObjectType(builderContext, rawRef) {
  const ref = removeFormatting(String(rawRef || "")).trim();
  for (const [bucket, objectKey] of Object.entries(
    RECORD_RESOURCE_OBJECT_KEYS
  )) {
    const match = (builderContext?.[bucket] || []).find(
      (resource) => resource.name === ref
    );
    if (match) return match[objectKey] || "";
  }
  return "";
}

// ── Flow values in the WHERE clause ──────────────────────────
// The saved clause holds Flow merge fields ({!Var}, or '{!Var}' for text-like
// fields) that Flow fills in at run time. The editor has no run-time values,
// so Validate query swaps each one for a sample value of the field's type.

// A quoted string, a bare merge field, a field name or word, an operator, or
// any other single character. Whitespace is left in place.
const WHERE_TOKEN = /'(?:\\.|[^'\\])*'|\{![^}]*\}|[\w.$]+|[<>!=]+|\S/g;
const COMPARISON_OPERATORS = new Set([
  "=",
  "!=",
  "<>",
  "<",
  ">",
  "<=",
  ">=",
  "LIKE"
]);
const SAMPLE_ID = "'000000000000000AAA'";
const SAMPLE_VALUES = Object.freeze({
  BOOLEAN: "FALSE",
  INTEGER: "0",
  LONG: "0",
  DOUBLE: "0",
  CURRENCY: "0",
  PERCENT: "0",
  DATE: "2000-01-01",
  DATETIME: "2000-01-01T00:00:00Z",
  TIME: "00:00:00",
  ID: SAMPLE_ID,
  REFERENCE: SAMPLE_ID
});

function isFlowValueToken(token) {
  const bare = token.startsWith("'") ? token.slice(1, -1) : token;
  return /^\{![^}]*\}$/.test(bare);
}

/**
 * True when the WHERE clause holds a Flow value anywhere, e.g. {!Var},
 * '{!Var}' or '%{!Var}%'. Flow fills in every merge field in the stored text.
 */
export function hasFlowValues(whereClause) {
  return /\{![^}]*\}/.test(String(whereClause || ""));
}

/**
 * The WHERE clause with each Flow value that follows `Field <operator>`
 * replaced by a sample value of that field's type, so Apex still checks the
 * syntax, fields, operators and value types. Text-like fields keep the quoted
 * '{!Var}', which is already a valid text value.
 * @param {string} whereClause
 * @param {{name: string, type: string}[]} fields - getObjectFields rows for
 *   the queried object; `type` is a Schema.DisplayType name
 * @returns {string}
 */
export function whereClauseWithSampleFlowValues(whereClause, fields) {
  const typeByField = new Map(
    fields.map((field) => [field.name.toLowerCase(), field.type])
  );
  const previous = [];
  return String(whereClause || "").replace(WHERE_TOKEN, (token) => {
    const [fieldName, operator] = previous.slice(-2);
    previous.push(token);
    if (
      !isFlowValueToken(token) ||
      !COMPARISON_OPERATORS.has(String(operator).toUpperCase())
    ) {
      return token;
    }
    const type = typeByField.get(String(fieldName).toLowerCase());
    return SAMPLE_VALUES[type] || token;
  });
}
