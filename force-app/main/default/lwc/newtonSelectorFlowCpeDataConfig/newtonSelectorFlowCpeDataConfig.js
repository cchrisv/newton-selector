import { api, LightningElement, track, wire } from "lwc";
import { getObjectInfo, getPicklistValues } from "lightning/uiObjectInfoApi";
import {
  DEFAULT_QUERY_LIMIT,
  MAX_QUERY_LIMIT,
  defaultSelectorConfig
} from "c/newtonSelectorUtilityConfigDefaults";
import {
  MASTER_RECORD_TYPE_ID,
  OVERRIDE_TEXT_FIELDS,
  errorMessageOf,
  normalizePicklist
} from "c/newtonSelectorUtilityDataSources";
import { loadErrorMessage } from "c/newtonSelectorFlowCpeUtilityHelpers";
import {
  hasFlowValues,
  recordCollectionObjectType,
  whereClauseWithSampleFlowValues
} from "c/newtonSelectorFlowCpeUtilityConfigState";
import {
  ORDER_DIRECTION_OPTIONS,
  PICKLIST_VALUE_SOURCE_OPTIONS,
  SORT_BY_OPTIONS,
  SORT_DIRECTION_OPTIONS,
  SOURCE_TILES,
  tileList
} from "c/newtonSelectorFlowCpeUtilityConfigOptions";
import getObjectFields from "@salesforce/apex/NewtonSelectorFlowCpeController.getObjectFields";
import searchSObjectTypes from "@salesforce/apex/NewtonSelectorFlowCpeController.searchSObjectTypes";
import queryItems from "@salesforce/apex/NewtonSelectorRuntimeController.queryItems";
import validateQuery from "@salesforce/apex/NewtonSelectorRuntimeController.validateQuery";

// A blank recordTypeId loads the master record type's values, in the editor
// and at runtime alike.
const MASTER_RECORD_TYPE_VALUE = "__NewtonMasterRecordType__";
const MASTER_RECORD_TYPE_OPTION = {
  label: "Master (all values)",
  value: MASTER_RECORD_TYPE_VALUE,
  subtitle: "Uses every active value of the field",
  icon: "list-checks"
};
const BULK_EDIT_FIELDS = OVERRIDE_TEXT_FIELDS.filter(
  (field) => field !== "label"
);
const OVERRIDE_VISIBLE_INCREMENT = 25;
const OVERRIDE_MODE_ADVANCED = "advanced";
const OVERRIDE_MODE_DEFAULT = "default";
const SOQL_KEYWORDS = new Set([
  "ABOVE",
  "ABOVE_OR_BELOW",
  "AND",
  "ASC",
  "AT",
  "BELOW",
  "BY",
  "DATA",
  "DESC",
  "EXCLUDES",
  "FALSE",
  "FOR",
  "FROM",
  "GROUP",
  "HAVING",
  "IN",
  "INCLUDES",
  "LAST_N_DAYS",
  "LIKE",
  "LIMIT",
  "NOT",
  "NULL",
  "NULLS",
  "OFFSET",
  "OR",
  "ORDER",
  "SELECT",
  "THIS_MONTH",
  "THIS_WEEK",
  "THIS_YEAR",
  "TODAY",
  "TOMORROW",
  "TRUE",
  "UPDATE",
  "VIEW",
  "WHERE",
  "WITH",
  "YESTERDAY"
]);
const SOQL_BOOLEAN_LITERALS = new Set(["TRUE", "FALSE"]);
const SOQL_NULL_LITERALS = new Set(["NULL"]);
const SOQL_OBJECT_CONTEXT_KEYWORDS = new Set(["FROM", "UPDATE"]);

function emptyBulkDraft() {
  return Object.fromEntries(BULK_EDIT_FIELDS.map((field) => [field, ""]));
}

function isObjectRow(row, apiName) {
  return String(row?.value || "").toLowerCase() === apiName.toLowerCase();
}

// The lookup shows exactly the row it is given: the searched row with the
// object's label once known, otherwise the API name.
function objectSelection(row, apiName) {
  if (!apiName) return [];
  return [
    isObjectRow(row, apiName)
      ? row
      : { id: apiName, title: apiName, icon: "box" }
  ];
}

function isIdentifierStart(char) {
  return /[A-Za-z_$]/.test(char);
}

function isIdentifierPart(char) {
  return /[A-Za-z0-9_$]/.test(char);
}

function classifySoqlWord(word, previousSignificantWord, nextChar) {
  const upper = word.toUpperCase();
  if (SOQL_BOOLEAN_LITERALS.has(upper)) return "boolean";
  if (SOQL_NULL_LITERALS.has(upper)) return "null";
  if (SOQL_KEYWORDS.has(upper)) return "keyword";
  if (SOQL_OBJECT_CONTEXT_KEYWORDS.has(previousSignificantWord)) {
    return "object";
  }
  if (nextChar === "(") return "function";
  return word.includes(".") ? "field" : "identifier";
}

