import { LightningElement, api } from "lwc";
import {
  FlowAttributeChangeEvent,
  FlowNavigationFinishEvent,
  FlowNavigationNextEvent
} from "lightning/flowSupport";
import configUnreadable from "@salesforce/label/c.Newton_Selector_ConfigUnreadable";
import {
  mergeSelectorConfig,
  selectorPropsFromConfig
} from "c/newtonSelectorUtilityConfigDefaults";
import { formatLabel } from "c/newtonSelectorUtilityDataSources";

const AUTO_ADVANCE_DELAY_MS = 150;

export default class NewtonSelectorFlowScreen extends LightningElement {
  @api selectedRecord;
  @api selectedRecords;
  // Supplied by the Flow runtime: the navigation actions this screen offers.
  @api availableActions = [];

  _value = "";
  _values = [];
  _selectedLabel = "";
  _selectedLabels = [];
  _selectionCount = 0;
  _allValues = [];
  _allLabels = [];
  _autoAdvanceId;
  // Flow renders no validation message for a component that implements
  // reportValidity, so the selector shows its own and clears it on the next
  // pick, as SLDS form fields do. _flowError is the message Flow passes in.
  _flowError = "";
  _validationMessage = "";
  _selectorConfigJson = "";
  _sourceRecords;
  _config = mergeSelectorConfig();
  // The message shown when selectorConfigJson cannot be parsed; "" when it can.
  _configError = "";
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
      this._configError = "";
    } catch (e) {
      this._configError = formatLabel(configUnreadable, e.message);
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

  get validationMessage() {
    return this._validationMessage;
  }

  buildSelectorProps() {
    const records = Array.isArray(this._sourceRecords)
      ? this._sourceRecords
      : [];
    const props = selectorPropsFromConfig(this._config, records);
    if (!this._configError) return { ...props, forcedState: "" };
    return {
      ...props,
      forcedState: "error",
      errorStateMessage: this._configError
    };
  }

  // `userAction` is false when the data selector reports a pre-selected value
  // after its options load; only a user's pick may auto-advance, and not one
  // made by arrowing through the radio tiles (`fromArrowKey`), so a keyboard
  // user can browse the options.
  handleValueChange(event) {
    const {
      value,
      values,
      record,
      records,
      label,
      labels,
      manualInput,
      userAction,
      fromArrowKey
    } = event.detail;
    const isSingle = this._config.selectionMode !== "multi";

    if (isSingle) {
      this._value = value;
      this._values = [];
      this._selectedLabel = label;
      this._selectedLabels = [];
      this._selectionCount = value ? 1 : 0;
      this.dispatchEvent(new FlowAttributeChangeEvent("value", this._value));
      this.dispatchEvent(
        new FlowAttributeChangeEvent("selectedRecord", record)
      );
      this.dispatchEvent(
        new FlowAttributeChangeEvent("selectedLabel", this._selectedLabel)
      );
      this.dispatchEvent(
        new FlowAttributeChangeEvent("selectionCount", this._selectionCount)
      );
    } else {
      this._values = [...values];
      this._value = "";
      this._selectedLabels = [...labels];
      this._selectedLabel = "";
      this._selectionCount = this._values.length;
      this.dispatchEvent(new FlowAttributeChangeEvent("values", this._values));
      this.dispatchEvent(
        new FlowAttributeChangeEvent("selectedRecords", records)
      );
      this.dispatchEvent(
        new FlowAttributeChangeEvent("selectedLabels", this._selectedLabels)
      );
      this.dispatchEvent(
        new FlowAttributeChangeEvent("selectionCount", this._selectionCount)
      );
    }

    if (userAction && this._validationMessage) {
      this._flowError = "";
      this.reportValidity();
    }

    // Typing into the manual "Other" field changes the value on every
    // keystroke; only a finished pick may advance the screen.
    if (
      isSingle &&
      userAction &&
      !fromArrowKey &&
      this._config.autoAdvance &&
      this._value &&
      !manualInput
    ) {
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
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._autoAdvanceId = setTimeout(() => {
      this._autoAdvanceId = null;
      // The Flow's last screen offers Finish instead of Next.
      if (this.availableActions.includes("NEXT")) {
        this.dispatchEvent(new FlowNavigationNextEvent());
      } else if (this.availableActions.includes("FINISH")) {
        this.dispatchEvent(new FlowNavigationFinishEvent());
      }
    }, AUTO_ADVANCE_DELAY_MS);
  }

  @api
  validate() {
    const result = this.template
      .querySelector("c-newton-selector-data-selector")
      .validate();
    // The Error message applies only while Required is on.
    if (
      !result.isValid &&
      this._config.required &&
      this._config.customErrorMessage
    ) {
      return { isValid: false, errorMessage: this._config.customErrorMessage };
    }
    return result;
  }

  @api
  setCustomValidity(message) {
    this._flowError = message;
  }

  @api
  reportValidity() {
    const result = this.validate();
    this._validationMessage =
      this._flowError || (result.isValid ? "" : result.errorMessage);
  }
}
