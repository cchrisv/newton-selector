import { createElement } from "lwc";
import NewtonSelectorFlowCpeResourceSelector from "c/newtonSelectorFlowCpeResourceSelector";

function mount(props = {}) {
  const el = createElement("c-newton-selector-flow-cpe-resource-selector", {
    is: NewtonSelectorFlowCpeResourceSelector
  });
  Object.assign(el, props);
  document.body.appendChild(el);
  return el;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function selectedTrigger(el) {
  return el.shadowRoot.querySelector(
    ".newton-selector-flow-cpe-resource-selector__selected-trigger"
  );
}

describe("c-newton-selector-flow-cpe-resource-selector", () => {
  beforeAll(() => {
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = function () {};
    }
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  describe("rendering", () => {
    it("renders a visible label by default (variant=standard)", () => {
      const el = mount({ label: "Value" });
      const lbl = el.shadowRoot.querySelector("label");
      expect(lbl.className).toContain("slds-form-element__label");
      expect(lbl.className).not.toContain("slds-assistive-text");
      expect(lbl.textContent.trim()).toBe("Value");
    });

    it("applies slds-assistive-text when variant=label-hidden", () => {
      const el = mount({ label: "Value", variant: "label-hidden" });
      const lbl = el.shadowRoot.querySelector("label");
      expect(lbl.className).toContain("slds-assistive-text");
    });

    it("applies max-width style when maxWidth is set", () => {
      const el = mount({ maxWidth: 280 });
      const wrapper = el.shadowRoot.querySelector("div[style]");
      expect(wrapper.getAttribute("style")).toContain("max-width: 280px");
    });

    it("passes required through to lightning-input", async () => {
      const el = mount({ required: true });
      await flush();
      expect(el.shadowRoot.querySelector("lightning-input").required).toBe(
        true
      );
    });
  });

  describe("displayed value", () => {
    it("shows a reference as the selected resource", async () => {
      const el = mount({});
      el.value = "{!myVar}";
      await flush();
      expect(selectedTrigger(el).textContent).toContain("myVar");
    });

    it("stays in input mode for plain literal values", async () => {
      const el = mount({});
      el.value = "plain literal";
      await flush();
      expect(selectedTrigger(el)).toBeNull();
    });

    it("drops the resource display when a literal replaces a reference", async () => {
      const el = mount({});
      el.value = "{!ref}";
      await flush();
      el.value = "now a literal";
      await flush();
      expect(selectedTrigger(el)).toBeNull();
    });

    it("shows the reference path as the selected trigger label", async () => {
      const el = mount({});
      el.value = "{!Account.Name}";
      await flush();
      const label = el.shadowRoot.querySelector(
        ".newton-selector-flow-cpe-resource-selector__selected-label"
      );
      expect(label.textContent).toBe("Account.Name");
    });

    it("deduplicates repeated selected reference segments", async () => {
      const el = mount({});
      el.value = "{!Get_E2E_Leads.Get_E2E_Leads}";
      await flush();
      const label = el.shadowRoot.querySelector(
        ".newton-selector-flow-cpe-resource-selector__selected-label"
      );
      expect(label.textContent).toBe("Get_E2E_Leads");
    });
  });

  describe("valuechanged event", () => {
    it("reports a picked resource as a {!...} merge field", async () => {
      const el = mount({
        name: "selectorLabel",
        builderContextFilterType: "String",
        builderContext: {
          variables: [
            {
              name: "selectorLabelText",
              label: "Selector Label Text",
              dataType: "String"
            }
          ]
        },
        automaticOutputVariables: {}
      });
      await flush();

      const handler = jest.fn();
      el.addEventListener("valuechanged", handler);
      el.shadowRoot.querySelector("lightning-input").click();
      await flush();
      el.shadowRoot
        .querySelector(
          '.newton-selector-flow-cpe-resource-selector__option[data-value="selectorLabelText"]'
        )
        .click();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].detail).toEqual(
        expect.objectContaining({
          id: "selectorLabel",
          newValue: "{!selectorLabelText}"
        })
      );
    });
  });

  describe("builder context filtering", () => {
    it("shows only SObject record collections for collection binding", async () => {
      const el = mount({
        builderContextFilterType: "SObject",
        builderContextFilterCollectionBoolean: true,
        builderContext: {
          recordLookups: [
            {
              name: "Get_Leads",
              label: "Get Leads",
              object: "Lead",
              getFirstRecordOnly: "false"
            },
            {
              name: "Get_First_Account",
              label: "Get First Account",
              object: "Account",
              getFirstRecordOnly: "true"
            }
          ],
          screens: [
            {
              name: "Lead_Screen",
              label: "Lead Screen",
              fields: [
                {
                  name: "Lead_Component",
                  label: "Lead Component",
                  dataType: "String",
                  storeOutputAutomatically: true
                }
              ]
            }
          ]
        },
        automaticOutputVariables: {}
      });

      await flush();
      el.shadowRoot.querySelector("lightning-input").click();
      await flush();

      const options = [
        ...el.shadowRoot.querySelectorAll(
          "c-newton-selector-flow-cpe-lookup-choice-option"
        )
      ].map((option) => option.row);
      const optionLabels = options.map((option) => option.label);

      expect(options).toEqual([
        expect.objectContaining({
          label: "Get Leads",
          value: "Get_Leads",
          objectType: "Lead",
          isCollection: true,
          isObject: true
        })
      ]);
      expect(optionLabels).not.toContain("Get First Account");
      expect(optionLabels).not.toContain("Lead Component");
      expect(el.shadowRoot.textContent).not.toContain("Screen Components");
    });
  });
});