function createSoqlToken(text, type, index) {
  return {
    key: `soql-token-${index}`,
    text,
    className: `newton-query-preview__token newton-query-preview__token_${type}`
  };
}

function readSoqlStringLiteral(soql, start) {
  let index = start + 1;
  while (index < soql.length) {
    if (soql[index] === "\\") {
      index += 2;
    } else if (soql[index] === "'") {
      if (soql[index + 1] === "'") {
        index += 2;
      } else {
        index += 1;
        break;
      }
    } else {
      index += 1;
    }
  }
  return index;
}

function readSoqlIdentifier(soql, start) {
  let index = start;
  while (index < soql.length) {
    if (isIdentifierPart(soql[index])) {
      index += 1;
    } else if (soql[index] === "." && isIdentifierStart(soql[index + 1])) {
      index += 1;
    } else {
      break;
    }
  }
  return index;
}

function nextNonWhitespaceChar(soql, start) {
  let index = start;
  while (index < soql.length && /\s/.test(soql[index])) {
    index += 1;
  }
  return soql[index] || "";
}

function highlightSoql(soql) {
  const tokens = [];
  let index = 0;
  let previousSignificantWord = "";

  while (index < soql.length) {
    const char = soql[index];
    const tokenIndex = tokens.length;

    if (/\s/.test(char)) {
      const start = index;
      while (index < soql.length && /\s/.test(soql[index])) {
        index += 1;
      }
      tokens.push(
        createSoqlToken(soql.slice(start, index), "space", tokenIndex)
      );
    } else if (char === "'") {
      const end = readSoqlStringLiteral(soql, index);
      tokens.push(
        createSoqlToken(soql.slice(index, end), "string", tokenIndex)
      );
      index = end;
    } else if (char === "/" && soql[index + 1] === "*") {
      const end = soql.indexOf("*/", index + 2);
      const nextIndex = end === -1 ? soql.length : end + 2;
      tokens.push(
        createSoqlToken(soql.slice(index, nextIndex), "comment", tokenIndex)
      );
      index = nextIndex;
    } else if (
      (char === "-" && soql[index + 1] === "-") ||
      (char === "/" && soql[index + 1] === "/")
    ) {
      const end = soql.indexOf("\n", index + 2);
      const nextIndex = end === -1 ? soql.length : end;
      tokens.push(
        createSoqlToken(soql.slice(index, nextIndex), "comment", tokenIndex)
      );
      index = nextIndex;
    } else if (char === ":" && isIdentifierStart(soql[index + 1])) {
      const end = readSoqlIdentifier(soql, index + 1);
      tokens.push(createSoqlToken(soql.slice(index, end), "bind", tokenIndex));
      index = end;
    } else if (/\d/.test(char)) {
      const start = index;
      while (index < soql.length && /[\d.]/.test(soql[index])) {
        index += 1;
      }
      tokens.push(
        createSoqlToken(soql.slice(start, index), "number", tokenIndex)
      );
    } else if (isIdentifierStart(char)) {
      const end = readSoqlIdentifier(soql, index);
      const word = soql.slice(index, end);
      const type = classifySoqlWord(
        word,
        previousSignificantWord,
        nextNonWhitespaceChar(soql, end)
      );
      tokens.push(createSoqlToken(word, type, tokenIndex));
      previousSignificantWord = word.toUpperCase();
      index = end;
    } else if ("=<>!".includes(char)) {
      const nextIndex = soql[index + 1] === "=" ? index + 2 : index + 1;
      tokens.push(
        createSoqlToken(soql.slice(index, nextIndex), "operator", tokenIndex)
      );
      index = nextIndex;
    } else if (",()".includes(char)) {
      tokens.push(createSoqlToken(char, "punctuation", tokenIndex));
      index += 1;
    } else {
      tokens.push(createSoqlToken(char, "plain", tokenIndex));
      index += 1;
    }
  }

  return tokens;
}

export default class NewtonSelectorFlowCpeDataConfig extends LightningElement {
  @api config;
  @api sourceRecordsRef = "";
  @api builderContext;
  @api automaticOutputVariables;

  @track _picklistValues = [];
  @track _recordTypeOptions = [];
  @track _sobjectSampleRows = [];
  @track _sampleLoadError = "";
  @track _isLoadingSample = false;
  @track _overrideSearch = "";
  @track _expandedOverrideValue = "";
  @track _overrideVisibleLimit = OVERRIDE_VISIBLE_INCREMENT;
  @track _overrideMode = "";
  @track _bulkSelection = {};
  @track _bulkEditDraft = emptyBulkDraft();
  @track _queryValidation = null;
  @track _isValidatingQuery = false;
  _copyStatus = null;
  _sampleIgnoresWhere = false;
  _searchError = "";
  _recordTypeError = "";
  _picklistValuesError = "";
  _picklistObjectRow = null;
  _sobjectRow = null;
  _objectRowRequests = new Set();

  renderedCallback() {
    if (this.isPicklistMode) {
      this.resolveObjectRow(
        "_picklistObjectRow",
        this.config.picklist.objectApiName
      );
    }
    if (this.isSObjectMode) {
      this.resolveObjectRow("_sobjectRow", this.config.sobject.sObjectApiName);
    }
  }

