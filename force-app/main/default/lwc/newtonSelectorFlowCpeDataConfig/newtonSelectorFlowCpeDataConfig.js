import { api, LightningElement, track, wire } from "lwc";
import { getObjectInfo, getPicklistValues } from "lightning/uiObjectInfoApi";
import { defaultSelectorConfig } from "c/newtonSelectorUtilityConfigDefaults";
import { MASTER_RECORD_TYPE_ID } from "c/newtonSelectorUtilityDataSources";
import {
  loadErrorMessage,
  readResourceValue
} from "c/newtonSelectorFlowCpeUtilityHelpers";
import {
  MAX_QUERY_LIMIT,
  buildSobjectConfigForQuery,
  resolveRecordCollectionMetadataFromBuilderContext
} from "c/newtonSelectorFlowCpeUtilityConfigState";
import {
  ORDER_DIRECTION_OPTIONS,
  OVERRIDE_FIELDS,
  PICKLIST_VALUE_SOURCE_OPTIONS,
  SORT_BY_OPTIONS,
  SORT_DIRECTION_OPTIONS,
  SOURCE_TILES
} from "c/newtonSelectorFlowCpeUtilityConfigOptions";
import searchSObjectTypes from "@salesforce/apex/NewtonSelectorFlowCpeController.searchSObjectTypes";
import searchLookupDatasetFieldsForObject from "@salesforce/apex/NewtonSelectorFlowCpeController.searchLookupDatasetFieldsForObject";
import queryItems from "@salesforce/apex/NewtonSelectorRuntimeController.queryItems";
import validateQuery from "@salesforce/apex/NewtonSelectorRuntimeController.validateQuery";

