import { createElement } from "lwc";

const mockClose = jest.fn();

jest.mock(
  "lightning/modal",
  () => {
    const { LightningElement } = require("lwc");
    return class extends LightningElement {
      close(value) {
        mockClose(value);
      }
    };
  },
  { virtual: true }
);

jest.mock(
  "c/newtonSelectorFlowCpeDataConfig",
  () => {
    const { LightningElement } = require("lwc");
    return class extends LightningElement {};
  },
  { virtual: true }
);
jest.mock(
  "c/newtonSelectorFlowCpeContentConfig",
  () => {
    const { LightningElement } = require("lwc");
    return class extends LightningElement {};
  },
  { virtual: true }
);
jest.mock(
  "c/newtonSelectorFlowCpeBehaviorConfig",
  () => {
    const { LightningElement } = require("lwc");
    return class extends LightningElement {};
  },
  { virtual: true }
);
jest.mock(
  "c/newtonSelectorFlowCpeAppearanceConfig",
  () => {
    const { LightningElement } = require("lwc");
    return class extends LightningElement {};
  },
  { virtual: true }
);

import NewtonSelectorFlowCpeConfigModal from "c/newtonSelectorFlowCpeConfigModal";

const VALID_CONFIG = {
  dataSource: "custom",
  label: "Choose one",
  selectionMode: "single",
  layout: "grid",
  helpText: "Pick carefully",
  custom: { items: [{ label: "One", value: "one" }] }
};

function mount(props = {}) {
  const element = createElement("c-newton-selector-flow-cpe-config-modal", {
    is: NewtonSelectorFlowCpeConfigModal
  });
  Object.assign(element, props);
  document.body.appendChild(element);
  return element;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

function child(element, selector) {
  return element.shadowRoot.querySelector(selector);
}

describe("c-newton-selector-flow-cpe-config-modal", () => {
  beforeEach(() => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    console.warn.mockRestore();
    mockClose.mockClear();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("ignores unknown ref changes", async () => {
    const element = mount({ initialConfig: VALID_CONFIG });
    const data = child(element, "c-newton-selector-flow-cpe-data-config");

    data.dispatchEvent(
      new CustomEvent("refchange", {
        detail: { name: "otherRef", value: "{!ignored}" }
      })
    );
    await flush();

    const nextData = child(element, "c-newton-selector-flow-cpe-data-config");
    expect(nextData.sourceRecordsRef).toBe("");
  });

  it("preserves save and cancel payloads", () => {
    const element = mount({
      initialConfig: VALID_CONFIG,
      initialSourceRecordsRef: "{!records}",
      initialValueRef: "{!preselected}"
    });
    const buttons = element.shadowRoot.querySelectorAll("lightning-button");
    buttons[1].click();
    expect(mockClose).toHaveBeenCalledWith({
      action: "save",
      config: expect.objectContaining({ dataSource: "custom" }),
      sourceRecordsRef: "{!records}",
      valueRef: "{!preselected}",
      valuesRef: ""
    });

    buttons[0].click();
    expect(mockClose).toHaveBeenCalledWith({ action: "cancel" });
  });
});
