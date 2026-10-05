import { LightningElement, api, wire, track } from "lwc";
import { getPicklistValues } from "lightning/uiObjectInfoApi";
import queryItems from "@salesforce/apex/NewtonSelectorRuntimeController.queryItems";
import {
  normalizePicklist,
  normalizeCollection,
  normalizeSObjectDTO,
  normalizeCustom,
  applyOverrides,
  applyDisplay,
  MANUAL_INPUT_VALUE,
  MASTER_RECORD_TYPE_ID
} from "c/newtonSelectorUtilityDataSources";

const SOURCE_PICKLIST = "picklist";
const SOURCE_COLLECTION = "collection";
const SOURCE_SOBJECT = "sobject";
const SOURCE_CUSTOM = "custom";

export default class NewtonSelectorDataSelector extends LightningElement {
  @api label;
  @api helpText;
  @api fieldLevelHelp;
  // Force a state ('' | 'empty' | 'error'). The builder preview uses it, and
  // the flow screen forces 'error' when its saved config cannot be read.
  @api forcedState;
  @api layout;
  @api required;
  @api minSelections;
  @api maxSelections;
  @api showSelectAll;
  @api enableSearch;
  @api previewMode;
  @api emptyStateMessage;
  @api errorStateMessage;
  @api manualInputMinLength;
  @api manualInputMaxLength;
  // Group appearance properties (layout spacing and tile styling), passed to
  // c-newton-selector-group unchanged. Built by selectorPropsFromConfig().
  @api appearance;

  _sourceType;
  _picklistConfig;
  _collectionConfig;
  _sobjectConfig;
  _customConfig;
  _displayConfig;
  _overrides;
  _selectionMode = "single";
  _includeNoneOption = false;
  _noneOptionLabel;
  _noneOptionPosition;
  _allowManualInput = false;
  _manualInputLabel;
  _manualInputValue = "";
  _manualInputSelected = false;
  _noneSelected = false;
  _connectedFlag = false;
  _rawData = null;
  _value = "";
  _values = [];

  @track _items = [];
  _isLoading = false;
  _errorMessage = "";

  @api
  get selectionMode() {
    return this._selectionMode;
  }
  set selectionMode(v) {
    const next = v === "multi" ? "multi" : "single";
    if (this._selectionMode === next) return;
    this._selectionMode = next;
    this.reapplyNormalization();
  }

  // A "None" tile can be offered in any selection mode. Its empty value
  // clears the selection downstream rather than being persisted as a choice.
  @api
  get includeNoneOption() {
    return this._includeNoneOption;
  }
  set includeNoneOption(v) {
    const next = Boolean(v);
    if (this._includeNoneOption === next) return;
    this._includeNoneOption = next;
    this.reapplyNormalization();
  }

  @api
  get noneOptionLabel() {
    return this._noneOptionLabel;
  }
  set noneOptionLabel(v) {
    if (this._noneOptionLabel === v) return;
    this._noneOptionLabel = v;
    this.reapplyNormalization();
  }

  // 'start' prepends the None tile; 'end' appends it.
  @api
  get noneOptionPosition() {
    return this._noneOptionPosition;
  }
  set noneOptionPosition(v) {
    if (this._noneOptionPosition === v) return;
    this._noneOptionPosition = v;
    this.reapplyNormalization();
  }

  @api
  get allowManualInput() {
    return this._allowManualInput;
  }
  set allowManualInput(v) {
    const next = Boolean(v);
    if (this._allowManualInput === next) return;
    this._allowManualInput = next;
    this.reapplyNormalization();
  }

  @api
  get manualInputLabel() {
    return this._manualInputLabel;
  }
  set manualInputLabel(v) {
    if (this._manualInputLabel === v) return;
    this._manualInputLabel = v;
    this.reapplyNormalization();
  }

  @api
  get sourceType() {
    return this._sourceType;
  }
  set sourceType(v) {
    const changed = this._sourceType !== v;
    this._sourceType = v;
    if (changed) this.reload();
  }

  @api
  get picklistConfig() {
    return this._picklistConfig;
  }
  set picklistConfig(v) {
    this._picklistConfig = v;
    if (this._sourceType === SOURCE_PICKLIST) this.reapplyNormalization();
  }

  @api
  get collectionConfig() {
    return this._collectionConfig;
  }
  set collectionConfig(v) {
    this._collectionConfig = v;
    if (this._sourceType === SOURCE_COLLECTION) this.reload();
  }

