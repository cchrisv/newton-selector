import { api, LightningElement } from "lwc";
import { defaultSelectorConfig } from "c/newtonSelectorUtilityConfigDefaults";
import {
  isReference,
  readResourceValue
} from "c/newtonSelectorFlowCpeUtilityHelpers";

const MULTI_DEFAULT_LITERAL_ERROR =
  "Pick a text collection variable for multiple default selections.";

export default class NewtonSelectorFlowCpeBehaviorConfig extends LightningElement {
  @api config;
  @api builderContext;
  @api automaticOutputVariables;
  /** Flow resource bound to the screen component's `value` input (single select). */
  @api valueRef = "";
  /** Flow resource bound to the screen component's `values` input (multi select). */
  @api valuesRef = "";

  get _config() {
    return this.config || defaultSelectorConfig();
  }
  set _config(value) {
    this.dispatchEvent(
      new CustomEvent("configpatch", { detail: { path: [], value } })
    );
  }

  get hasDataSource() {
    return Boolean(this._config.dataSource);
  }
  get isSingleSelect() {
    return this._config.selectionMode === "single";
  }
  get isMultiSelect() {
    return this._config.selectionMode === "multi";
  }

  defaultSelectionError = "";

  // Single select pre-selects from a text value, multi select from a text
  // collection; each mode has its own Flow input.
  get defaultSelectionRefName() {
    return this.isMultiSelect ? "valuesRef" : "valueRef";
  }
  get defaultSelectionRef() {
    return this.isMultiSelect ? this.valuesRef : this.valueRef;
  }
  handleDefaultSelectionChange(event) {
    const value = readResourceValue(event);
    // A typed literal can't fill the `values` text collection; keep it unsaved.
    if (this.isMultiSelect && value && !isReference(value)) {
      this.defaultSelectionError = MULTI_DEFAULT_LITERAL_ERROR;
      return;
    }
    this.defaultSelectionError = "";
    this.dispatchRefChange(this.defaultSelectionRefName, value);
  }

  handleSelectionModeToggle(event) {
    const leaving = this.defaultSelectionRefName;
    this.defaultSelectionError = "";
    const value = event.detail.checked ? "multi" : "single";
    const next = { ...this._config, selectionMode: value };
    if (value === "multi") {
      next.autoAdvance = false;
    }
    this._config = next;
    this.dispatchRefChange(leaving, "");
  }
  handleToggleChange(event) {
    const key = event.currentTarget.dataset.key;
    this._config = { ...this._config, [key]: event.detail.checked };
  }
  get minSelectionsValue() {
    return Number(this._config.minSelections) > 0
      ? this._config.minSelections
      : "";
  }
  get maxSelectionsValue() {
    return this._config.maxSelections ?? "";
  }
  handleMinChange(event) {
    this._config = {
      ...this._config,
      minSelections: Number(event.target.value) || 0
    };
  }
  handleMaxChange(event) {
    const raw = event.target.value;
    this._config = {
      ...this._config,
      maxSelections: raw === "" ? null : Number(raw)
    };
  }
  handleErrorMessageChange(event) {
    this._config = {
      ...this._config,
      customErrorMessage: readResourceValue(event)
    };
  }

  get noneOptionPositionTiles() {
    const active = this._config.noneOptionPosition;
    return [
      {
        value: "start",
        label: "At start",
        sublabel: "Before items",
        icon: "shrink",
        _selected: active === "start"
      },
      {
        value: "end",
        label: "At end",
        sublabel: "After items",
        icon: "expand",
        _selected: active === "end"
      }
    ];
  }
  handleNoneOptionLabelChange(event) {
    this._config = { ...this._config, noneOptionLabel: event.target.value };
  }
  handleNoneOptionPositionChange(event) {
    const value = event.detail?.value;
    if (value === "start" || value === "end")
      this._config = { ...this._config, noneOptionPosition: value };
  }
  handleManualInputToggle(event) {
    this.patchManualInput("enabled", event.detail.checked);
  }
  handleManualInputLabelChange(event) {
    this.patchManualInput("label", event.target.value);
  }
  handleManualInputMinLengthChange(event) {
    this.patchManualInput("minLength", Number(event.target.value) || 0);
  }
  handleManualInputMaxLengthChange(event) {
    const raw = event.target.value;
    this.patchManualInput("maxLength", raw === "" ? null : Number(raw));
  }
  patchManualInput(key, value) {
    this._config = {
      ...this._config,
      manualInput: { ...this._config.manualInput, [key]: value }
    };
  }

  dispatchRefChange(name, value) {
    this.dispatchEvent(
      new CustomEvent("refchange", { detail: { name, value: value || "" } })
    );
  }
}
