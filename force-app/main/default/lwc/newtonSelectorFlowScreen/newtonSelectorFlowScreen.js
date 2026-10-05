import { LightningElement, api } from "lwc";
import {
  FlowAttributeChangeEvent,
  FlowNavigationNextEvent
} from "lightning/flowSupport";
import {
  mergeSelectorConfig,
  selectorPropsFromConfig
} from "c/newtonSelectorUtilityConfigDefaults";

const AUTO_ADVANCE_DELAY_MS = 150;

export default class NewtonSelectorFlowScreen extends LightningElement {
  @api selectedRecord;
  @api selectedRecords;

  _value = "";
  _values = [];
  _selectedLabel = "";
  _selectedLabels = [];
  _selectionCount = 0;
  _allValues = [];
  _allLabels = [];
  _autoAdvanceId;
  _selectorConfigJson = "";
  _sourceRecords;
  _config = mergeSelectorConfig();
  _configInvalid = false;
  // Built only when the config or the record collection changes, so the data
  // selector receives the same objects on every render and does not reload.
  _selectorProps = this.buildSelectorProps();

  // Flow can re-assign @api props after mount (debug runs, back/next,
  // conditional screens, resume). The setter re-parses on each new payload;
  // an empty push keeps the last config.
  @api
  get selectorConfigJson() {
    return this._selectorConfigJson;
  }
  set selectorConfigJson(v) {
    if (!v || v === this._selectorConfigJson) return;
    this._selectorConfigJson = v;
    try {
      this._config = mergeSelectorConfig(JSON.parse(v));
      this._configInvalid = false;
    } catch {
      // Unreadable config: show the error state instead of an empty selector.
      this._configInvalid = true;
    }
    this._selectorProps = this.buildSelectorProps();
  }

  @api
  get sourceRecords() {
    return this._sourceRecords;
  }
  set sourceRecords(v) {
    this._sourceRecords = v;
    this._selectorProps = this.buildSelectorProps();
  }

  @api
  get value() {
    return this._value;
  }
  set value(v) {
    this._value = v === undefined || v === null ? "" : String(v);
  }

  @api
  get values() {
    return this._values;
  }
  set values(v) {
    this._values = Array.isArray(v) ? [...v] : [];
  }

  // Outputs. selectedLabel/Labels are the label text of the current selection;
  // allValues/allLabels are every option the selector rendered (post
  // filter/sort/limit, including the None tile).
  @api
  get selectedLabel() {
    return this._selectedLabel;
  }
  @api
  get selectedLabels() {
    return this._selectedLabels;
  }
  @api
  get allValues() {
    return this._allValues;
  }
  @api
  get allLabels() {
    return this._allLabels;
  }
  @api
  get selectionCount() {
    return this._selectionCount;
  }

  disconnectedCallback() {
    if (this._autoAdvanceId) {
      clearTimeout(this._autoAdvanceId);
      this._autoAdvanceId = null;
    }
  }

  get selectorProps() {
    return this._selectorProps;
  }

  buildSelectorProps() {
    const records = Array.isArray(this._sourceRecords)
      ? this._sourceRecords
      : [];
    return {
      ...selectorPropsFromConfig(this._config, records),
      forcedState: this._configInvalid ? "error" : ""
    };
  }

  handleValueChange(event) {
    const { value, values, record, records, label, labels, manualInput } =
      event.detail;
    const isSingle = this._config.selectionMode !== "multi";

    if (isSingle) {
      this._value = value || "";
      this._values = [];
      this._selectedLabel = label || "";
      this._selectedLabels = [];
      this._selectionCount = this._value ? 1 : 0;
      this.dispatchEvent(new FlowAttributeChangeEvent("value", this._value));
      this.dispatchEvent(
        new FlowAttributeChangeEvent("selectedRecord", record || null)
      );
      this.dispatchEvent(
        new FlowAttributeChangeEvent("selectedLabel", this._selectedLabel)
      );
      this.dispatchEvent(
        new FlowAttributeChangeEvent("selectionCount", this._selectionCount)
      );
    } else {
      this._values = [...(values || [])];
      this._value = "";
      this._selectedLabels = Array.isArray(labels) ? [...labels] : [];
      this._selectedLabel = "";
      this._selectionCount = this._values.length;
      this.dispatchEvent(new FlowAttributeChangeEvent("values", this._values));
      this.dispatchEvent(
        new FlowAttributeChangeEvent("selectedRecords", records || [])
      );
      this.dispatchEvent(
        new FlowAttributeChangeEvent("selectedLabels", this._selectedLabels)
      );
      this.dispatchEvent(
        new FlowAttributeChangeEvent("selectionCount", this._selectionCount)
      );
    }

    // Typing into the manual "Other" field changes the value on every
    // keystroke; only a finished pick may advance the screen.
    if (isSingle && this._config.autoAdvance && this._value && !manualInput) {
      this.triggerAutoAdvance();
    }
  }

  // The data selector fires `itemschange` whenever the rendered set of options
  // changes. Mirror it out so admins can bind allValues/allLabels downstream.
  handleItemsChange(event) {
    const { values, labels } = event.detail;
    this._allValues = [...values];
    this._allLabels = [...labels];
    this.dispatchEvent(
      new FlowAttributeChangeEvent("allValues", this._allValues)
    );
    this.dispatchEvent(
      new FlowAttributeChangeEvent("allLabels", this._allLabels)
    );
  }

  triggerAutoAdvance() {
    if (this._autoAdvanceId) clearTimeout(this._autoAdvanceId);
    this._autoAdvanceId = setTimeout(() => {
      this._autoAdvanceId = null;
      this.dispatchEvent(new FlowNavigationNextEvent());
    }, AUTO_ADVANCE_DELAY_MS);
  }

  @api
  validate() {
    const dataSelector = this.template.querySelector(
      "c-newton-selector-data-selector"
    );
    if (!dataSelector) return { isValid: true };
    const result = dataSelector.validate();
    if (!result.isValid && this._config.customErrorMessage) {
      return { isValid: false, errorMessage: this._config.customErrorMessage };
    }
    return result;
  }
}
