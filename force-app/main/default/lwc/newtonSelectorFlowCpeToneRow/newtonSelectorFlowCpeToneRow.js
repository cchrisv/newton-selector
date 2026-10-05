import { api, LightningElement } from "lwc";
import { isHexColor } from "c/newtonSelectorUtilityConfigDefaults";

// A color input can only show #rrggbb: expand #rgb and drop the alpha of
// #rrggbbaa. Anything else (blank) passes through unchanged.
function swatchValue(hex) {
  if (!isHexColor(hex)) return hex;
  if (hex.length === 4) {
    return `#${[...hex.slice(1)].map((c) => c + c).join("")}`;
  }
  return hex.slice(0, 7);
}

/**
 * One tone chip row and, while its Custom chip is active, the custom color
 * swatch and hex box.
 *
 * @fires tonechange — detail `{ key: toneKey, value }` when a chip is picked.
 * @fires hexchange — detail `{ key: hexKey, value }` for a valid (or cleared)
 *   hex; a typed invalid hex shows an inline error and emits nothing.
 */
export default class NewtonSelectorFlowCpeToneRow extends LightningElement {
  /** @type {string} Eyebrow inside the row; omitted when blank. */
  @api label;
  /** @type {string} Accessible name of the chip group. */
  @api groupLabel;
  /** @type {string} Config key the chips set. */
  @api toneKey;
  /** @type {string} Config key the hex inputs set. */
  @api hexKey;
  /** @type {{value: string, label: string}[]} Chips, in display order. */
  @api tones = [];
  /** @type {string} Stored custom hex. */
  @api hexValue = "";
  @api hexPlaceholder = "#3baa6f";
  @api colorAriaLabel;
  @api hexAriaLabel;

  // Typed hex text that was rejected. The text box shows it with the inline
  // error until a valid value replaces it or the hex row closes.
  _draft = null;
  _value;
  _disabled = false;

  /** @type {string} Active tone. */
  @api
  get value() {
    return this._value;
  }
  set value(next) {
    this._value = next;
    this.dropClosedDraft();
  }

  /** @type {boolean} Disables the chips and hides the hex row. */
  @api
  get disabled() {
    return this._disabled;
  }
  set disabled(next) {
    this._disabled = next;
    this.dropClosedDraft();
  }

  get isCustom() {
    return !this._disabled && this._value === "custom";
  }
  get chips() {
    return this.tones.map((tone) => ({
      ...tone,
      className: [
        "newton-tone-chip",
        tone.value === this._value ? "newton-tone-chip_active" : "",
        this._disabled ? "newton-tone-chip_disabled" : ""
      ]
        .filter(Boolean)
        .join(" "),
      ariaPressed: String(tone.value === this._value),
      dotClassName: `newton-tone-chip__dot newton-tone-chip__dot_${tone.value}`
    }));
  }
  get swatchValue() {
    return swatchValue(this.hexValue);
  }
  get hexText() {
    return this._draft ?? this.hexValue;
  }
  get hexInvalid() {
    return this._draft === null ? undefined : "true";
  }

  handleToneClick(event) {
    this.emit("tonechange", this.toneKey, event.currentTarget.dataset.value);
  }

  handleHexChange(event) {
    const value = event.target.value.trim();
    if (value !== "" && !isHexColor(value)) {
      this._draft = value;
      return;
    }
    this._draft = null;
    this.emit("hexchange", this.hexKey, value);
  }

  dropClosedDraft() {
    if (!this.isCustom) this._draft = null;
  }

  emit(type, key, value) {
    this.dispatchEvent(new CustomEvent(type, { detail: { key, value } }));
  }
}
