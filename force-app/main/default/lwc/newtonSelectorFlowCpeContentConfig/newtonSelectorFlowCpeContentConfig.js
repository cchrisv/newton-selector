import { api, LightningElement } from "lwc";
import { readResourceValue } from "c/newtonSelectorFlowCpeUtilityHelpers";

export default class NewtonSelectorFlowCpeContentConfig extends LightningElement {
  @api config;
  @api builderContext;
  @api automaticOutputVariables;

  handleValueChange(event) {
    this.dispatchEvent(
      new CustomEvent("configpatch", {
        detail: {
          path: [event.currentTarget.name],
          value: readResourceValue(event)
        }
      })
    );
  }
}
