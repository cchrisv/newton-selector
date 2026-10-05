import { LightningElement, api } from "lwc";

export default class NewtonSelectorFlowCpeChoiceControl extends LightningElement {
  /** @type {Array<{label: string, value: string, icon?: string}>} Picklist options. */
  @api items = [];
  /** @type {string} Field label; visually hidden with form-variant="label-hidden". */
  @api label = "";
  /** @type {string} Help text shown in the info icon beside the label. */
  @api fieldLevelHelp = "";
  /** @type {string} Selected value. */
  @api value = "";
  /** @type {string} Use label-hidden for dense rows. */
  @api formVariant = "";
  /** @type {boolean} Prevents interaction. */
  @api disabled = false;
  /** @type {boolean} Adds a search box to the dropdown. */
  @api enableSearch = false;

  get fieldLabelClass() {
    const base = "slds-form-element__label slds-no-flex";
    return this.formVariant === "label-hidden"
      ? `${base} slds-assistive-text`
      : base;
  }

  get showFieldLevelHelp() {
    return Boolean(this.fieldLevelHelp) && this.formVariant !== "label-hidden";
  }

  handleSelectionChange(event) {
    event.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("valuechange", {
        detail: { value: event.detail.value }
      })
    );
  }
}