  // A saved config holds only the object's API name, so its label comes from
  // the same search the lookup runs.
  async resolveObjectRow(field, apiName) {
    const request = `${field}:${apiName}`;
    if (
      !apiName ||
      isObjectRow(this[field], apiName) ||
      this._objectRowRequests.has(request)
    ) {
      return;
    }
    this._objectRowRequests.add(request);
    try {
      const rows = await searchSObjectTypes({ searchKey: apiName });
      this[field] = rows.find((row) => isObjectRow(row, apiName)) || null;
    } catch (error) {
      this._searchError = loadErrorMessage("objects", error);
    }
  }

  emit(config) {
    this.dispatchEvent(
      new CustomEvent("configpatch", { detail: { value: config } })
    );
  }

  get hasDataSource() {
    return Boolean(this.config.dataSource);
  }
  get isPicklistMode() {
    return this.config.dataSource === "picklist";
  }
  get isCollectionMode() {
    return this.config.dataSource === "collection";
  }
  get isSObjectMode() {
    return this.config.dataSource === "sobject";
  }
  get isCustomMode() {
    return this.config.dataSource === "custom";
  }
  get canCustomizeValues() {
    return this.isPicklistMode || this.isSObjectMode;
  }

  get sourceTiles() {
    return tileList(SOURCE_TILES, this.config.dataSource);
  }
  get activeSourceTile() {
    return SOURCE_TILES.find((tile) => tile.value === this.config.dataSource);
  }
  get sourceSetupTitle() {
    return `${this.activeSourceTile.label} setup`;
  }
  get sourceKindIcon() {
    return this.activeSourceTile.icon;
  }
  get sourceSetupSubtitle() {
    if (this.isPicklistMode)
      return "Point to an object and pick its picklist field.";
    if (this.isCollectionMode)
      return "Choose a record collection and the fields that fill each option.";
    if (this.isSObjectMode)
      return "Query an object and choose the fields that fill each option.";
    return "";
  }
  get picklistValueSourceOptions() {
    return PICKLIST_VALUE_SOURCE_OPTIONS;
  }
  get sortByOptions() {
    return SORT_BY_OPTIONS;
  }
  get sortDirectionOptions() {
    return SORT_DIRECTION_OPTIONS;
  }
  get orderDirectionOptions() {
    return ORDER_DIRECTION_OPTIONS;
  }

  handleSourceTileChange(event) {
    const value = event.detail?.value;
    if (value && value !== this.config.dataSource) {
      this.resetOverridesForNewSource();
      this._searchError = "";
      this.emit({ ...this.config, dataSource: value, overrides: {} });
      this.dispatchFilterValidity(false);
    }
  }
  // Searches overlap while the admin types; only the latest one per lookup
  // may write its results, or a slow earlier search overwrites a newer one.
  _objectSearchSeq = new Map();

  async handleObjectSearch(event) {
    const lookup = event.currentTarget;
    const seq = (this._objectSearchSeq.get(lookup) || 0) + 1;
    this._objectSearchSeq.set(lookup, seq);
    const isLatest = () => this._objectSearchSeq.get(lookup) === seq;
    try {
      const results = await searchSObjectTypes({
        searchKey: event.detail.searchTerm || ""
      });
      if (!isLatest()) return;
      this._searchError = "";
      lookup.setSearchResults(results);
    } catch (error) {
      if (!isLatest()) return;
      this._searchError = loadErrorMessage("objects", error);
      lookup.setSearchResults([]);
    }
  }
  handlePicklistObjectSelect(event) {
    const objectApiName = event.detail.selectedIds?.[0] || "";
    this._picklistObjectRow = event.currentTarget.getSelection()[0] || null;
    const objectChanged = objectApiName !== this.config.picklist.objectApiName;
    if (objectChanged) this.resetOverridesForNewSource();
    this._recordTypeError = "";
    this._picklistValuesError = "";
    this.emit({
      ...this.config,
      picklist: {
        ...this.config.picklist,
        objectApiName,
        fieldApiName: "",
        recordTypeId: ""
      },
      ...(objectChanged ? { overrides: {} } : {})
    });
  }
  handlePicklistFieldChange(event) {
    const fieldApiName = event.detail.fieldApiName || "";
    const fieldChanged = fieldApiName !== this.config.picklist.fieldApiName;
    if (fieldChanged) this.resetOverridesForNewSource();
    this._picklistValuesError = "";
    this.emit({
      ...this.config,
      picklist: { ...this.config.picklist, fieldApiName },
      ...(fieldChanged ? { overrides: {} } : {})
    });
  }
  handleRecordTypeComboChange(event) {
    const value = event.detail.value;
    this.emit({
      ...this.config,
      picklist: {
        ...this.config.picklist,
        recordTypeId: value === MASTER_RECORD_TYPE_VALUE ? "" : value
      }
    });
  }
  handlePicklistValueSourceChange(event) {
    this.emit({
      ...this.config,
      picklist: {
        ...this.config.picklist,
        valueSource: event.detail.value
      }
    });
  }