  @api
  get sobjectConfig() {
    return this._sobjectConfig;
  }
  set sobjectConfig(v) {
    const prev = this._sobjectConfig;
    this._sobjectConfig = v;
    // Only a changed query goes back to Apex.
    if (JSON.stringify(prev) === JSON.stringify(v)) return;
    if (this._sourceType === SOURCE_SOBJECT) this.reload();
  }

  @api
  get customConfig() {
    return this._customConfig;
  }
  set customConfig(v) {
    this._customConfig = v;
    if (this._sourceType === SOURCE_CUSTOM) this.reload();
  }

  @api
  get displayConfig() {
    return this._displayConfig;
  }
  set displayConfig(v) {
    this._displayConfig = v;
    this.reapplyNormalization();
  }

  @api
  get overrides() {
    return this._overrides;
  }
  set overrides(v) {
    this._overrides = v;
    this.reapplyNormalization();
  }

  @api
  get value() {
    return this._value;
  }
  set value(v) {
    this._value = v || "";
  }

  @api
  get values() {
    return this._values;
  }
  set values(v) {
    this._values = Array.isArray(v) ? [...v] : [];
  }

  // --- Picklist wire ---
  get recordTypeId() {
    return this._picklistConfig?.recordTypeId || MASTER_RECORD_TYPE_ID;
  }

  get picklistFieldRef() {
    const objectApiName = this._picklistConfig?.objectApiName;
    const fieldApiName = this._picklistConfig?.fieldApiName;
    if (
      this._sourceType !== SOURCE_PICKLIST ||
      !objectApiName ||
      !fieldApiName
    ) {
      return undefined;
    }
    return `${objectApiName}.${fieldApiName}`;
  }

  @wire(getPicklistValues, {
    recordTypeId: "$recordTypeId",
    fieldApiName: "$picklistFieldRef"
  })
  wiredPicklistValues({ data, error }) {
    if (this._sourceType !== SOURCE_PICKLIST) return;
    if (error) {
      this.handleError(error);
      return;
    }
    if (data) {
      this._rawData = data;
      this.reapplyNormalization();
      this._isLoading = false;
      this._errorMessage = "";
    }
  }

  // --- Lifecycle ---
  connectedCallback() {
    this._connectedFlag = true;
    this.loadData();
  }

  disconnectedCallback() {
    this._connectedFlag = false;
  }

  // --- Data fetch strategy ---
  reload() {
    if (this._connectedFlag) this.loadData();
  }

  async loadData() {
    const handlers = {
      [SOURCE_PICKLIST]: this.loadPicklist,
      [SOURCE_COLLECTION]: this.loadCollection,
      [SOURCE_SOBJECT]: this.loadSObject,
      [SOURCE_CUSTOM]: this.loadCustom
    };
    const handler = handlers[this._sourceType];
    if (handler) {
      try {
        await handler.call(this);
      } catch (e) {
        this.handleError(e);
      }
    }
  }

  loadPicklist() {
    // The wire only re-emits when the object/field/record type changes, so a
    // reload with data already delivered must not strand the skeleton.
    if (this._rawData != null) return;
    this._isLoading = true;
  }

  loadCollection() {
    this._rawData = this._collectionConfig?.records || [];
    this.reapplyNormalization();
    this._isLoading = false;
    this._errorMessage = "";
  }

  async loadSObject() {
    this._isLoading = true;
    this._errorMessage = "";
    try {
      // The stored config names the row cap `limit`; the Apex DTO reads `queryLimit`.
      const { limit, ...sobjectConfig } = this._sobjectConfig || {};
      const queryLimit = Number(limit);
      if (queryLimit > 0) sobjectConfig.queryLimit = queryLimit;
      const configJson = JSON.stringify(sobjectConfig);
      this._rawData = await queryItems({ configJson });
      this.reapplyNormalization();
    } finally {
      this._isLoading = false;
    }
  }

  loadCustom() {
    this._rawData = this._customConfig?.items || [];
    this.reapplyNormalization();
    this._isLoading = false;
    this._errorMessage = "";
  }

  normalizeSourceItems() {
    switch (this._sourceType) {
      case SOURCE_PICKLIST:
        return normalizePicklist(
          this._rawData,
          this._picklistConfig?.valueSource
        );
      case SOURCE_COLLECTION:
        return normalizeCollection(
          this._rawData,
          this._collectionConfig?.fieldMap
        );
      case SOURCE_SOBJECT:
        return normalizeSObjectDTO(this._rawData);
      default:
        return normalizeCustom(this._rawData);
    }
  }

