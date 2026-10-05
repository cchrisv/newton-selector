import { createElement } from "lwc";
import NewtonSelectorFlowScreen from "c/newtonSelectorFlowScreen";

function mount(configOverrides = {}) {
  const config = {
    dataSource: "custom",
    layout: "grid",
    selectionMode: "single",
    autoAdvance: false,
    label: "Choose one",
    custom: { items: [{ label: "A", value: "a" }] },
    ...configOverrides
  };
  const el = createElement("c-newton-selector-flow-screen", {
    is: NewtonSelectorFlowScreen
  });
  el.selectorConfigJson = JSON.stringify(config);
  document.body.appendChild(el);
  return el;
}

describe("c-newton-selector-flow-screen", () => {
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
  });

  it("shows the error state with the configured message on malformed JSON", async () => {
    const el = createElement("c-newton-selector-flow-screen", {
      is: NewtonSelectorFlowScreen
    });
    el.selectorConfigJson = "{ not valid";
    document.body.appendChild(el);
    await Promise.resolve();
    const dataSelector = el.shadowRoot.querySelector(
      "c-newton-selector-data-selector"
    );
    const alert = dataSelector.shadowRoot.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain("Could not load options.");
  });

  it("deep-merges partial saved config with shared runtime defaults", async () => {
    const el = mount({
      dataSource: "collection",
      collection: {
        fieldMap: { label: "Name" }
      },
      gridConfig: {
        badge: { variant: "brand" }
      }
    });
    el.sourceRecords = [{ Id: "001xx000003DGbY", Name: "Acme" }];
    await Promise.resolve();

    const dataSelector = el.shadowRoot.querySelector(
      "c-newton-selector-data-selector"
    );
    expect(dataSelector.collectionConfig.records).toHaveLength(1);
    expect(dataSelector.collectionConfig.fieldMap).toEqual(
      expect.objectContaining({
        label: "Name",
        value: "",
        sublabel: "",
        icon: "",
        badge: "",
        helpText: ""
      })
    );
    expect(dataSelector.appearance.badgeVariant).toBe("brand");
    expect(dataSelector.appearance.badgePosition).toBe("bottom-inline");
    expect(dataSelector.manualInputLabel).toBe("Other");
  });

  it("selectionCount is 0 when single-select is cleared", async () => {
    const el = mount({ selectionMode: "single" });
    await Promise.resolve();
    const dataSelector = el.shadowRoot.querySelector(
      "c-newton-selector-data-selector"
    );
    dataSelector.dispatchEvent(
      new CustomEvent("valuechange", {
        detail: {
          value: "",
          values: [],
          record: null,
          records: [],
          label: "",
          labels: []
        },
        bubbles: true
      })
    );
    expect(el.selectionCount).toBe(0);
  });
});