  handleCollectionVariableChange(event) {
    const nextRef = event.detail.newValue;
    const nextObject =
      event.detail.objectType ||
      recordCollectionObjectType(this.builderContext, nextRef);
    const currentObject = this.config.collection.objectApiName;
    this.dispatchRefChange("sourceRecordsRef", nextRef);
    this.emit({
      ...this.config,
      collection: {
        ...this.config.collection,
        objectApiName: nextObject || "",
        fieldMap:
          !nextRef || (nextObject && nextObject !== currentObject)
            ? defaultSelectorConfig().collection.fieldMap
            : { ...this.config.collection.fieldMap }
      }
    });
  }
  handleCollectionFieldMapChange(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.fieldApiName;
    this.emit({
      ...this.config,
      collection: {
        ...this.config.collection,
        fieldMap: { ...this.config.collection.fieldMap, [field]: value }
      }
    });
  }
  handleSObjectSelect(event) {
    const sObjectApiName = event.detail.selectedIds?.[0] || "";
    this._sobjectRow = event.currentTarget.getSelection()[0] || null;
    const current = this.config.sobject;
    const objectChanged = sObjectApiName !== current.sObjectApiName;
    const defaults = defaultSelectorConfig().sobject;
    if (objectChanged) this.resetOverridesForNewSource();
    this.emit({
      ...this.config,
      sobject: {
        ...current,
        sObjectApiName,
        whereClause: "",
        orderByField: "",
        ...(objectChanged
          ? {
              labelField: defaults.labelField,
              valueField: defaults.valueField,
              sublabelField: defaults.sublabelField,
              iconField: defaults.iconField,
              badgeField: defaults.badgeField,
              helpField: defaults.helpField
            }
          : {})
      },
      ...(objectChanged ? { overrides: {} } : {})
    });
    this.resetSampleRows();
    this.resetQueryStatus();
    this.dispatchFilterValidity(false);
  }
  handleWhereChange(event) {
    const whereClause = event.detail.value;
    if (whereClause !== this.config.sobject.whereClause) {
      this.resetSampleRows();
    }
    this.emit({
      ...this.config,
      sobject: { ...this.config.sobject, whereClause }
    });
    this.resetQueryStatus();
    this.dispatchFilterValidity(event.detail.incomplete);
  }
  handleWhereValidityChange(event) {
    this.dispatchFilterValidity(event.detail.incomplete);
  }
  // LIMIT keeps the first rows in sort order, so the order decides which
  // records load.
  handleOrderDirectionChange(event) {
    if (event.detail.value !== this.orderByDirection) this.resetSampleRows();
    this.emit({
      ...this.config,
      sobject: {
        ...this.config.sobject,
        orderByDirection: event.detail.value
      }
    });
    this.resetQueryStatus();
  }
  handleLimitChange(event) {
    const n = parseInt(event.detail.value, 10);
    const queryLimit = n > 0 ? Math.min(n, MAX_QUERY_LIMIT) : null;
    if (queryLimit !== this.config.sobject.queryLimit) this.resetSampleRows();
    this.emit({
      ...this.config,
      sobject: { ...this.config.sobject, queryLimit }
    });
    this.resetQueryStatus();
  }
  handleSObjectFieldChange(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.fieldApiName || "";
    // Label and Value feed the sample rows' keys and labels; Order by decides
    // which records fall under LIMIT.
    if (
      (field === "valueField" ||
        field === "labelField" ||
        field === "orderByField") &&
      value !== this.config.sobject[field]
    ) {
      this.resetSampleRows();
    }
    this.emit({
      ...this.config,
      sobject: { ...this.config.sobject, [field]: value }
    });
    this.resetQueryStatus();
  }

  resetQueryStatus() {
    this._queryValidation = null;
    this._copyStatus = null;
  }
  resetSampleRows() {
    this._sobjectSampleRows = [];
    this._sampleLoadError = "";
    this._bulkSelection = {};
    this._expandedOverrideValue = "";
  }
  // Overrides are keyed by the values of one picklist field or one query; a
  // new source makes those keys meaningless, so they are dropped for good.
  resetOverridesForNewSource() {
    this._clearedOverrides = null;
    this._overrideMode = "";
    this._expandedOverrideValue = "";
    this._overrideSearch = "";
    this._overrideVisibleLimit = OVERRIDE_VISIBLE_INCREMENT;
    this._bulkSelection = {};
    this._bulkEditDraft = emptyBulkDraft();
  }

  async handleValidateQuery() {
    this._isValidatingQuery = true;
    this.resetQueryStatus();
    try {
      const sobject = this.config.sobject;
      const usesFlowValues = hasFlowValues(sobject.whereClause);
      const whereClause = usesFlowValues
        ? whereClauseWithSampleFlowValues(
            sobject.whereClause,
            await getObjectFields({ objectName: sobject.sObjectApiName })
          )
        : sobject.whereClause;
      const result = await validateQuery({
        configJson: JSON.stringify({ ...sobject, whereClause })
      });
      this._queryValidation =
        usesFlowValues && result.valid
          ? {
              ...result,
              message: `${result.message} Flow values were checked with sample values; the flow fills in the real ones at run time.`
            }
          : result;
    } catch (error) {
      this._queryValidation = {
        valid: false,
        message: errorMessageOf(error, "Unable to validate query.")
      };
    } finally {
      this._isValidatingQuery = false;
    }
  }

