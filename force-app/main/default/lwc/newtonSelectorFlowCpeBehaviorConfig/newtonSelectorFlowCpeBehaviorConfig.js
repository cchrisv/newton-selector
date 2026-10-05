import { api, LightningElement } from "lwc";
import { isReference } from "c/newtonSelectorFlowCpeUtilityHelpers";

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

  emit(config) {
    this.dispatchEvent(
      new CustomEvent("configpatch", { detail: { value: config } })
    );
  }

  get hasDataSource() {
    return Boolean(this.config.dataSource);
  }
  get isSingleSelect() {
    return this.config.selectionMode === "single";
  }
  get isMultiSelect() {
    return this.config.selectionMode === "multi";
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
    const value = event.detail.newValue;
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
    const next = { ...this.config, selectionMode: value };
    if (value === "multi") {
      next.autoAdvance = false;
    }
    this.emit(next);
    this.dispatchRefChange(leaving, "");
  }
  handleToggleChange(event) {
    const key = event.currentTarget.dataset.key;
    this.emit({ ...this.config, [key]: event.detail.checked });
  }
  get minSelectionsValue() {
    return Number(this.config.minSelections) > 0
      ? this.config.minSelections
      : "";
  }
  get maxSelectionsValue() {
    return this.config.maxSelections ?? "";
  }
  handleMinChange(event) {
    this.emit({
      ...this.config,
      minSelections: Number(event.target.value) || 0
    });
  }
  handleMaxChange(event) {
    const raw = event.target.value;
    this.emit({
      ...this.config,
      maxSelections: raw === "" ? null : Number(raw)
    });
  }
  handleErrorMessageChange(event) {
    this.emit({
      ...this.config,
      customErrorMessage: event.detail.newValue
    });
  }

  get noneOptionPositionTiles() {
    const active = this.config.noneOptionPosition;
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
    this.emit({ ...this.config, noneOptionLabel: event.target.value });
  }
  handleNoneOptionPositionChange(event) {
    this.emit({
      ...this.config,
      noneOptionPosition: event.detail.value
    });
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
    this.emit({
      ...this.config,
      manualInput: { ...this.config.manualInput, [key]: value }
    });
  }

  dispatchRefChange(name, value) {
    this.dispatchEvent(
      new CustomEvent("refchange", { detail: { name, value: value || "" } })
    );
  }
}
