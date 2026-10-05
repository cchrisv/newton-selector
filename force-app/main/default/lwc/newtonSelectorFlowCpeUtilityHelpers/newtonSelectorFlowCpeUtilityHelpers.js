/**
 * Newton Selector Flow CPE | Helpers
 *
 *   1. Load errors          — "Couldn't load …" messages for Apex and wire failures
 *   2. Field types          — the one field/resource type → Lucide icon map,
 *                             type labels, and field picker options
 *   3. Merge-field helpers  — {!...} reference detection and formatting
 *
 * Attribution: merge-field helpers adapted from UnofficialSF fsc_flowComboboxUtils
 * (Apache-2.0). See repo LICENSE and NOTICE.
 */

import { errorMessageOf } from "c/newtonSelectorUtilityDataSources";

// ═════════════════════════════════════════════════════════════════
// 1. LOAD ERRORS
// ═════════════════════════════════════════════════════════════════

/**
 * "Couldn't load <what>: <reason>" for an Apex or wire error.
 * @param {string} what — e.g. "fields"
 * @param {*} error
 * @returns {string}
 */
export function loadErrorMessage(what, error) {
  return `Couldn't load ${what}: ${errorMessageOf(error, "Try again or reload Flow Builder.")}`;
}

// ═════════════════════════════════════════════════════════════════
// 2. FIELD TYPES
// ═════════════════════════════════════════════════════════════════

/**
 * Field or Flow resource type (upper case: Schema.DisplayType names such as
 * "CURRENCY", or Flow data types such as "SOBJECT") → Lucide icon name.
 */
export const TYPE_ICON_MAP = Object.freeze({
  STRING: "type",
  TEXTAREA: "file-text",
  INTEGER: "hash",
  LONG: "hash",
  DOUBLE: "hash",
  NUMBER: "hash",
  CURRENCY: "dollar-sign",
  PERCENT: "percent",
  BOOLEAN: "toggle-left",
  DATE: "calendar-days",
  DATETIME: "calendar-clock",
  TIME: "clock",
  PICKLIST: "list",
  COMBOBOX: "list",
  MULTIPICKLIST: "list-checks",
  REFERENCE: "link-2",
  ID: "key-round",
  EMAIL: "mail",
  PHONE: "phone",
  URL: "link",
  ADDRESS: "map-pin",
  LOCATION: "map-pin",
  ENCRYPTEDSTRING: "lock",
  BASE64: "image",
  SOBJECT: "database",
  APEX: "code-xml",
  ACTIONCALLS: "workflow",
  SCREENACTION: "workflow",
  SCREENCOMPONENT: "screen-share"
});

function iconForFieldType(fieldType) {
  return TYPE_ICON_MAP[String(fieldType || "").toUpperCase()] || "type";
}

const FIELD_TYPE_LABELS = Object.freeze({
  MULTIPICKLIST: "Multi-Picklist",
  ENCRYPTEDSTRING: "Encrypted Text",
  TEXTAREA: "Text Area",
  DATETIME: "Date/Time",
  BOOLEAN: "Checkbox",
  REFERENCE: "Lookup",
  INTEGER: "Number",
  DOUBLE: "Number",
  LONG: "Number"
});

// "MULTIPICKLIST" → "Multi-Picklist", "CURRENCY" → "Currency".
function formatFieldType(fieldType) {
  if (!fieldType) return "";
  const upper = fieldType.toUpperCase();
  return (
    FIELD_TYPE_LABELS[upper] || upper.charAt(0) + upper.slice(1).toLowerCase()
  );
}

/**
 * Transform raw Field[] from Apex into lookup-compatible option objects,
 * sorted by label.
 * @param {Array} fields — from getObjectFields
 * @returns {{id:string, title:string, subtitle:string, icon:string, type:string, sortable:boolean, filterable:boolean}[]}
 */
export function fieldsToOptions(fields) {
  return fields
    .map((f) => ({
      id: f.name || "",
      title: f.label || f.name || "",
      subtitle: `${f.name || ""} — ${formatFieldType(f.type)}`,
      icon: iconForFieldType(f.type),
      type: f.type || "",
      sortable: f.sortable === true,
      filterable: f.filterable === true
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Filter field options by search term (matches against label, API name, or subtitle).
 * @param {Array} options — from fieldsToOptions
 * @param {string} term
 */
export function filterFieldOptions(options, term) {
  const t = (term || "").trim().toLowerCase();
  if (!t) return options;
  return options.filter(
    (o) =>
      (o.title || "").toLowerCase().includes(t) ||
      (o.id || "").toLowerCase().includes(t) ||
      (o.subtitle || "").toLowerCase().includes(t)
  );
}

// ═════════════════════════════════════════════════════════════════
// 3. MERGE-FIELD / FLOW RESOURCE HELPERS
// ═════════════════════════════════════════════════════════════════
// Adapted from UnofficialSF fsc_flowComboboxUtils (Apache-2.0).

export const flowComboboxDefaults = Object.freeze({
  stringDataType: "String",
  referenceDataType: "reference",
  defaultKeyPrefix: "flowCombobox-",
  defaultGlobalVariableKeyPrefix: "flowCombobox-globalVariable-",
  recordLookupsType: "recordLookups",
  recordCreatesType: "recordCreates",
  dataTypeSObject: "SObject",
  isCollectionField: "isCollection",
  actionType: "actionCalls",
  screenComponentType: "screenComponent",
  screenActionType: "screenAction",
  regionContainerName: "Screen_Section"
});

/**
 * Detect the {!...} Flow merge-field syntax.
 * @param {string} value
 * @returns {boolean}
 */
export function isReference(value) {
  if (!value) return false;
  return (
    value.indexOf("{!") === 0 && value.lastIndexOf("}") === value.length - 1
  );
}

/**
 * @param {string} currentText
 * @returns {'String' | 'reference'}
 */
export function getDataType(currentText) {
  return isReference(currentText)
    ? flowComboboxDefaults.referenceDataType
    : flowComboboxDefaults.stringDataType;
}

/**
 * Wrap a value in {!...} when dataType is reference; otherwise return it unchanged.
 * @param {string} value
 * @param {string} dataType
 */
export function formattedValue(value, dataType) {
  if (isReference(value)) return value;
  return dataType === flowComboboxDefaults.referenceDataType
    ? `{!${value}}`
    : value;
}

/**
 * Strip the {!...} wrapping, returning the bare reference path.
 * Idempotent on plain values.
 * @param {string} value
 */
export function removeFormatting(value) {
  if (!value) return value;
  if (!isReference(value)) return value;
  return value.substring(0, value.lastIndexOf("}")).replace("{!", "");
}