  async handleCopyQueryPreview() {
    try {
      await navigator.clipboard.writeText(this.sobjectQueryPreview);
      this._copyStatus = { ok: true, message: "Query copied to clipboard." };
    } catch (error) {
      this._copyStatus = {
        ok: false,
        message: errorMessageOf(error, "Copy failed.")
      };
    }
  }

  get picklistObjectSelection() {
    return objectSelection(
      this._picklistObjectRow,
      this.config.picklist.objectApiName
    );
  }
  get sobjectSelection() {
    return objectSelection(
      this._sobjectRow,
      this.config.sobject.sObjectApiName
    );
  }
  get picklistObjectApiName() {
    return this.isPicklistMode
      ? this.config.picklist.objectApiName || null
      : null;
  }
  get picklistFieldRef() {
    const obj = this.config.picklist.objectApiName;
    const field = this.config.picklist.fieldApiName;
    return this.isPicklistMode && obj && field ? `${obj}.${field}` : undefined;
  }
  get picklistRecordTypeId() {
    return this.config.picklist.recordTypeId || MASTER_RECORD_TYPE_ID;
  }
  get picklistValueSource() {
    return this.config.picklist.valueSource;
  }
  get recordTypeOptions() {
    return this._recordTypeOptions;
  }
  get hasRecordTypeOptions() {
    return this._recordTypeOptions.length > 0;
  }
  get recordTypeValue() {
    return this.config.picklist.recordTypeId || MASTER_RECORD_TYPE_VALUE;
  }
  get hasSampleRows() {
    return this._sobjectSampleRows.length > 0;
  }

  get collectionObjectApiName() {
    return (
      this.config.collection.objectApiName ||
      recordCollectionObjectType(this.builderContext, this.sourceRecordsRef)
    );
  }

  get orderByDirection() {
    return this.config.sobject.orderByDirection || "ASC";
  }

  get hasSobjectObject() {
    return Boolean(this.config.sobject.sObjectApiName);
  }

  get sobjectQueryPreview() {
    const sobject = this.config.sobject;
    const fields = [
      "Id",
      sobject.labelField || "Name",
      sobject.valueField || "Id",
      sobject.sublabelField,
      sobject.iconField,
      sobject.badgeField,
      sobject.helpField,
      sobject.orderByField
    ].filter(Boolean);
    const selectFields = Array.from(new Set(fields));
    const where = sobject.whereClause ? ` WHERE ${sobject.whereClause}` : "";
    const order = sobject.orderByField
      ? ` ORDER BY ${sobject.orderByField} ${this.orderByDirection}`
      : "";
    const limit = ` LIMIT ${Number(sobject.queryLimit) || DEFAULT_QUERY_LIMIT}`;
    return `SELECT ${selectFields.join(", ")} FROM ${sobject.sObjectApiName}${where}${order}${limit}`;
  }

  get highlightedSobjectQueryPreview() {
    return highlightSoql(this.sobjectQueryPreview);
  }

  get queryValidationClass() {
    if (!this._queryValidation) return "newton-query-preview__status";
    return this._queryValidation.valid
      ? "newton-query-preview__status newton-query-preview__status_success"
      : "newton-query-preview__status newton-query-preview__status_error";
  }

  get queryValidationMessage() {
    if (!this._queryValidation) {
      return "Not checked yet. Click Validate query to run it against your org.";
    }
    return this._queryValidation.message || "";
  }

  get copyStatusMessage() {
    return this._copyStatus?.message || "";
  }
  get copyStatusClass() {
    if (!this._copyStatus) return "";
    return this._copyStatus.ok
      ? "newton-query-preview__status newton-query-preview__status_success"
      : "newton-query-preview__status newton-query-preview__status_error";
  }

  get validateQueryLabel() {
    return this._isValidatingQuery ? "Validating" : "Validate query";
  }

  @wire(getObjectInfo, { objectApiName: "$picklistObjectApiName" })
  wiredObjectInfo({ data, error }) {
    this._recordTypeError = error
      ? loadErrorMessage("record types", error)
      : "";
    if (!data?.recordTypeInfos) {
      this._recordTypeOptions = [];
      return;
    }

    const userDefaultRecordTypeId = data.defaultRecordTypeId;
    const explicitRecordTypes = Object.values(data.recordTypeInfos)
      .filter(
        (recordType) => recordType.available !== false && !recordType.master
      )
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
      .map((recordType) => ({
        label: recordType.name,
        value: recordType.recordTypeId,
        subtitle: recordType.recordTypeId,
        icon: "id-card",
        badge:
          recordType.recordTypeId === userDefaultRecordTypeId ? "Default" : ""
      }));

    this._recordTypeOptions = explicitRecordTypes.length
      ? [MASTER_RECORD_TYPE_OPTION, ...explicitRecordTypes]
      : [];
  }

