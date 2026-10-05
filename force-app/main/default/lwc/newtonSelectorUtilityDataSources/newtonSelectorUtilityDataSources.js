import rowFallbackLabel from "@salesforce/label/c.Newton_Selector_RowFallback";

const EMPTY = "";
export const MANUAL_INPUT_VALUE = "__newton_manual_input__";
// Picklist values for objects without record types come from the master record type.
export const MASTER_RECORD_TYPE_ID = "012000000000000AAA";

/**
 * Fills the {0}, {1}… placeholders of a Custom Label, so a translation can
 * put the values wherever its grammar needs them.
 */
export function formatLabel(label, ...values) {
  return label.replace(/\{(\d+)\}/g, (placeholder, index) => {
    return index < values.length ? String(values[index]) : placeholder;
  });
}

/**
 * Reads the message of an Apex or UI API error. UI API read errors carry an
 * array of { errorCode, message } in `body`; Apex errors carry `body.message`.
 */
export function errorMessageOf(error, fallback) {
  const body = error?.body;
  const message = Array.isArray(body)
    ? body
        .map((entry) => entry?.message)
        .filter(Boolean)
        .join(", ")
    : body?.message;
  return message || error?.message || fallback;
}

// Every mapped field becomes text, like the SOQL source's Apex mapping, so a
// Number 0 or Checkbox false is a value of its own and matches the string
// values the layouts compare against.
function safeGet(record, fieldPath) {
  if (!record || !fieldPath) return EMPTY;
  const value = record[fieldPath];
  return value === undefined || value === null ? EMPTY : String(value);
}

export function normalizePicklist(picklistValues, valueSource) {
  const useLabel = valueSource === "label";
  return picklistValues.values.map((entry, index) => {
    const resolvedValue = useLabel ? entry.label : entry.value;
    return {
      id: `pl-${resolvedValue}-${index}`,
      label: entry.label,
      sublabel: EMPTY,
      icon: EMPTY,
      badge: EMPTY,
      helpText: EMPTY,
      value: resolvedValue
    };
  });
}

export function normalizeCollection(records, fieldMap) {
  return records.map((record, index) => ({
    id: safeGet(record, "Id") || `col-${index}`,
    label:
      safeGet(record, fieldMap.label) ||
      formatLabel(rowFallbackLabel, index + 1),
    sublabel: safeGet(record, fieldMap.sublabel),
    icon: safeGet(record, fieldMap.icon),
    badge: safeGet(record, fieldMap.badge),
    helpText: safeGet(record, fieldMap.helpText),
    value:
      safeGet(record, fieldMap.value) || safeGet(record, "Id") || String(index),
    record
  }));
}

export function normalizeCustom(customItems) {
  if (!Array.isArray(customItems)) return [];
  return customItems
    .filter((item) => item?.hidden !== true)
    .map((item, index) => ({
      id: `cu-${index}`,
      label: item.label || EMPTY,
      sublabel: item.sublabel || EMPTY,
      icon: item.icon || EMPTY,
      badge: item.badge || EMPTY,
      helpText: item.helpText || EMPTY,
      value:
        item.value !== undefined && item.value !== null
          ? String(item.value)
          : String(index)
    }));
}

export function filterItems(items, searchTerm) {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return items;
  return items.filter((item) => {
    const haystack =
      `${item.label} ${item.sublabel} ${item.helpText}`.toLowerCase();
    return haystack.includes(term);
  });
}

export const OVERRIDE_TEXT_FIELDS = [
  "label",
  "sublabel",
  "icon",
  "badge",
  "helpText"
];

export function applyOverrides(items, overrides) {
  return items
    .map((item) => {
      const ov = overrides[item.value];
      if (!ov) return item;
      if (ov.hidden === true) return null;
      const next = { ...item };
      for (const field of OVERRIDE_TEXT_FIELDS) {
        const val = ov[field];
        if (val !== undefined && val !== null && val !== EMPTY) {
          next[field] = val;
        }
      }
      return next;
    })
    .filter(Boolean);
}

/**
 * Convert an SLDS 2 spacing token ('1' through '12') to a CSS expression.
 * Anything else (empty, 'none', or not a token) is 0.
 */
export function tokenToCss(token) {
  const str = String(token ?? "").trim();
  return /^\d+$/.test(str) ? `var(--slds-g-spacing-${str}, 0)` : "0";
}

/**
 * Post-fetch display transform: sort then limit.
 * - sortBy: 'none' | 'label' | 'value' (default 'none' — preserves source order)
 * - sortDirection: 'asc' | 'desc' (default 'asc')
 * - limit: positive integer (optional — no cap if falsy)
 */
export function applyDisplay(items, display) {
  const { sortBy, sortDirection, limit } = display;
  let out = items;
  if (sortBy === "label" || sortBy === "value") {
    const collator = new Intl.Collator(undefined, {
      sensitivity: "base",
      numeric: true
    });
    const dir = sortDirection === "desc" ? -1 : 1;
    out = [...items].sort(
      (a, b) =>
        dir *
        collator.compare(String(a?.[sortBy] ?? ""), String(b?.[sortBy] ?? ""))
    );
  }
  const cap = Number(limit);
  if (Number.isFinite(cap) && cap > 0 && out.length > cap) {
    out = out.slice(0, cap);
  }
  return out;
}