const DEFAULT_RECORD_TYPE_VALUE = "__NewtonDefaultRecordType__";
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
const EMPTY_COLLECTION_FIELD_MAP = {
  label: "",
  sublabel: "",
  icon: "",
  value: "",
  badge: "",
  helpText: ""
};

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
  @track _defaultRecordTypeId = MASTER_RECORD_TYPE_ID;
  @track _sobjectSampleRows = [];
  @track _sampleLoadError = "";
  @track _isLoadingSample = false;
  @track _overrideSearch = "";
  @track _expandedOverrideValue = "";
  @track _overrideVisibleLimit = OVERRIDE_VISIBLE_INCREMENT;
  @track _overrideMode = "";
  @track _bulkSelection = {};
  @track _bulkEditDraft = { icon: "", sublabel: "", badge: "", helpText: "" };
  @track _queryValidation = null;
  @track _isValidatingQuery = false;
  _loadError = "";

  get _config() {
    return this.config || defaultSelectorConfig();
  }
  set _config(value) {
    this.dispatchEvent(
      new CustomEvent("configpatch", { detail: { path: [], value } })
    );
  }

  get _sourceRecordsRef() {
    return this.sourceRecordsRef || "";
  }
  set _sourceRecordsRef(value) {
    this.dispatchRefChange("sourceRecordsRef", value);
  }

  get hasDataSource() {
    return Boolean(this._config.dataSource);
  }
  get isPicklistMode() {
    return this._config.dataSource === "picklist";
  }
  get isCollectionMode() {
    return this._config.dataSource === "collection";
  }
  get isSObjectMode() {
    return this._config.dataSource === "sobject";
  }
  get isCustomMode() {
    return this._config.dataSource === "custom";
  }
  get canCustomizeValues() {
    return this.isPicklistMode || this.isSObjectMode;
  }

  get sourceTiles() {
    const active = this._config.dataSource;
    return SOURCE_TILES.map((tile) => ({
      ...tile,
      id: tile.value,
      _selected: tile.value === active
    }));
  }
  get sourceKindLabel() {
    return (
      SOURCE_TILES.find((tile) => tile.value === this._config.dataSource)
        ?.label || ""
    );
  }
  get sourceSetupTitle() {
    return this.sourceKindLabel
      ? `${this.sourceKindLabel} setup`
      : "Source setup";
  }
  get sourceKindIcon() {
    return (
      SOURCE_TILES.find((tile) => tile.value === this._config.dataSource)
        ?.icon || "database"
    );
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
    if (value) {
      this._config = { ...this._config, dataSource: value };
      this.dispatchFilterValidity(false);
    }
  }
  async handlePicklistObjectSearch(event) {
    await this.runSObjectSearch(event.detail.searchTerm, event.target);
  }
  handlePicklistObjectSelect(event) {
    const selectedId = event.detail.selectedIds?.[0];
    this._config = {
      ...this._config,
      picklist: {
        ...this._config.picklist,
        objectApiName: selectedId || "",
        fieldApiName: "",
        recordTypeId: ""
      }
    };
  }
  handlePicklistFieldChange(event) {
    this._config = {
      ...this._config,
      picklist: {
        ...this._config.picklist,
        fieldApiName: event.detail.fieldApiName || ""
      }
    };
  }
  handleRecordTypeComboChange(event) {
    const value = event.detail.value;
    this._config = {
      ...this._config,
      picklist: {
        ...this._config.picklist,
        recordTypeId: value === DEFAULT_RECORD_TYPE_VALUE ? "" : value
      }
    };
  }
  handlePicklistValueSourceChange(event) {
    this._config = {
      ...this._config,
      picklist: {
        ...this._config.picklist,
        valueSource: event.detail.value
      }
    };
  }

  handleCollectionVariableChange(event) {
    const nextRef = readResourceValue(event);
    const nextObject =
      event.detail.objectType ||
      resolveRecordCollectionMetadataFromBuilderContext(
        this.builderContext,
        nextRef
      ).objectApiName;
    const currentObject = this._config.collection?.objectApiName || "";
    this._sourceRecordsRef = nextRef;
    this._config = {
      ...this._config,
      collection: {
        ...this._config.collection,
        objectApiName: nextObject || "",
        fieldMap:
          !nextRef || (nextObject && nextObject !== currentObject)
            ? { ...EMPTY_COLLECTION_FIELD_MAP }
            : { ...(this._config.collection?.fieldMap || {}) }
      }
    };
  }
  handleCollectionFieldMapChange(event) {
    const field = event.currentTarget.dataset.field;
    const value = event.detail.fieldApiName;
    this._config = {
      ...this._config,
      collection: {
        ...this._config.collection,
        fieldMap: { ...this._config.collection.fieldMap, [field]: value }
      }
    };
  }
  async handleSObjectSearch(event) {
    await this.runSObjectSearch(event.detail.searchTerm, event.target);
  }
  handleSObjectSelect(event) {
    const selectedId = event.detail.selectedIds?.[0];
    this._config = {
      ...this._config,
      sobject: {
        ...this._config.sobject,
        sObjectApiName: selectedId || "",
        whereClause: "",
        orderByField: ""
      }
    };
    this._sobjectSampleRows = [];
    this._queryValidation = null;
    this.dispatchFilterValidity(false);
  }
  handleWhereChange(event) {
    this._config = {
      ...this._config,
      sobject: {
        ...this._config.sobject,
        whereClause: event.detail.value
      }
    };
    this._queryValidation = null;
    this.dispatchFilterValidity(event.detail.incomplete);
  }
  handleOrderFieldSearch(event) {
    const lookup = event.currentTarget;
    const objectApiName = this._config.sobject?.sObjectApiName || "";
    if (!objectApiName) {
      lookup.setSearchResults([]);
      return;
    }
    searchLookupDatasetFieldsForObject({
      objectApiName,
      searchKey: event.detail.rawSearchTerm || ""
    })
      .then((rows) => {
        this._loadError = "";
        lookup.setSearchResults(rows);
      })
      .catch((error) => {
        this._loadError = loadErrorMessage("fields", error);
        lookup.setSearchResults([]);
      });
  }
  handleOrderFieldSelectionChange(event) {
    const row = event.currentTarget.getSelection()[0];
    this._config = {
      ...this._config,
      sobject: {
        ...this._config.sobject,
        orderByField: row?.id ? String(row.id) : ""
      }
    };
    this._queryValidation = null;
  }
  handleOrderDirectionChange(event) {
    this._config = {
      ...this._config,
      sobject: {
        ...this._config.sobject,
        orderByDirection: event.detail.value
      }
    };
    this._queryValidation = null;
  }
  handleLimitChange(event) {
    const n = parseInt(event.detail.value, 10);
    const limit = n > 0 ? Math.min(n, MAX_QUERY_LIMIT) : null;
    this._config = {
      ...this._config,
      sobject: { ...this._config.sobject, limit }
    };
    this._queryValidation = null;
  }
  handleSObjectFieldChange(event) {
    const field = event.currentTarget.dataset.field;
    this._config = {
      ...this._config,
      sobject: {
        ...this._config.sobject,
        [field]: event.detail.fieldApiName || ""
      }
    };
    this._queryValidation = null;
  }

  async handleValidateQuery() {
    this._isValidatingQuery = true;
    this._queryValidation = null;
    try {
      this._queryValidation = await validateQuery({
        configJson: JSON.stringify(buildSobjectConfigForQuery(this._config))
      });
    } catch (error) {
      this._queryValidation = {
        valid: false,
        message:
          error?.body?.message || error?.message || "Unable to validate query."
      };
    } finally {
      this._isValidatingQuery = false;
    }
  }

  async handleCopyQueryPreview() {
    try {
      await navigator.clipboard.writeText(this.sobjectQueryPreview);
      this._queryValidation = {
        valid: true,
        message: "Query copied to clipboard."
      };
    } catch {
      this._queryValidation = {
        valid: false,
        message: "Could not copy the query preview."
      };
    }
  }
  async runSObjectSearch(searchTerm, lookupComponent) {
    try {
      const results = await searchSObjectTypes({ searchKey: searchTerm || "" });
      this._loadError = "";
      lookupComponent.setSearchResults(
        results.map((row) => ({
          id: row.value,
          title: row.label,
          subtitle: row.subtitle,
          icon: row.icon || "database",
          sObjectType: row.sObjectType,
          type: "SObject",
          displayType: "SObject",
          badge: row.value
        }))
      );
    } catch (error) {
      this._loadError = loadErrorMessage("objects", error);
      lookupComponent.setSearchResults([]);
    }
  }

  get picklistObjectSelection() {
    const objectApiName = this._config.picklist?.objectApiName;
    return objectApiName
      ? [
          {
            id: objectApiName,
            title: objectApiName,
            icon: "database",
            type: "SObject",
            displayType: "SObject",
            badge: objectApiName
          }
        ]
      : [];
  }
  get sobjectSelection() {
    const objectApiName = this._config.sobject?.sObjectApiName;
    return objectApiName
      ? [{ id: objectApiName, title: objectApiName, icon: "sparkle" }]
      : [];
  }
  get orderByFieldSelection() {
    const field = this._config.sobject?.orderByField;
    return field
      ? { id: field, title: field, subtitle: "", icon: "type" }
      : null;
  }
  get picklistObjectApiName() {
    return this.isPicklistMode
      ? this._config.picklist?.objectApiName || null
      : null;
  }
  get picklistFieldRef() {
    const obj = this._config.picklist?.objectApiName;
    const field = this._config.picklist?.fieldApiName;
    return this.isPicklistMode && obj && field ? `${obj}.${field}` : undefined;
  }
  get picklistRecordTypeId() {
    return (
      this._config.picklist?.recordTypeId ||
      this._defaultRecordTypeId ||
      MASTER_RECORD_TYPE_ID
    );
  }
  get picklistValueSource() {
    return this._config.picklist?.valueSource || "apiName";
  }
  get recordTypeOptions() {
    return this._recordTypeOptions;
  }
  get hasRecordTypeOptions() {
    return this._recordTypeOptions.length > 0;
  }
  get recordTypeValue() {
    return this._config.picklist?.recordTypeId || DEFAULT_RECORD_TYPE_VALUE;
  }
  get hasSampleRows() {
    return this._sobjectSampleRows.length > 0;
  }

  get collectionResourceMetadata() {
    return resolveRecordCollectionMetadataFromBuilderContext(
      this.builderContext,
      this._sourceRecordsRef
    );
  }

  get collectionObjectApiName() {
    return (
      this._config.collection?.objectApiName ||
      this.collectionResourceMetadata.objectApiName ||
      ""
    );
  }

  get orderByDirection() {
    return buildSobjectConfigForQuery(this._config).orderByDirection;
  }

  get sobjectQueryPreview() {
    const config = buildSobjectConfigForQuery(this._config);
    const objectApiName = config.sObjectApiName || "Object";
    const fields = [
      "Id",
      config.labelField,
      config.valueField,
      config.sublabelField,
      config.iconField,
      config.badgeField,
      config.helpField
    ].filter(Boolean);
    const selectFields = Array.from(new Set(fields));
    const where = config.whereClause ? ` WHERE ${config.whereClause}` : "";
    const order = config.orderByField
      ? ` ORDER BY ${config.orderByField} ${config.orderByDirection}`
      : "";
    const limit = ` LIMIT ${config.queryLimit}`;
    return `SELECT ${selectFields.join(", ")} FROM ${objectApiName}${where}${order}${limit}`;
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

  get validateQueryLabel() {
    return this._isValidatingQuery ? "Validating" : "Validate query";
  }

  @wire(getObjectInfo, { objectApiName: "$picklistObjectApiName" })
  wiredObjectInfo({ data, error }) {
    if (error) {
      this._loadError = loadErrorMessage("record types", error);
    }
    if (!data?.recordTypeInfos) {
      this._defaultRecordTypeId = MASTER_RECORD_TYPE_ID;
      this._recordTypeOptions = [];
      return;
    }

    const recordTypes = Object.values(data.recordTypeInfos).filter(
      (recordType) => recordType.available !== false
    );
    this._defaultRecordTypeId =
      data.defaultRecordTypeId || MASTER_RECORD_TYPE_ID;
    const defaultRecordType = recordTypes.find(
      (recordType) => recordType.recordTypeId === this._defaultRecordTypeId
    );
    const defaultName = defaultRecordType?.name || "Master";
    const explicitRecordTypes = recordTypes
      .filter((recordType) => !recordType.master)
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
      .map((recordType) => ({
        label: recordType.name,
        value: recordType.recordTypeId,
        sublabel: recordType.developerName || recordType.recordTypeId,
        icon: "id-card",
        badge:
          recordType.recordTypeId === this._defaultRecordTypeId ? "Default" : ""
      }));

    if (explicitRecordTypes.length === 0) {
      this._recordTypeOptions = [];
      return;
    }

    this._recordTypeOptions = [
      ...this.defaultRecordTypeOptions(defaultName),
      ...explicitRecordTypes
    ];
  }

  defaultRecordTypeOptions(defaultName) {
    return [
      {
        label: `Default (${defaultName})`,
        value: DEFAULT_RECORD_TYPE_VALUE,
        sublabel: "Uses this object's default record type",
        icon: "list-checks"
      }
    ];
  }

  @wire(getPicklistValues, {
    recordTypeId: "$picklistRecordTypeId",
    fieldApiName: "$picklistFieldRef"
  })
  wiredPicklistValues({ data, error }) {
    if (error) {
      this._loadError = loadErrorMessage("picklist values", error);
    }
    this._picklistValues = data?.values || [];
  }

  get showSourceSetup() {
    return this.hasDataSource && !this.isCustomMode;
  }
  // Each option row names its option, so its buttons and heading make sense
  // out of context ("Delete Gold plan", "Option 2: Gold plan").
  get customItems() {
    return (this._config.custom?.items || []).map((item, index, items) => {
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
      ...(this._config.custom?.items || []),
      { label: "", value: "", sublabel: "", icon: "", badge: "", helpText: "" }
    ];
    this._config = { ...this._config, custom: { items } };
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
    if (index > 0) this.swapCustomItems(index, index - 1);
  }
  handleCustomMoveDown(event) {
    const index = Number(event.currentTarget.dataset.index);
    const items = this._config.custom?.items || [];
    if (index < items.length - 1) this.swapCustomItems(index, index + 1);
  }
  handleCustomCellChange(event) {
    const index = Number(event.currentTarget.dataset.index);
    const field = event.currentTarget.dataset.field;
    this.updateCustomItems((items) => {
      items[index] = { ...items[index], [field]: readResourceValue(event) };
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
    const items = [...(this._config.custom?.items || [])];
    mutator(items);
    this._config = { ...this._config, custom: { items } };
  }
  swapCustomItems(from, to) {
    this.updateCustomItems((items) => {
      [items[from], items[to]] = [items[to], items[from]];
    });
  }

  get _allOverrideRows() {
    const overrides = this._config.overrides || {};
    let source = [];
    if (this.isPicklistMode) {
      const useLabel = this.picklistValueSource === "label";
      source = this._picklistValues.map((value) => ({
        value: useLabel ? value.label : value.value,
        originalLabel: value.label
      }));
    } else if (this.isSObjectMode) {
      source = this._sobjectSampleRows.map((dto) => ({
        value: dto.value || dto.id,
        originalLabel: dto.label || dto.id
      }));
    }
    return source.map((row) => {
      const override = overrides[row.value] || {};
      return {
        value: row.value,
        originalLabel: row.originalLabel,
        label: override.label || "",
        icon: override.icon || "",
        sublabel: override.sublabel || "",
        badge: override.badge || "",
        helpText: override.helpText || "",
        hidden: override.hidden === true,
        hasCustom: OVERRIDE_FIELDS.some((field) => {
          return field === "hidden"
            ? override.hidden === true
            : Boolean(override[field]);
        })
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
  get visibleOverrideRows() {
    return this._filteredOverrideRows
      .slice(0, this._overrideVisibleLimit)
      .map((row) => this.decorateOverrideRow(row));
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
    return this.visibleOverrideRows.length;
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
    return Object.keys(this._config.overrides || {}).length > 0;
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
        JSON.stringify(this._config.overrides)
      );
      this._config = { ...this._config, overrides: {} };
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
    if (!overrides) return;
    this._clearedOverrides = null;
    this._overrideMode = OVERRIDE_MODE_ADVANCED;
    this._config = { ...this._config, overrides };
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
  handleSelectAllFiltered() {
    const next = { ...this._bulkSelection };
    for (const row of this._filteredOverrideRows) next[row.value] = true;
    this._bulkSelection = next;
  }
  handleBulkDraftChange(event) {
    this._bulkEditDraft = {
      ...this._bulkEditDraft,
      [event.currentTarget.dataset.field]: readResourceValue(event)
    };
  }
  handleBulkDraftIconChange(event) {
    this._bulkEditDraft = {
      ...this._bulkEditDraft,
      icon: event.detail?.iconName || ""
    };
  }
  handleApplyBulk() {
    if (!this.canApplyBulk) return;
    const overrides = { ...(this._config.overrides || {}) };
    for (const value of Object.keys(this._bulkSelection).filter(
      (key) => this._bulkSelection[key]
    )) {
      const next = { ...(overrides[value] || {}) };
      for (const field of ["icon", "sublabel", "badge", "helpText"]) {
        if (this._bulkEditDraft[field])
          next[field] = this._bulkEditDraft[field];
      }
      overrides[value] = next;
    }
    this._config = { ...this._config, overrides };
    this._bulkEditDraft = { icon: "", sublabel: "", badge: "", helpText: "" };
    this._bulkSelection = {};
  }
  handleOverrideCellChange(event) {
    this.setOverride(
      event.currentTarget.dataset.value,
      event.currentTarget.dataset.field,
      readResourceValue(event)
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
    const overrides = { ...(this._config.overrides || {}) };
    delete overrides[value];
    this._config = { ...this._config, overrides };
  }
  setOverride(value, field, newValue) {
    if (!value) return;
    const nextForValue = {
      ...(this._config.overrides?.[value] || {}),
      [field]: newValue || ""
    };
    if (field === "hidden" && newValue !== true) {
      delete nextForValue.hidden;
    }
    const overrides = { ...(this._config.overrides || {}) };
    if (
      OVERRIDE_FIELDS.every((key) => {
        return key === "hidden"
          ? nextForValue.hidden !== true
          : !nextForValue[key];
      })
    )
      delete overrides[value];
    else overrides[value] = nextForValue;
    this._config = { ...this._config, overrides };
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
        label: "Subtitle",
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
      const dtos = await queryItems({
        configJson: JSON.stringify(buildSobjectConfigForQuery(this._config))
      });
      this._sobjectSampleRows = Array.isArray(dtos) ? dtos : [];
    } catch (error) {
      this._sampleLoadError = `Couldn't load sample rows. ${error?.body?.message || error?.message || "Check the query and try again."}`;
      this._sobjectSampleRows = [];
    } finally {
      this._isLoadingSample = false;
    }
  }

  get displaySortBy() {
    return this._config.display?.sortBy || "none";
  }
  get displaySortDirection() {
    return this._config.display?.sortDirection || "asc";
  }
  get displayLimit() {
    return this._config.display?.limit ?? "";
  }
  get displaySortEnabled() {
    return this.displaySortBy !== "none";
  }
  handleDisplaySortByChange(event) {
    this._config = {
      ...this._config,
      display: {
        ...(this._config.display || {}),
        sortBy: event.detail.value
      }
    };
  }
  handleDisplaySortDirectionChange(event) {
    this._config = {
      ...this._config,
      display: {
        ...(this._config.display || {}),
        sortDirection: event.detail.value
      }
    };
  }
  handleDisplayLimitChange(event) {
    const raw = event.target.value;
    this._config = {
      ...this._config,
      display: {
        ...(this._config.display || {}),
        limit: raw === "" || raw == null ? null : Math.max(0, Number(raw))
      }
    };
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
