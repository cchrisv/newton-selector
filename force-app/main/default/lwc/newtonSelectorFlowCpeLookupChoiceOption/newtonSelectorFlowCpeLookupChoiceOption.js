import { LightningElement, api } from "lwc";
import { buildTokens } from "c/newtonSelectorFlowCpeUtilitySearchHighlight";
import { TYPE_ICON_MAP } from "c/newtonSelectorFlowCpeUtilityHelpers";

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

  get normalizedRow() {
    return this.row && typeof this.row === "object" ? this.row : {};
  }

  get title() {
    const r = this.normalizedRow;
    const value = r.title || r.label || r.value || "";
    return String(value);
  }

  get subtitle() {
    const r = this.normalizedRow;
    const value = r.subtitle || r.displayType || "";
    return String(value);
  }

  get subtitleLine() {
    const value = String(
      this.normalizedRow.value || this.normalizedRow.id || ""
    ).trim();
    const subtitle = this.subtitle.trim();
    const showValue =
      value &&
      value !== this.title &&
      !subtitle.toLowerCase().includes(value.toLowerCase());
    const parts = [showValue ? value : "", subtitle]
      .map((part) => String(part || "").trim())
      .filter(Boolean);
    return [...new Set(parts)].join(" — ");
  }

  // A row's own icon wins; otherwise its type picks one from the shared map.
  get iconName() {
    const r = this.normalizedRow;
    if (r.isCollection)
      return r.isObject ? "table-properties" : "square-library";
    if (r.isObject) return "database";
    return (
      r.icon ||
      r.optionIcon ||
      TYPE_ICON_MAP[String(r.type || "").toUpperCase()] ||
      "box"
    );
  }

  get badge() {
    const r = this.normalizedRow;
    const value = r.badge || r.sObjectType || "";
    return String(value);
  }

  get showBadge() {
    return Boolean(this.badge);
  }

  get titleTokens() {
    return buildTokens(this.title, String(this.searchTerm || "").toLowerCase());
  }
}