  @wire(getPicklistValues, {
    recordTypeId: "$picklistRecordTypeId",
    fieldApiName: "$picklistFieldRef"
  })
  wiredPicklistValues({ data, error }) {
    this._picklistValuesError = error
      ? loadErrorMessage("picklist values", error)
      : "";
    this._picklistValues = data?.values || [];
  }

  get showSourceSetup() {
    return this.hasDataSource && !this.isCustomMode;
  }
  // Each option row names its option, so its buttons and heading make sense
  // out of context ("Delete Gold plan", "Option 2: Gold plan").
  get customItems() {
    return this.config.custom.items.map((item, index, items) => {
      const position = index + 1;
      const name = item.label || `option ${position}`;
      return {
        ...item,
        index,
        title: item.label
          ? `Option ${position}: ${item.label}`
          : `Option ${position}`,
        actionsLabel: `Actions for ${name}`,
        moveUpLabel: `Move ${name} up`,
        moveDownLabel: `Move ${name} down`,
        duplicateLabel: `Duplicate ${name}`,
        deleteLabel: `Delete ${name}`,
        hidden: item.hidden === true,
        moveUpDisabled: index === 0,
        moveDownDisabled: index === items.length - 1
      };
    });
  }
  handleCustomAddRow() {
    const items = [
      ...this.config.custom.items,
      { label: "", value: "", sublabel: "", icon: "", badge: "", helpText: "" }
    ];
    this.emit({ ...this.config, custom: { items } });
  }
  handleCustomRemoveRow(event) {
    this.updateCustomItems((items) =>
      items.splice(Number(event.currentTarget.dataset.index), 1)
    );
  }
  handleCustomDuplicateRow(event) {
    this.updateCustomItems((items) => {
      const index = Number(event.currentTarget.dataset.index);
      items.splice(index + 1, 0, JSON.parse(JSON.stringify(items[index])));
    });
  }
  handleCustomMoveUp(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.swapCustomItems(index, index - 1);
  }
  handleCustomMoveDown(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.swapCustomItems(index, index + 1);
  }
  handleCustomCellChange(event) {
    const index = Number(event.currentTarget.dataset.index);
    const field = event.currentTarget.dataset.field;
    this.updateCustomItems((items) => {
      items[index] = { ...items[index], [field]: event.detail.newValue };
    });
  }
  handleCustomIconChange(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.updateCustomItems((items) => {
      items[index] = { ...items[index], icon: event.detail.iconName || "" };
    });
  }
  handleCustomHiddenToggle(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.updateCustomItems((items) => {
      items[index] = { ...items[index], hidden: event.detail.checked };
    });
  }
  updateCustomItems(mutator) {
    const items = [...this.config.custom.items];
    mutator(items);
    this.emit({ ...this.config, custom: { items } });
  }
  swapCustomItems(from, to) {
    this.updateCustomItems((items) => {
      [items[from], items[to]] = [items[to], items[from]];
    });
  }

