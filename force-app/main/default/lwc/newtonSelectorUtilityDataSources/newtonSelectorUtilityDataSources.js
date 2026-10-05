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

function safeGet(record, fieldPath) {
  if (!record || !fieldPath) return EMPTY;
  const value = record[fieldPath];
  return value === undefined || value === null ? EMPTY : value;
}

export function normalizePicklist(picklistValues, valueSource) {
  if (!picklistValues || !Array.isArray(picklistValues.values)) return [];
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
      value: resolvedValue,
      disabled: false
    };
  });
}

export function normalizeCollection(records, fieldMap) {
  if (!Array.isArray(records)) return [];
  const map = fieldMap || {};
  return records.map((record, index) => ({
    id: safeGet(record, "Id") || `col-${index}`,
    label:
      safeGet(record, map.label) || formatLabel(rowFallbackLabel, index + 1),
    sublabel: safeGet(record, map.sublabel),
    icon: safeGet(record, map.icon),
    badge: safeGet(record, map.badge),
    helpText: safeGet(record, map.helpText),
    value: safeGet(record, map.value) || safeGet(record, "Id") || String(index),
    disabled: false,
    record
  }));
}

export function normalizeSObjectDTO(dtos) {
  if (!Array.isArray(dtos)) return [];
  return dtos.map((dto, index) => ({
    id: dto.id || `so-${index}`,
    label: dto.label || EMPTY,
    sublabel: dto.sublabel || EMPTY,
    icon: dto.icon || EMPTY,
    badge: dto.badge || EMPTY,
    helpText: dto.helpText || EMPTY,
    value: dto.value || dto.id || String(index),
    disabled: false,
    record: dto.record
  }));
}

export function normalizeCustom(customItems) {
  if (!Array.isArray(customItems)) return [];
  return customItems
    .filter((item) => item?.hidden !== true)
    .map((item, index) => ({
      ...item,
      id: item.id || `cu-${index}`,
      label: item.label || EMPTY,
      sublabel: item.sublabel || EMPTY,
      icon: item.icon || EMPTY,
      badge: item.badge || EMPTY,
      helpText: item.helpText || EMPTY,
      value:
        item.value !== undefined && item.value !== null
          ? String(item.value)
          : String(index),
      disabled: Boolean(item.disabled)
    }));
}

export function filterItems(items, searchTerm) {
  if (!Array.isArray(items)) return [];
  const term = (searchTerm || EMPTY).trim().toLowerCase();
  if (!term) return items;
  return items.filter((item) => {
    const haystack =
      `${item.label} ${item.sublabel} ${item.helpText}`.toLowerCase();
    return haystack.includes(term);
  });
}

const OVERRIDE_FIELDS = ["label", "sublabel", "icon", "badge", "helpText"];

export function applyOverrides(items, overrides) {
  if (!Array.isArray(items)) return [];
  if (!overrides || typeof overrides !== "object") return items;
  return items
    .map((item) => {
      const ov = overrides[item.value];
      if (!ov) return item;
      if (ov.hidden === true) return null;
      const next = { ...item };
      for (const field of OVERRIDE_FIELDS) {
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
  if (!Array.isArray(items)) return [];
  if (!display || typeof display !== "object") return items;
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
