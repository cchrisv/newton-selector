import { LightningElement, api } from "lwc";

/*
 * Adapted from UnofficialSF FlowScreenComponentsBasePack fsc_flowCheckbox
 * (https://github.com/UnofficialSF/LightningFlowComponents), licensed under
 * the Apache License 2.0. See repo LICENSE and NOTICE for attribution.
 */

const NEXT_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

/**
 * Two-state setting control: a radio group of an "off" and an "on" option.
 * Keyboard: one tab stop (the checked option); arrow keys switch, Home picks
 * off, End picks on.
 *
 * @fires toggle — detail `{ checked }`.
 */
export default class NewtonSelectorFlowCpeToggle extends LightningElement {
  /** @type {string} Accessible name; shown above the control unless label-hidden. */
  @api label;
  /** @type {boolean} Current value. */
  @api checked = false;
  /** @type {string} 'label-hidden' hides the visible label. */
  @api variant;
  /** @type {string} Text of the "on" option. */
  @api activeLabel = "On";
  /** @type {string} Text of the "off" option. */
  @api inactiveLabel = "Off";

  get isChecked() {
    return this.checked === true;
  }

  get rootClass() {
    return this.variant === "label-hidden"
      ? "newton-selector-flow-cpe-toggle newton-selector-flow-cpe-toggle_label-hidden"
      : "newton-selector-flow-cpe-toggle";
  }

  get hasVisibleLabel() {
    return Boolean(this.label) && this.variant !== "label-hidden";
  }

  get activeOptionClass() {
    return this.optionClass(true);
  }

  get inactiveOptionClass() {
    return this.optionClass(false);
  }

  get activeAriaChecked() {
    return String(this.isChecked);
  }

  get inactiveAriaChecked() {
    return String(!this.isChecked);
  }

  get activeTabIndex() {
    return this.isChecked ? "0" : "-1";
  }

  get inactiveTabIndex() {
    return this.isChecked ? "-1" : "0";
  }

  optionClass(optionValue) {
    const classes = [
      "newton-selector-flow-cpe-toggle__option",
      optionValue
        ? "newton-selector-flow-cpe-toggle__option_on"
        : "newton-selector-flow-cpe-toggle__option_off"
    ];
    if (this.isChecked === optionValue) {
      classes.push("newton-selector-flow-cpe-toggle__option_active");
    }
    return classes.join(" ");
  }

  handleChoiceClick(event) {
    this.select(event.currentTarget.dataset.checked === "true");
  }

  handleKeydown(event) {
    let isOn;
    if (NEXT_KEYS.has(event.key)) {
      isOn = event.target.dataset.checked !== "true";
    } else if (event.key === "Home") {
      isOn = false;
    } else if (event.key === "End") {
      isOn = true;
    } else {
      return;
    }
    event.preventDefault();
    this.template.querySelector(`button[data-checked="${isOn}"]`).focus();
    this.select(isOn);
  }

  select(isOn) {
    if (isOn === this.isChecked) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent("toggle", { detail: { checked: isOn } })
    );
  }
}