  // Override keys are the option values the runtime builds, so the rows come
  // from the same normalizers. SOQL sample rows come from the same Apex call
  // as the runtime's, which returns finished items.
  get _allOverrideRows() {
    const overrides = this.config.overrides;
    let items = [];
    if (this.isPicklistMode) {
      items = normalizePicklist(
        { values: this._picklistValues },
        this.picklistValueSource
      );
    } else if (this.isSObjectMode) {
      items = this._sobjectSampleRows;
    }
    return items.map((item) => {
      const override = overrides[item.value] || {};
      return {
        value: item.value,
        originalLabel: item.label || item.id,
        label: override.label || "",
        icon: override.icon || "",
        sublabel: override.sublabel || "",
        badge: override.badge || "",
        helpText: override.helpText || "",
        hidden: override.hidden === true,
        hasCustom:
          override.hidden === true ||
          OVERRIDE_TEXT_FIELDS.some((field) => Boolean(override[field]))
      };
    });
  }
  get _filteredOverrideRows() {
    const term = this._overrideSearch.trim().toLowerCase();
    return term
      ? this._allOverrideRows.filter((row) =>
          `${row.value} ${row.originalLabel} ${row.label}`
            .toLowerCase()
            .includes(term)
        )
      : this._allOverrideRows;
  }
  get _shownOverrideRows() {
    return this._filteredOverrideRows.slice(0, this._overrideVisibleLimit);
  }
  get visibleOverrideRows() {
    return this._shownOverrideRows.map((row) => this.decorateOverrideRow(row));
  }
  decorateOverrideRow(row) {
    const isExpanded = row.value === this._expandedOverrideValue;
    return {
      ...row,
      previewIcon: row.icon || "circle",
      previewLabel: row.label || row.originalLabel,
      assistiveLabel: `Edit overrides for ${row.originalLabel}`,
      selectLabel: `Select ${row.originalLabel}`,
      resetLabel: `Reset overrides for ${row.originalLabel}`,
      expandLabel: `${isExpanded ? "Collapse" : "Expand"} overrides for ${
        row.originalLabel
      }`,
      summaryItems: this.overrideSummaryItems(row),
      isExpanded,
      ariaExpanded: isExpanded ? "true" : "false",
      isSelected: Boolean(this._bulkSelection[row.value]),
      rowClass: [
        "newton-overrides__row",
        isExpanded ? "newton-overrides__row_expanded" : "",
        row.hasCustom ? "newton-overrides__row_customized" : "",
        this._bulkSelection[row.value] ? "newton-overrides__row_selected" : ""
      ]
        .filter(Boolean)
        .join(" ")
    };
  }
  get bulkSelectionCount() {
    return Object.values(this._bulkSelection).filter(Boolean).length;
  }
  get hasBulkSelection() {
    return this.isOverrideAdvanced && this.bulkSelectionCount > 1;
  }
  get bulkSelectionLabel() {
    return `${this.bulkSelectionCount} selected`;
  }
  get filteredOverrideCount() {
    return this._filteredOverrideRows.length;
  }
  get visibleOverrideCount() {
    return this._shownOverrideRows.length;
  }
  get hasMoreOverrideRows() {
    return this.visibleOverrideCount < this.filteredOverrideCount;
  }
  get showMoreOverrideRowsLabel() {
    const remaining = this.filteredOverrideCount - this.visibleOverrideCount;
    const nextCount = Math.min(remaining, OVERRIDE_VISIBLE_INCREMENT);
    return `Show ${nextCount} more (${this.visibleOverrideCount} of ${this.filteredOverrideCount})`;
  }
  get hasFilteredOverrideRows() {
    return this.filteredOverrideCount > 0;
  }
  get hasNoFilteredOverrideRows() {
    return !this.hasFilteredOverrideRows;
  }
  get bulkDraftCount() {
    return Object.values(this._bulkEditDraft).filter(Boolean).length;
  }
  get canApplyBulk() {
    return this.hasBulkSelection && this.bulkDraftCount > 0;
  }
  get cannotApplyBulk() {
    return !this.canApplyBulk;
  }
  get hasConfiguredOverrides() {
    return Object.keys(this.config.overrides).length > 0;
  }
  get overrideMode() {
    return (
      this._overrideMode ||
      (this.hasConfiguredOverrides
        ? OVERRIDE_MODE_ADVANCED
        : OVERRIDE_MODE_DEFAULT)
    );
  }
  get isOverrideAdvanced() {
    return this.overrideMode === OVERRIDE_MODE_ADVANCED;
  }
  get isOverrideDefault() {
    return !this.isOverrideAdvanced;
  }
  handleOverrideSearch(event) {
    this._overrideSearch = event.target.value || "";
    this._overrideVisibleLimit = OVERRIDE_VISIBLE_INCREMENT;
  }
  handleShowMoreOverrideRows() {
    this._overrideVisibleLimit += OVERRIDE_VISIBLE_INCREMENT;
  }
  handleOverrideModeChange(event) {
    const value = event.detail?.checked
      ? OVERRIDE_MODE_ADVANCED
      : OVERRIDE_MODE_DEFAULT;
    this._overrideMode = value;
    this._expandedOverrideValue = "";
    this._bulkSelection = {};
    if (value === OVERRIDE_MODE_DEFAULT && this.hasConfiguredOverrides) {
      this._clearedOverrides = JSON.parse(
        JSON.stringify(this.config.overrides)
      );
      this.emit({ ...this.config, overrides: {} });
    }
  }

