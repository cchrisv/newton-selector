import { LightningElement, api } from "lwc";
import getObjectFields from "@salesforce/apex/NewtonSelectorFlowCpeController.getObjectFields";
import {
  fieldsToOptions,
  filterFieldOptions,
  isReference,
  loadErrorMessage
} from "c/newtonSelectorFlowCpeUtilityHelpers";

// ── Field types ──────────────────────────────────────────────
// Field rows carry `type` as a Schema.DisplayType name; the builder groups
// those into buckets that decide operators, value input, and quoting.

const TYPE_BUCKETS = Object.freeze({
  STRING: "text",
  TEXTAREA: "text",
  URL: "text",
  EMAIL: "text",
  PHONE: "text",
  ENCRYPTEDSTRING: "text",
  INTEGER: "number",
  LONG: "number",
  DOUBLE: "number",
  CURRENCY: "number",
  PERCENT: "number",
  BOOLEAN: "boolean",
  DATE: "date",
  DATETIME: "date",
  TIME: "date",
  PICKLIST: "picklist",
  COMBOBOX: "picklist",
  MULTIPICKLIST: "multipicklist",
  REFERENCE: "reference",
  ID: "reference"
});

function typeBucket(fieldType) {
  return TYPE_BUCKETS[String(fieldType || "").toUpperCase()] || "text";
}

const toOptions = (...values) =>
  values.map((value) => ({ label: value, value }));

const COMPARISON_OPERATORS = toOptions("=", "!=", "<", ">", "<=", ">=");
const OPERATORS_BY_BUCKET = Object.freeze({
  text: toOptions("=", "!=", "LIKE", "IN", "NOT IN"),
  number: COMPARISON_OPERATORS,
  date: COMPARISON_OPERATORS,
  boolean: toOptions("=", "!="),
  picklist: toOptions("=", "!=", "IN", "NOT IN"),
  reference: toOptions("=", "!=", "IN", "NOT IN"),
  multipicklist: toOptions("INCLUDES", "EXCLUDES")
});
const LIST_OPERATORS = new Set(["IN", "NOT IN", "INCLUDES", "EXCLUDES"]);
// Buckets whose values (typed or merged) are written bare; the rest are quoted.
const UNQUOTED_BUCKETS = new Set(["number", "date", "boolean"]);
// Longest first, so "<=" wins over "<".
const PARSED_OPERATORS = [
  "!=",
  "<=",
  ">=",
  "=",
  "<",
  ">",
  "NOT IN",
  "LIKE",
  "IN",
  "INCLUDES",
  "EXCLUDES"
];
// A quoted string, IN list, or merge field runs to its closing character.
const VALUE_CLOSERS = Object.freeze({ "'": "'", "(": ")", "{": "}" });

export function operatorsForType(fieldType) {
  return OPERATORS_BY_BUCKET[typeBucket(fieldType)];
}

const LOGIC_OPTIONS = toOptions("AND", "OR");
const BOOLEAN_OPTIONS = toOptions("TRUE", "FALSE");
const INCOMPLETE_MESSAGE =
  "Finish or remove the highlighted condition. You can't save until then.";
const INCOMPLETE_ROW_MESSAGE =
  "Finish this condition: choose a field, an operator, and a value.";
const LIST_MERGE_MESSAGE =
  "IN, NOT IN, INCLUDES and EXCLUDES need typed values. Remove the Flow resource or choose another operator.";

// The literal formats Apex accepts per field type (NewtonSelectorQueryValueUtil).
const WHOLE_NUMBER = { pattern: /^-?\d+$/, expected: "a whole number" };
const DECIMAL_NUMBER = {
  pattern: /^-?\d+(\.\d+)?$/,
  expected: "a number such as 1500 or 12.5"
};

