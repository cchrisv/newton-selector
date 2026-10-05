import { api, LightningElement } from "lwc";

export default class NewtonSelectorFlowCpeContentConfig extends LightningElement {
  @api config;
  @api builderContext;
  @api automaticOutputVariables;

  handleValueChange(event) {
    this.dispatchEvent(
      new CustomEvent("configpatch", {
        detail: {
          value: {
            ...this.config,
            [event.currentTarget.name]: event.detail.newValue
          }
        }
      })
    );
  }
}
