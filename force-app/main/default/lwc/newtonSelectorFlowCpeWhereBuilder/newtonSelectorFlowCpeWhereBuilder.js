import { LightningElement, api } from "lwc";
import searchLookupDatasetFieldsForObject from "@salesforce/apex/NewtonSelectorFlowCpeController.searchLookupDatasetFieldsForObject";
import {
  loadErrorMessage,
  readResourceValue
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
// Longest first, so "<=" wins over "<".
const PARSED_OPERATORS = [
  "!=",
  "<>",
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

let _nodeSeq = 0;

// ── Serialization ────────────────────────────────────────────

function escapeString(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function quote(s) {
  return `'${escapeString(s)}'`;
}

function isMergeField(value) {
  return value.startsWith("{!") || value.startsWith("{$");
}

export function serializeValue(raw, fieldType, operator) {
  const bucket = typeBucket(fieldType);
  const str = String(raw);
  if (isMergeField(str)) return str;
  if (LIST_OPERATORS.has(operator)) {
    const items = str
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    return `(${items.map((v) => (bucket === "number" ? v : quote(v))).join(", ")})`;
  }
  if (bucket === "boolean") {
    return str.toUpperCase() === "TRUE" ? "TRUE" : "FALSE";
  }
  if (bucket === "number" || bucket === "date") return str;
  if (operator === "LIKE" && !str.includes("%") && !str.includes("_")) {
    return quote(`%${str}%`);
  }
  return quote(str);
}

function isBlank(value) {
  return value === "" || value == null;
}

// A condition the admin hasn't touched (no field, no value) is a starter row,
// not a mistake: it adds nothing to the clause and shows no error.
function isIncompleteCondition(condition) {
  if (!condition.field && isBlank(condition.value)) return false;
  return !condition.field || !condition.operator || isBlank(condition.value);
}

/** The WHERE clause for a condition tree; incomplete conditions are left out. */
export function treeToWhere(node) {
  if (node.type === "condition") {
    if (!node.field || !node.operator || isBlank(node.value)) return "";
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

function normalizeValue(raw, operator) {
  if (raw.startsWith("'")) {
    const value = unquote(raw);
    return operator === "LIKE" && /^%.*%$/.test(value)
      ? value.slice(1, -1)
      : value;
  }
  if (raw.startsWith("(")) {
    return raw
      .slice(1, -1)
      .split(",")
      .map((item) => {
        const t = item.trim();
        return t.startsWith("'") ? unquote(t) : t;
      })
      .join(", ");
  }
  return raw;
}

/**
 * Parse a SOQL WHERE clause into the builder's condition tree. Parentheses
 * become groups. Returns null when the clause can't be shown visually
 * (mixed AND/OR without parentheses, NOT, functions, unknown operators).
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
    while (pos < s.length && /[\w.]/.test(s[pos])) pos++;
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
    const normalizedOperator = operator === "<>" ? "!=" : operator;
    return newCondition({
      field,
      operator: normalizedOperator,
      value: normalizeValue(value(), normalizedOperator)
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
  _rawFieldMap = {};
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

  get hasIncompleteCondition() {
    return (
      !this.manualMode &&
      flattenConditionNodes(this.tree).some(isIncompleteCondition)
    );
  }

  // The builder's one live region: a field load failure, or what blocks Save.
  get statusMessage() {
    if (this.fieldLoadError) return this.fieldLoadError;
    return this.hasIncompleteCondition ? INCOMPLETE_MESSAGE : "";
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
    const selected = this.selectedNodeIds.includes(node.id);
    const count = flattenConditionNodes(node).length;
    return {
      id: node.id,
      key: node.id,
      isGroup: true,
      isCondition: false,
      logicSegments: logicSegments(node.operator),
      title: `Group ${number}`,
      selectLabel: `Select group ${number}`,
      countLabel: `${count} condition${count === 1 ? "" : "s"}`,
      selected,
      rowClass: selected
        ? "cc-where-node cc-where-node_group cc-where-node_selected"
        : "cc-where-node cc-where-node_group",
      style: `--cc-depth: ${depth};`
    };
  }

  _conditionRow(c, number, depth) {
    const selected = this.selectedNodeIds.includes(c.id);
    const incomplete = isIncompleteCondition(c);
    let rowClass = "cc-where-node cc-where-node_condition";
    if (selected) rowClass += " cc-where-node_selected";
    else if (incomplete) rowClass += " cc-where-node_warning";
    return {
      id: c.id,
      key: c.id,
      isGroup: false,
      isCondition: true,
      number,
      numberTitle: `Condition ${number}`,
      selectLabel: `Select condition ${number}`,
      operator: c.operator,
      value: c.value,
      operatorOptions: operatorsForType(c._fieldType),
      isBooleanValue: typeBucket(c._fieldType) === "boolean",
      booleanOptions: BOOLEAN_OPTIONS,
      fieldSelection: c.field
        ? {
            id: c.field,
            title: this._rawFieldMap[c.field.toLowerCase()]?.label || c.field,
            subtitle: "",
            icon: "type"
          }
        : null,
      selected,
      hasError: incomplete,
      rowClass,
      style: `--cc-depth: ${depth};`
    };
  }

  connectedCallback() {
    this._connected = true;
    if (this._objectApiName && !this._loadedObject) {
      this._loadFieldOptions();
    }
    if (!this._initialized) {
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
  }

  _refreshFieldTypes() {
    const refresh = (node) => {
      if (node.type === "condition") {
        return {
          ...node,
          _fieldType: this._resolveFieldType(node.field) || node._fieldType
        };
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
      .filter((row) => row.isCondition && selected.has(row.id))
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
    this.selectedNodeIds = this.selectedNodeIds.filter((value) => value !== id);
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
    const lu = event.currentTarget;
    const obj = this._objectApiName;
    if (!obj) {
      lu.setSearchResults([]);
      return;
    }
    searchLookupDatasetFieldsForObject({
      objectApiName: obj,
      searchKey: event.detail.rawSearchTerm || ""
    })
      .then((rows) => {
        this.fieldLoadError = "";
        lu.setSearchResults(rows);
      })
      .catch((error) => {
        this.fieldLoadError = loadErrorMessage("fields", error);
        lu.setSearchResults([]);
      });
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
      value: readResourceValue(event)
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
    if (!obj) {
      this._rawFieldMap = {};
      this._loadedObject = "";
      return;
    }
    if (obj === this._loadedObject) return;
    searchLookupDatasetFieldsForObject({ objectApiName: obj, searchKey: "" })
      .then((rows) => {
        if (!this._connected || this._objectApiName !== obj) return;
        this._rawFieldMap = {};
        rows.forEach((r) => {
          this._rawFieldMap[r.value.toLowerCase()] = {
            label: r.label || r.value,
            type: r.type || ""
          };
        });
        this._loadedObject = obj;
        this.fieldLoadError = "";
        this._refreshFieldTypes();
      })
      .catch((error) => {
        if (this._objectApiName === obj) {
          this.fieldLoadError = loadErrorMessage("fields", error);
        }
      });
  }

  _resolveFieldType(fieldApiName) {
    if (!fieldApiName) return "";
    return this._rawFieldMap[fieldApiName.toLowerCase()]?.type || "";
  }

  // Emits the clause built from the complete conditions only, and whether any
  // condition is partly filled in (which blocks Save in the editor).
  _emitChange() {
    this._value = treeToWhere(this.tree);
    this._dispatchChange();
  }

  _dispatchChange() {
    this.dispatchEvent(
      new CustomEvent("change", {
        detail: {
          value: this._value,
          incomplete: this.hasIncompleteCondition
        }
      })
    );
  }
}
