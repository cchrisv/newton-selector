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
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
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
              getFirstRecordOnly: false,
              storeOutputAutomatically: true
            },
            {
              name: "Get_First_Account",
              label: "Get First Account",
              object: "Account",
              getFirstRecordOnly: true,
              storeOutputAutomatically: true
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
      el.shadowRoot.querySelector("input").click();
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