  // Re-derives the rendered options from the loaded data after any config
  // change (overrides, display rules, None/manual options).
  reapplyNormalization() {
    if (!this._connectedFlag || this._rawData == null) return;
    const source = this.normalizeSourceItems();
    // Per-item overrides are keyed by value and are not offered for record
    // collections, whose rows change on every run.
    const overridden =
      this._sourceType === SOURCE_COLLECTION
        ? source
        : applyOverrides(source, this._overrides);
    this.commitItems(
      this.addExtraOptions(applyDisplay(overridden, this._displayConfig))
    );
  }

  // The None and manual-input options are added after sort and limit so their
  // positions stay fixed whatever the display rules are.
  addExtraOptions(items) {
    let next = items;
    if (this._includeNoneOption) {
      // Empty value means "no pick", which Flow reads as null.
      const none = {
        id: "__none__",
        label: this._noneOptionLabel,
        sublabel: "",
        icon: "",
        badge: "",
        helpText: "",
        value: "",
        disabled: false
      };
      next =
        this._noneOptionPosition === "end" ? [...next, none] : [none, ...next];
    }
    if (this._allowManualInput) {
      next = [
        ...next,
        {
          id: MANUAL_INPUT_VALUE,
          label: this._manualInputLabel,
          sublabel: "Enter a custom value",
          icon: "square-pen",
          badge: "",
          helpText: "",
          value: MANUAL_INPUT_VALUE,
          disabled: false,
          manualInput: true
        }
      ];
    }
    return next;
  }

  // Emits `itemschange` with every rendered value and label so the flow
  // screen can surface them as Flow outputs.
  commitItems(items) {
    this._items = items;
    this.dispatchEvent(
      new CustomEvent("itemschange", {
        detail: {
          values: items.map((i) => String(i.value ?? "")),
          labels: items.map((i) => String(i.label ?? ""))
        },
        bubbles: true,
        composed: false
      })
    );
  }

  handleError(error) {
    this._errorMessage =
      error?.body?.message || error?.message || this.errorStateMessage;
    this._isLoading = false;
  }

  handleRetry() {
    this.loadData();
  }

  // --- Selection ---
  handleSelectionChange(event) {
    const { values, items, manualValue, noneSelected } = event.detail;
    const noneWasPicked = noneSelected === true;
    const manualWasPicked = values.includes(MANUAL_INPUT_VALUE);
    this._manualInputSelected = !noneWasPicked && manualWasPicked;
    this._noneSelected = noneWasPicked;
    if (manualValue !== undefined && manualValue !== null) {
      this._manualInputValue = String(manualValue);
    }
    if (noneWasPicked) {
      this._manualInputValue = "";
    }
    const normalValues = values.filter((value) => value !== MANUAL_INPUT_VALUE);
    const effectiveValues =
      !noneWasPicked && manualWasPicked && this._manualInputValue
        ? [...normalValues, this._manualInputValue]
        : normalValues;
    const effectiveItems = noneWasPicked
      ? []
      : items.filter((item) => item.value !== MANUAL_INPUT_VALUE);
    const labels = effectiveItems.map((i) => String(i.label ?? ""));
    const manualLabel = this._manualInputValue || this._manualInputLabel;
    if (this.selectionMode === "single") {
      this._value = manualWasPicked
        ? this._manualInputValue
        : effectiveValues[0] || "";
      this._values = [];
    } else {
      this._values = effectiveValues;
      this._value = "";
    }
    this.dispatchEvent(
      new CustomEvent("valuechange", {
        detail: {
          value: this._value,
          values: this._values,
          label: noneWasPicked
            ? ""
            : manualWasPicked
              ? manualLabel
              : labels[0] || "",
          labels: noneWasPicked
            ? []
            : manualWasPicked && this.selectionMode === "multi"
              ? [...labels, manualLabel]
              : labels,
          // Only record-backed sources (SOQL, record collection) carry records.
          record: manualWasPicked ? null : effectiveItems[0]?.record || null,
          records: effectiveItems.map((item) => item.record).filter(Boolean),
          manualInput: manualWasPicked
        },
        bubbles: true,
        composed: false
      })
    );
  }

  get selectedValuesForGroup() {
    if (this.previewMode && !this._value && this._values.length === 0) {
      const previewValues = this._items
        .filter(
          (item) =>
            !item.disabled &&
            item.value !== "" &&
            item.value !== MANUAL_INPUT_VALUE
        )
        .map((item) => item.value);
      if (this.selectionMode === "single") {
        return previewValues.slice(0, 1);
      }
      const max = Number(this.maxSelections);
      const cap = Number.isFinite(max) && max > 0 ? max : 2;
      return previewValues.slice(0, cap);
    }
    if (this.selectionMode === "single") {
      if (this.hasActiveManualSelection) return [MANUAL_INPUT_VALUE];
      return this._value ? [this._value] : [];
    }
    const values = this._values.filter((value) => !this.isManualValue(value));
    return this.hasActiveManualSelection ||
      this._values.some((value) => this.isManualValue(value))
      ? [...values, MANUAL_INPUT_VALUE]
      : values;
  }