  // Default clears the overrides; Undo brings them back until the admin
  // sets a new override.
  _clearedOverrides = null;
  get showOverridesUndo() {
    return Boolean(this._clearedOverrides) && !this.hasConfiguredOverrides;
  }
  handleUndoClearOverrides() {
    const overrides = this._clearedOverrides;
    this._clearedOverrides = null;
    this._overrideMode = OVERRIDE_MODE_ADVANCED;
    this.emit({ ...this.config, overrides });
  }
  handleToggleExpandRow(event) {
    const value = event.currentTarget.dataset.value;
    this._expandedOverrideValue =
      this._expandedOverrideValue === value ? "" : value;
  }
  handleToggleSelectRow(event) {
    const value = event.currentTarget.dataset.value;
    const next = { ...this._bulkSelection };
    if (next[value]) delete next[value];
    else next[value] = true;
    this._bulkSelection = next;
  }
  handleClearBulkSelection() {
    this._bulkSelection = {};
  }
  handleSelectAllShown() {
    const next = { ...this._bulkSelection };
    for (const row of this._shownOverrideRows) next[row.value] = true;
    this._bulkSelection = next;
  }
  handleBulkDraftChange(event) {
    this._bulkEditDraft = {
      ...this._bulkEditDraft,
      [event.currentTarget.dataset.field]: event.detail.newValue
    };
  }
  handleBulkDraftIconChange(event) {
    this._bulkEditDraft = {
      ...this._bulkEditDraft,
      icon: event.detail?.iconName || ""
    };
  }
  handleApplyBulk() {
    const overrides = { ...this.config.overrides };
    for (const value of Object.keys(this._bulkSelection).filter(
      (key) => this._bulkSelection[key]
    )) {
      const next = { ...(overrides[value] || {}) };
      for (const field of BULK_EDIT_FIELDS) {
        if (this._bulkEditDraft[field])
          next[field] = this._bulkEditDraft[field];
      }
      overrides[value] = next;
    }
    this.emit({ ...this.config, overrides });
    this._bulkEditDraft = emptyBulkDraft();
    this._bulkSelection = {};
  }
  handleOverrideCellChange(event) {
    this.setOverride(
      event.currentTarget.dataset.value,
      event.currentTarget.dataset.field,
      event.detail.newValue
    );
  }
  handleOverrideIconChange(event) {
    this.setOverride(
      event.currentTarget.dataset.value,
      "icon",
      event.detail?.iconName || ""
    );
  }
  handleOverrideHiddenToggle(event) {
    this.setOverride(
      event.currentTarget.dataset.value,
      "hidden",
      event.detail.checked
    );
  }
  handleClearOverride(event) {
    const value = event.currentTarget.dataset.value;
    const overrides = { ...this.config.overrides };
    delete overrides[value];
    this.emit({ ...this.config, overrides });
  }
  setOverride(value, field, newValue) {
    if (!value) return;
    const nextForValue = {
      ...(this.config.overrides[value] || {}),
      [field]: newValue || ""
    };
    if (field === "hidden" && newValue !== true) {
      delete nextForValue.hidden;
    }
    const overrides = { ...this.config.overrides };
    if (
      nextForValue.hidden !== true &&
      OVERRIDE_TEXT_FIELDS.every((key) => !nextForValue[key])
    )
      delete overrides[value];
    else overrides[value] = nextForValue;
    this.emit({ ...this.config, overrides });
  }
  overrideSummaryItems(row) {
    const items = [];
    if (row.hidden) {
      items.push({
        key: "hidden",
        label: "Hidden",
        className:
          "slds-badge slds-theme_warning newton-overrides-summary__badge"
      });
    }
    if (row.label) {
      items.push({
        key: "label",
        label: "Label",
        className: "slds-badge newton-overrides-summary__badge"
      });
    }
    if (row.icon) {
      items.push({
        key: "icon",
        label: "Icon",
        className: "slds-badge newton-overrides-summary__badge"
      });
    }
    if (row.sublabel) {
      items.push({
        key: "sublabel",
        label: "Sublabel",
        className: "slds-badge newton-overrides-summary__badge"
      });
    }
    if (row.badge) {
      items.push({
        key: "badge",
        label: "Badge",
        className: "slds-badge newton-overrides-summary__badge"
      });
    }
    if (row.helpText) {
      items.push({
        key: "helpText",
        label: "Help",
        className: "slds-badge newton-overrides-summary__badge"
      });
    }
    if (!items.length) {
      items.push({
        key: "source",
        label: "Using source",
        className:
          "slds-badge slds-badge_lightest newton-overrides-summary__badge"
      });
    }
    return items;
  }

  async handleLoadSObjectSample() {
    this._isLoadingSample = true;
    this._sampleLoadError = "";
    try {
      const sobject = this.config.sobject;
      this._sampleIgnoresWhere = hasFlowValues(sobject.whereClause);
      this._sobjectSampleRows = await queryItems({
        configJson: JSON.stringify(
          this._sampleIgnoresWhere ? { ...sobject, whereClause: "" } : sobject
        )
      });
    } catch (error) {
      this._sampleLoadError = loadErrorMessage("sample rows", error);
      this._sobjectSampleRows = [];
    } finally {
      this._isLoadingSample = false;
    }
  }

  get displaySortBy() {
    return this.config.display.sortBy;
  }
  get displaySortDirection() {
    return this.config.display.sortDirection;
  }
  get displayLimit() {
    return this.config.display.limit ?? "";
  }
  get displaySortEnabled() {
    return this.displaySortBy !== "none";
  }
  handleDisplaySortByChange(event) {
    this.emit({
      ...this.config,
      display: { ...this.config.display, sortBy: event.detail.value }
    });
  }
  handleDisplaySortDirectionChange(event) {
    this.emit({
      ...this.config,
      display: { ...this.config.display, sortDirection: event.detail.value }
    });
  }
  handleDisplayLimitChange(event) {
    const n = parseInt(event.target.value, 10);
    this.emit({
      ...this.config,
      display: { ...this.config.display, limit: n > 0 ? n : null }
    });
  }

  dispatchRefChange(name, value) {
    this.dispatchEvent(
      new CustomEvent("refchange", { detail: { name, value: value || "" } })
    );
  }
  // Tells the editor whether the WHERE builder holds a partly filled
  // condition, which blocks Save.
  dispatchFilterValidity(incomplete) {
    this.dispatchEvent(
      new CustomEvent("filtervaliditychange", { detail: { incomplete } })
    );
  }
}