// A yyyy-MM-dd text names a real day only if it survives a UTC round trip:
// 2026-02-30 rolls over to March and so fails.
function isCalendarDate(text) {
  const date = new Date(`${text}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
  );
}

// The date part must be a real day and the clock in range (HH 00-23,
// mm and ss 00-59), the same bounds a TIME value is held to.
function isCalendarDateTime(text) {
  const hours = Number(text.slice(11, 13));
  const minutes = Number(text.slice(14, 16));
  const seconds = Number(text.slice(17, 19));
  return (
    isCalendarDate(text.slice(0, 10)) &&
    hours <= 23 &&
    minutes <= 59 &&
    seconds <= 59
  );
}

const VALUE_FORMATS = Object.freeze({
  INTEGER: WHOLE_NUMBER,
  LONG: WHOLE_NUMBER,
  DOUBLE: DECIMAL_NUMBER,
  CURRENCY: DECIMAL_NUMBER,
  PERCENT: DECIMAL_NUMBER,
  DATE: {
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    isValid: isCalendarDate,
    expected: "a date as yyyy-MM-dd"
  },
  DATETIME: {
    pattern:
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/,
    isValid: isCalendarDateTime,
    expected: "a date and time as yyyy-MM-ddTHH:mm:ssZ"
  },
  TIME: {
    pattern: /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{3}Z)?$/,
    expected: "a time as HH:mm:ss"
  }
});

let _nodeSeq = 0;

// ── Serialization ────────────────────────────────────────────

function escapeString(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function quote(s) {
  return `'${escapeString(s)}'`;
}

function listItems(value) {
  return String(value)
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function serializeValue(raw, fieldType, operator) {
  const bucket = typeBucket(fieldType);
  const str = String(raw);
  // Flow splices the resolved value into the stored text, so a text merge
  // field is quoted to stay one literal.
  if (isReference(str)) return UNQUOTED_BUCKETS.has(bucket) ? str : quote(str);
  if (LIST_OPERATORS.has(operator)) {
    const items = listItems(str);
    return `(${(bucket === "number" ? items : items.map(quote)).join(", ")})`;
  }
  if (bucket === "boolean") {
    return str.toUpperCase() === "TRUE" ? "TRUE" : "FALSE";
  }
  if (UNQUOTED_BUCKETS.has(bucket)) return str;
  if (operator === "LIKE" && !str.includes("%") && !str.includes("_")) {
    return quote(`%${str}%`);
  }
  return quote(str);
}

function isBlank(value) {
  return value === "" || value == null;
}

// Why Apex can't read a complete condition's value, or "" when it can.
// Merge fields resolve at run time, so only typed values are format-checked.
// A NULL value can't be read back visually, so NULL comparisons belong in the
// Manual WHERE clause.
function invalidValueMessage(condition) {
  const value = String(condition.value).trim();
  if (LIST_OPERATORS.has(condition.operator)) {
    const items = listItems(value);
    if (items.some(isReference)) return LIST_MERGE_MESSAGE;
    return invalidFormatMessage(condition, items);
  }
  return isReference(value) ? "" : invalidFormatMessage(condition, [value]);
}

function invalidFormatMessage(condition, items) {
  const format = VALUE_FORMATS[String(condition._fieldType).toUpperCase()];
  if (!format) return "";
  const valid = items.every(
    (item) =>
      format.pattern.test(item) && (!format.isValid || format.isValid(item))
  );
  return valid
    ? ""
    : `Enter ${format.expected} for ${condition.field}, or pick a resource.`;
}

// What blocks Save for a condition, or "". A condition the admin hasn't
// touched (no field, no value) is a starter row, not a mistake: it adds
// nothing to the clause and shows no error.
function conditionError(condition) {
  if (!condition.field && isBlank(condition.value)) return "";
  if (!condition.field || !condition.operator || isBlank(condition.value)) {
    return INCOMPLETE_ROW_MESSAGE;
  }
  return invalidValueMessage(condition);
}

/** The WHERE clause for a condition tree; conditions with an error are left out. */
export function treeToWhere(node) {
  if (node.type === "condition") {
    if (!node.field || conditionError(node)) return "";
    return `${node.field} ${node.operator} ${serializeValue(
      node.value,
      node._fieldType,
      node.operator
    )}`;
  }
  const parts = node.children.map(treeToWhere).filter(Boolean);
  if (!parts.length) return "";
  const joined = parts.join(` ${node.operator} `);
  return node.id === "root" || parts.length === 1 ? joined : `(${joined})`;
}

// ── Parsing ──────────────────────────────────────────────────

function newCondition(overrides = {}) {
  return {
    id: `c${++_nodeSeq}`,
    type: "condition",
    field: "",
    operator: "=",
    value: "",
    _fieldType: "",
    ...overrides
  };
}

function newGroup(operator, children, id = `g${++_nodeSeq}`) {
  return { id, type: "group", operator, children };
}

function unquote(value) {
  return value.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
}

// A value serializeValue can't write back unchanged keeps the clause in
// Manual mode, so an edit elsewhere never changes what it matches.
function cannotRebuild() {
  throw new Error("Clause can't be shown visually");
}

// Splits an IN/INCLUDES body on the commas outside quotes, keeping escapes.
function splitListItems(body) {
  const items = [];
  let current = "";
  let inQuote = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "\\") {
      current += ch + (body[i + 1] || "");
      i++;
    } else if (ch === "," && !inQuote) {
      items.push(current.trim());
      current = "";
    } else {
      if (ch === "'") inQuote = !inQuote;
      current += ch;
    }
  }
  items.push(current.trim());
  return items;
}

function normalizeListValue(body) {
  return splitListItems(body)
    .map((token) => {
      const item = token.startsWith("'") ? unquote(token) : token;
      // The comma-separated value box can't hold commas, blanks, padded
      // items or a null bind.
      if (
        !item ||
        item.includes(",") ||
        item !== item.trim() ||
        /^null$/i.test(token)
      ) {
        cannotRebuild();
      }
      return item;
    })
    .join(", ");
}

// serializeValue wraps LIKE text that has no % or _ in %…%, so only that
// shape reads back unwrapped, and plain text can't stay an exact match. It
// also doubles backslashes, which would turn an escaped \% or \_ into a
// literal backslash followed by a wildcard.
function normalizeLikeValue(value) {
  if (/\\[%_]/.test(value)) cannotRebuild();
  const inner = /^%[^%_]+%$/.test(value) ? value.slice(1, -1) : "";
  if (inner && !isReference(inner)) return inner;
  if (!/[%_]/.test(value) && !isReference(value)) cannotRebuild();
  return value;
}

function normalizeValue(raw, operator) {
  if (raw.startsWith("(")) return normalizeListValue(raw.slice(1, -1));
  // A bare NULL is a null bind: the text bucket would quote it and the
  // boolean bucket would turn it into FALSE.
  if (/^null$/i.test(raw)) cannotRebuild();
  const value = raw.startsWith("'") ? unquote(raw) : raw;
  return operator === "LIKE" ? normalizeLikeValue(value) : value;
}

/**
 * Parse a SOQL WHERE clause into the builder's condition tree. Parentheses
 * become groups. Returns null when the clause can't be shown visually
 * (mixed AND/OR without parentheses, NOT, functions, unknown operators,
 * relationship paths) or can't be written back unchanged (a bare NULL, a
 * list item containing a comma, an exact-match LIKE, an escaped LIKE wildcard).
 */
export function parseWhere(str) {
  const s = String(str || "").trim();
  if (!s) return null;
  let pos = 0;

  const fail = () => {
    throw new Error("Unparseable WHERE clause");
  };
  const skipWs = () => {
    while (pos < s.length && /\s/.test(s[pos])) pos++;
  };
  const keyword = (word) => {
    skipWs();
    const end = pos + word.length;
    if (s.slice(pos, end).toUpperCase() !== word) return false;
    if (end < s.length && /\w/.test(s[end])) return false;
    pos = end;
    return true;
  };

  // Moves past `close`, skipping escapes and quoted strings inside lists.
  function readUntil(close) {
    while (pos < s.length && s[pos] !== close) {
      if (s[pos] === "\\") {
        pos += 2;
      } else if (s[pos] === "'" && close !== "'") {
        pos++;
        readUntil("'");
      } else {
        pos++;
      }
    }
    if (pos >= s.length) fail();
    pos++;
  }

  function value() {
    skipWs();
    const start = pos;
    const close = VALUE_CLOSERS[s[pos]];
    if (close) {
      pos++;
      readUntil(close);
      return s.slice(start, pos);
    }
    while (pos < s.length && /[\w:.\-+]/.test(s[pos])) pos++;
    if (pos === start) fail();
    return s.slice(start, pos);
  }

  function condition() {
    skipWs();
    const fieldStart = pos;
    while (pos < s.length && /\w/.test(s[pos])) pos++;
    const field = s.slice(fieldStart, pos);
    if (!field) fail();
    skipWs();
    const upper = s.slice(pos).toUpperCase();
    const operator = PARSED_OPERATORS.find(
      (op) =>
        upper.startsWith(op) &&
        !(/\w$/.test(op) && /\w/.test(upper[op.length] || ""))
    );
    if (!operator) fail();
    pos += operator.length;
    return newCondition({
      field,
      operator,
      value: normalizeValue(value(), operator)
    });
  }

  function term() {
    skipWs();
    if (s[pos] !== "(") return condition();
    pos++;
    const inner = expression();
    skipWs();
    if (s[pos] !== ")") fail();
    pos++;
    return inner;
  }

  function expression() {
    const operands = [term()];
    let operator = "";
    for (;;) {
      const next = keyword("AND") ? "AND" : keyword("OR") ? "OR" : "";
      if (!next) break;
      if (operator && next !== operator) fail();
      operator = next;
      operands.push(term());
    }
    return operands.length === 1 ? operands[0] : newGroup(operator, operands);
  }

  try {
    const node = expression();
    skipWs();
    if (pos < s.length) return null;
    return node.type === "group"
      ? { ...node, id: "root" }
      : newGroup("AND", [node], "root");
  } catch {
    return null;
  }
}

// ── Tree helpers ─────────────────────────────────────────────

function flattenConditionNodes(node, target = []) {
  if (node.type === "condition") {
    target.push(node);
  } else {
    node.children.forEach((child) => flattenConditionNodes(child, target));
  }
  return target;
}

function cloneTree(node) {
  if (node.type === "condition") return { ...node };
  return { ...node, children: node.children.map(cloneTree) };
}

function findNodeLocation(parent, id) {
  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.id === id) return { parent, index: i, node: child };
    if (child.type === "group") {
      const nested = findNodeLocation(child, id);
      if (nested) return nested;
    }
  }
  return null;
}

function removeNodeById(root, id) {
  const found = findNodeLocation(root, id);
  if (!found) return null;
  return found.parent.children.splice(found.index, 1)[0];
}

function normalizeGroup(group) {
  group.children = group.children
    .map((child) => (child.type === "group" ? normalizeGroup(child) : child))
    .filter((child) => child.type !== "group" || child.children.length > 0);
  return group;
}

function logicSegments(operator) {
  return LOGIC_OPTIONS.map((option) => {
    const selected = operator === option.value;
    return {
      ...option,
      cssClass: selected
        ? "cc-where-segment cc-where-segment_selected"
        : "cc-where-segment",
      ariaPressed: String(selected)
    };
  });
}

function emptyTree() {
  return newGroup("AND", [newCondition()], "root");
}

export default class NewtonSelectorFlowCpeWhereBuilder extends LightningElement {
  @api builderContext;
  @api automaticOutputVariables;

  tree = emptyTree();
  selectedNodeIds = [];
  manualMode = false;
  manualWhere = "";
  dragNodeId = "";
  fieldLoadError = "";

  _loadedObject = "";
  // Every field of the object, by lower-case API name, for types and labels.
  _fieldMap = {};
  // The filterable fields: the only ones the Field picker offers.
  _fieldOptions = [];
  _initialized = false;
  _connected = false;
  _objectApiName = "";
  _value = "";

  @api
  get objectApiName() {
    return this._objectApiName;
  }
  set objectApiName(v) {
    const next = v == null ? "" : String(v).trim();
    if (next === this._objectApiName) return;
    this._objectApiName = next;
    this._fieldMap = {};
    this._fieldOptions = [];
    this._loadedObject = "";
    this.fieldLoadError = "";
    // Conditions belong to the old object: rebuild them from the parent's
    // clause, which DataConfig clears when the object changes.
    if (this._initialized) this._initFromValue();
    if (this._connected) this._loadFieldOptions();
  }

  @api
  get value() {
    return this._value;
  }
  set value(v) {
    const next = v == null ? "" : String(v);
    if (next === this._value) return;
    this._value = next;
    this._initFromValue();
  }

  get rootLogicSegments() {
    return logicSegments(this.tree.operator);
  }

  get hasSelection() {
    return this.selectedNodeIds.length > 0;
  }

  get selectedCount() {
    return this.selectedNodeIds.length;
  }

  get groupSelectionDisabled() {
    return this.selectedNodeIds.length < 2;
  }

  get hasConditionError() {
    return (
      !this.manualMode &&
      flattenConditionNodes(this.tree).some((c) => conditionError(c))
    );
  }

  // The builder's one live region: a field load failure, or what blocks Save.
  get statusMessage() {
    if (this.fieldLoadError) return this.fieldLoadError;
    return this.hasConditionError ? INCOMPLETE_MESSAGE : "";
  }

  get builderRows() {
    const conditions = flattenConditionNodes(this.tree);
    const rows = [];
    let groupCount = 0;
    const visit = (node, depth) => {
      if (node.type === "group" && node.id !== "root") {
        groupCount++;
        rows.push(this._groupRow(node, depth, groupCount));
      }
      node.children.forEach((child) => {
        if (child.type === "group") {
          visit(child, node.id === "root" ? depth : depth + 1);
        } else {
          rows.push(
            this._conditionRow(child, conditions.indexOf(child) + 1, depth)
          );
        }
      });
    };
    visit(this.tree, 0);
    return rows;
  }

  _groupRow(node, depth, number) {
    const count = flattenConditionNodes(node).length;
    return {
      id: node.id,
      key: node.id,
      isGroup: true,
      isCondition: false,
      logicSegments: logicSegments(node.operator),
      title: `Group ${number}`,
      countLabel: `${count} condition${count === 1 ? "" : "s"}`,
      rowClass: "cc-where-node cc-where-node_group",
      style: `--cc-depth: ${depth};`
    };
  }

  _conditionRow(c, number, depth) {
    const selected = this.selectedNodeIds.includes(c.id);
    const error = conditionError(c);
    let rowClass = "cc-where-node cc-where-node_condition";
    if (selected) rowClass += " cc-where-node_selected";
    else if (error) rowClass += " cc-where-node_warning";
    return {
      id: c.id,
      key: c.id,
      isGroup: false,
      isCondition: true,
      number,
      selectLabel: `Select condition ${number}`,
      operator: c.operator,
      value: c.value,
      operatorOptions: operatorsForType(c._fieldType),
      isBooleanValue: typeBucket(c._fieldType) === "boolean",
      booleanOptions: BOOLEAN_OPTIONS,
      fieldSelection: this._fieldSelection(c.field),
      selected,
      errorMessage: error,
      rowClass,
      style: `--cc-depth: ${depth};`
    };
  }

  connectedCallback() {
    this._connected = true;
    if (this._objectApiName && !this._loadedObject) {
      this._loadFieldOptions();
    }
    if (this._initialized) {
      this._dispatchValidity();
    } else {
      this._initFromValue();
    }
  }

  disconnectedCallback() {
    this._connected = false;
  }

  _initFromValue() {
    this._initialized = true;
    this.selectedNodeIds = [];
    const tree = parseWhere(this._value);
    this.manualMode = Boolean(this._value) && !tree;
    this.manualWhere = this.manualMode ? this._value : "";
    this.tree = tree || emptyTree();
    this._refreshFieldTypes();
    if (this._connected) this._dispatchValidity();
  }

  _refreshFieldTypes() {
    const refresh = (node) => {
      if (node.type === "condition") {
        return { ...node, _fieldType: this._resolveFieldType(node.field) };
      }
      return { ...node, children: node.children.map(refresh) };
    };
    this.tree = refresh(this.tree);
  }

  _updateCondition(id, patch) {
    const update = (node) => {
      if (node.type === "condition") {
        return node.id === id ? { ...node, ...patch } : node;
      }
      return { ...node, children: node.children.map(update) };
    };
    this.tree = update(this.tree);
  }

  _updateGroup(id, patch) {
    const update = (node) => {
      if (node.type === "group") {
        const next = node.id === id ? { ...node, ...patch } : node;
        return { ...next, children: next.children.map(update) };
      }
      return node;
    };
    this.tree = update(this.tree);
  }

  // Applies `mutate` to a copy of the tree, tidies empty groups, and emits.
  _restructure(mutate) {
    const root = cloneTree(this.tree);
    if (mutate(root) === false) return;
    this.tree = normalizeGroup(root);
    this._emitChange();
  }

  handleRootOperatorChange(event) {
    this.tree = { ...this.tree, operator: event.currentTarget.dataset.value };
    this._emitChange();
  }

  handleGroupOperatorChange(event) {
    this._updateGroup(event.currentTarget.dataset.id, {
      operator: event.currentTarget.dataset.value
    });
    this._emitChange();
  }

  handleNodeSelect(event) {
    const id = event.currentTarget.dataset.id;
    const selected = new Set(this.selectedNodeIds);
    if (event.target.checked) {
      selected.add(id);
    } else {
      selected.delete(id);
    }
    this.selectedNodeIds = Array.from(selected);
  }

  handleClearSelection() {
    this.selectedNodeIds = [];
  }

  handleGroupSelected() {
    const selected = new Set(this.selectedNodeIds);
    const orderedIds = this.builderRows
      .filter((row) => selected.has(row.id))
      .map((row) => row.id);
    this._restructure((root) => {
      const nodes = orderedIds
        .map((id) => removeNodeById(root, id))
        .filter(Boolean);
      if (nodes.length < 2) return false;
      root.children.push(newGroup("AND", nodes));
      return true;
    });
    this.selectedNodeIds = [];
  }

  handleUngroup(event) {
    const id = event.currentTarget.dataset.id;
    this._restructure((root) => {
      const found = findNodeLocation(root, id);
      found.parent.children.splice(found.index, 1, ...found.node.children);
      return true;
    });
  }

  handleGroupWithNext(event) {
    const id = event.currentTarget.dataset.id;
    this._restructure((root) => {
      const found = findNodeLocation(root, id);
      if (found.index >= found.parent.children.length - 1) return false;
      const pair = found.parent.children.splice(found.index, 2);
      found.parent.children.splice(found.index, 0, newGroup("AND", pair));
      return true;
    });
  }

  handleMoveNode(event) {
    const { id, direction } = event.currentTarget.dataset;
    this._restructure((root) => {
      const found = findNodeLocation(root, id);
      const nextIndex = direction === "up" ? found.index - 1 : found.index + 1;
      if (nextIndex < 0 || nextIndex >= found.parent.children.length) {
        return false;
      }
      const [node] = found.parent.children.splice(found.index, 1);
      found.parent.children.splice(nextIndex, 0, node);
      return true;
    });
  }

  handleIndentNode(event) {
    const id = event.currentTarget.dataset.id;
    this._restructure((root) => {
      const found = findNodeLocation(root, id);
      const previous = found.parent.children[found.index - 1];
      if (previous?.type !== "group") return false;
      const [node] = found.parent.children.splice(found.index, 1);
      previous.children.push(node);
      return true;
    });
  }

  handleOutdentNode(event) {
    const id = event.currentTarget.dataset.id;
    this._restructure((root) => {
      const found = findNodeLocation(root, id);
      if (found.parent.id === "root") return false;
      const parentLocation = findNodeLocation(root, found.parent.id);
      const [node] = found.parent.children.splice(found.index, 1);
      parentLocation.parent.children.splice(parentLocation.index + 1, 0, node);
      return true;
    });
  }

  handleDragStart(event) {
    this.dragNodeId = event.currentTarget.dataset.id;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", this.dragNodeId);
  }

  handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  handleDrop(event) {
    event.preventDefault();
    const sourceId =
      this.dragNodeId || event.dataTransfer.getData("text/plain") || "";
    const targetId = event.currentTarget.dataset.id;
    this.dragNodeId = "";
    if (!sourceId || sourceId === targetId) return;
    this._restructure((root) => {
      const source = removeNodeById(root, sourceId);
      const target = findNodeLocation(root, targetId);
      if (!source || !target) return false;
      if (target.node.type === "group") {
        target.node.children.push(source);
      } else {
        target.parent.children.splice(target.index, 0, source);
      }
      return true;
    });
  }

  handleManualInput(event) {
    this.manualWhere = event.target.value || "";
    this._value = this.manualWhere;
    this._dispatchChange();
  }

  handleRebuildVisual() {
    this._initFromValue();
    if (!this.manualMode) this._emitChange();
  }

  handleFieldSearch(event) {
    event.currentTarget.setSearchResults(
      filterFieldOptions(this._fieldOptions, event.detail.rawSearchTerm)
    );
  }

  handleFieldSelectionChange(event) {
    const lu = event.currentTarget;
    const id = lu.dataset.id;
    const row = lu.getSelection()[0];
    const fieldName = row?.id ? String(row.id) : "";
    const fieldType = this._resolveFieldType(fieldName);
    const ops = operatorsForType(fieldType);
    const current = flattenConditionNodes(this.tree).find(
      (item) => item.id === id
    );
    this._updateCondition(id, {
      field: fieldName,
      _fieldType: fieldType,
      operator: ops.some((o) => o.value === current.operator)
        ? current.operator
        : ops[0].value,
      value: ""
    });
    this._emitChange();
  }

  handleOperatorChange(event) {
    this._updateCondition(event.currentTarget.dataset.id, {
      operator: event.detail.value
    });
    this._emitChange();
  }

  handleValueChange(event) {
    this._updateCondition(event.currentTarget.dataset.id, {
      value: event.detail.value
    });
    this._emitChange();
  }

  handleResourceValueChange(event) {
    event.stopPropagation();
    this._updateCondition(event.currentTarget.dataset.id, {
      value: event.detail.newValue
    });
    this._emitChange();
  }

  handleAddCondition() {
    this.tree = {
      ...this.tree,
      children: [...this.tree.children, newCondition()]
    };
    this._emitChange();
  }

  handleRemoveCondition(event) {
    const id = event.currentTarget.dataset.id;
    this._restructure((root) => {
      removeNodeById(root, id);
      if (!flattenConditionNodes(root).length) {
        root.children.push(newCondition());
      }
      return true;
    });
    this.selectedNodeIds = this.selectedNodeIds.filter((value) => value !== id);
  }

  _loadFieldOptions() {
    const obj = this._objectApiName;
    if (!obj || obj === this._loadedObject) return;
    getObjectFields({ objectName: obj })
      .then((fields) => {
        if (!this._connected || this._objectApiName !== obj) return;
        // Apex rejects a filter on a non-filterable field (long text, for
        // example), so the picker never offers one.
        this._fieldOptions = fieldsToOptions(
          fields.filter((field) => field.filterable)
        );
        this._fieldMap = Object.fromEntries(
          fieldsToOptions(fields).map((option) => [
            option.id.toLowerCase(),
            option
          ])
        );
        this._loadedObject = obj;
        this.fieldLoadError = "";
        this._refreshFieldTypes();
        // Format errors depend on the field types, which are known only now.
        this._dispatchValidity();
      })
      .catch((error) => {
        if (this._objectApiName === obj) {
          this.fieldLoadError = loadErrorMessage("fields", error);
        }
      });
  }

  // The lookup shows the field's option (label, subtitle, type icon) once the
  // object's fields load, and the API name until then.
  _fieldSelection(fieldApiName) {
    if (!fieldApiName) return null;
    const option = this._fieldMap[fieldApiName.toLowerCase()];
    return option
      ? {
          id: fieldApiName,
          title: option.title,
          subtitle: option.subtitle,
          icon: option.icon
        }
      : { id: fieldApiName, title: fieldApiName, subtitle: "", icon: "type" };
  }

  _resolveFieldType(fieldApiName) {
    if (!fieldApiName) return "";
    return this._fieldMap[fieldApiName.toLowerCase()]?.type || "";
  }

  // Emits the clause built from the error-free conditions only, and whether
  // any condition is unfinished or invalid (which blocks Save in the editor).
  _emitChange() {
    this._value = treeToWhere(this.tree);
    this._dispatchChange();
  }

  _dispatchChange() {
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: {
          value: this._value,
          incomplete: this.hasConditionError
        }
      })
    );
  }

  // Reports whether the loaded clause blocks Save, without re-emitting it.
  _dispatchValidity() {
    this.dispatchEvent(
      new CustomEvent("validitychange", {
        detail: { incomplete: this.hasConditionError }
      })
    );
  }
}