  // The None tile's value is "" (Flow reads it as null), so "nothing selected"
  // and "None picked" look identical in value state; _noneSelected remembers
  // the pick so the tile can show as selected.
  get noneOptionIsSelected() {
    return this._noneSelected && this._includeNoneOption;
  }

  get manualValueForGroup() {
    if (this._manualInputValue) return this._manualInputValue;
    if (this.selectionMode === "single" && this.isManualValue(this._value)) {
      return this._value;
    }
    const manual = this._values.find((value) => this.isManualValue(value));
    return manual || "";
  }

  get hasActiveManualSelection() {
    if (!this._allowManualInput) return false;
    return (
      this._manualInputSelected ||
      this.isManualValue(this._value) ||
      this._values.some((value) => this.isManualValue(value))
    );
  }

  isManualValue(value) {
    if (!this._allowManualInput || !value) return false;
    return !this.renderedValueSet.has(String(value));
  }

  get renderedValueSet() {
    return new Set(this._items.map((item) => String(item.value ?? "")));
  }

  // --- State flags ---
  get isLoading() {
    if (this.forcedState) return false;
    return this._isLoading && !this.previewMode;
  }
  get hasError() {
    if (this.forcedState === "error") return true;
    return Boolean(this._errorMessage) && !this.previewMode;
  }
  get isEmpty() {
    if (this.forcedState === "empty") return true;
    if (this.forcedState === "error") return false;
    return (
      !this.isLoading &&
      !this.hasError &&
      this._items.length === 0 &&
      !this.previewMode
    );
  }
  get isPopulated() {
    if (this.forcedState) return false;
    return !this.isLoading && !this.hasError && this._items.length > 0;
  }
  // A forced error has no load error, so it shows the configured message.
  get resolvedErrorMessage() {
    return this._errorMessage || this.errorStateMessage;
  }

  get hasLabel() {
    return Boolean(this.label);
  }
  get hasHelp() {
    return Boolean(this.helpText);
  }
  get hasFieldHelp() {
    return Boolean(this.fieldLevelHelp);
  }

  // --- Flow validation ---
  @api
  validate() {
    if (this.previewMode) return { isValid: true };
    if (this.required) {
      if (this.selectionMode === "single" && !this._value) {
        return { isValid: false, errorMessage: "Please make a selection." };
      }
      if (this.selectionMode === "multi" && this._values.length === 0) {
        return { isValid: false, errorMessage: "Please make a selection." };
      }
    }
    const manualValidation = this.validateManualInput();
    if (!manualValidation.isValid) return manualValidation;
    if (this.selectionMode === "multi") {
      const min = Number(this.minSelections) || 0;
      if (this._values.length < min) {
        return {
          isValid: false,
          errorMessage: `Please select at least ${min} option(s).`
        };
      }
      if (
        this.maxSelections !== undefined &&
        this.maxSelections !== null &&
        this.maxSelections !== ""
      ) {
        const max = Number(this.maxSelections);
        if (this._values.length > max) {
          return {
            isValid: false,
            errorMessage: `Please select no more than ${max} option(s).`
          };
        }
      }
    }
    return { isValid: true };
  }

  validateManualInput() {
    if (!this.hasActiveManualSelection && !this.isManualValue(this._value)) {
      return { isValid: true };
    }
    const value = (this.manualValueForGroup || "").trim();
    if (!value) {
      return {
        isValid: false,
        errorMessage: "Enter a value for the manual option."
      };
    }
    const min = Number(this.manualInputMinLength || 0);
    if (Number.isFinite(min) && min > 0 && value.length < min) {
      return {
        isValid: false,
        errorMessage: `Enter at least ${min} character(s).`
      };
    }
    if (
      this.manualInputMaxLength !== undefined &&
      this.manualInputMaxLength !== null &&
      this.manualInputMaxLength !== ""
    ) {
      const max = Number(this.manualInputMaxLength);
      if (Number.isFinite(max) && max > 0 && value.length > max) {
        return {
          isValid: false,
          errorMessage: `Enter no more than ${max} character(s).`
        };
      }
    }
    return { isValid: true };
  }
}
