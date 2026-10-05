import { LightningElement, api } from "lwc";
import { buildTokens } from "./searchTokens";

export default class NewtonSelectorFlowCpeLookupChoiceOption extends LightningElement {
  /** @type {Record<string, unknown>} */
  @api row = {};

  /** @type {string} */
  @api searchTerm = "";

  /** @type {boolean} */
  @api selected = false;

  get optionClass() {
    const base = "newton-visual-lookup-option";
    return this.selected
      ? `${base} newton-visual-lookup-option_selected`
      : base;
  }

  get title() {
    const r = this.row;
    return String(r.title || r.label || r.value || "");
  }

  // The meta line shows only the row's own subtitle, never its raw value or id.
  get subtitle() {
    const r = this.row;
    return String(r.subtitle || "");
  }

  get iconName() {
    const r = this.row;
    if (r.isCollection)
      return r.isObject ? "table-properties" : "square-library";
    if (r.isObject) return "database";
    return r.icon || r.optionIcon || "box";
  }

  get badge() {
    const r = this.row;
    return String(r.badge || r.sObjectType || "");
  }

  get showBadge() {
    return Boolean(this.badge);
  }

  get titleTokens() {
    return buildTokens(this.title, this.searchTerm);
  }
}
