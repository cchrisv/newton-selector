import { LightningElement, api } from "lwc";

export default class NewtonSelectorFlowCpeChoiceControl extends LightningElement {
  /** @type {Array<{label: string, value: string, subtitle?: string, icon?: string, badge?: string}>} Picklist options. */
  @api items = [];
  /** @type {string} Field label; the inner combobox carries it as the accessible name, and it is shown visibly unless form-variant="label-hidden". */
  @api label = "";
  /** @type {string} Help text shown in the info icon beside the label. */
  @api fieldLevelHelp = "";
  /** @type {string} Selected value. */
  @api value = "";
  /** @type {string} Use label-hidden for dense rows. */
  @api formVariant = "";
  /** @type {boolean} Adds a search box to the dropdown. */
  @api enableSearch = false;

  get showVisibleLabel() {
    return Boolean(this.label) && this.formVariant !== "label-hidden";
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
