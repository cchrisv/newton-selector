import { createElement } from "lwc";
import NewtonSelectorDataSelector from "c/newtonSelectorDataSelector";
import { MANUAL_INPUT_VALUE } from "c/newtonSelectorUtilityDataSources";
import queryItems from "@salesforce/apex/NewtonSelectorRuntimeController.queryItems";

jest.mock(
  "@salesforce/apex/NewtonSelectorRuntimeController.queryItems",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

function mount(overrides = {}) {
  const el = createElement("c-newton-selector-data-selector", {
    is: NewtonSelectorDataSelector
  });
  Object.assign(el, {
    sourceType: "custom",
    layout: "grid",
    selectionMode: "single",
    required: false,
    ...overrides
  });
  document.body.appendChild(el);
  return el;
}

describe("c-newton-selector-data-selector", () => {
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
  });

  it("sends the SOQL limit to Apex as queryLimit", async () => {
    queryItems.mockResolvedValue([]);
    mount({
      sourceType: "sobject",
      sobjectConfig: { sObjectApiName: "Account", limit: 7 }
    });
    await Promise.resolve();
    await Promise.resolve();

    const sent = JSON.parse(queryItems.mock.calls[0][0].configJson);
    expect(sent.queryLimit).toBe(7);
    expect(sent.limit).toBeUndefined();
  });

  it("does not apply per-item overrides to record collection items", async () => {
    const el = mount({
      sourceType: "collection",
      collectionConfig: {
        records: [
          { Id: "001", Name: "Acme" },
          { Id: "002", Name: "Beta" }
        ],
        fieldMap: { label: "Name", value: "Id" }
      },
      overrides: {
        "001": { label: "Preferred", hidden: true }
      }
    });
    await Promise.resolve();
    await Promise.resolve();

    const group = el.shadowRoot.querySelector("c-newton-selector-group");
    expect(group.items.map((item) => item.label)).toEqual(["Acme", "Beta"]);
  });

  it("shows empty state when no items and not previewing", async () => {
    const el = mount({ customConfig: { items: [] } });
    await Promise.resolve();
    await Promise.resolve();
    const empty = el.shadowRoot.querySelector(".newton-state_empty");
    expect(empty).not.toBeNull();
  });

  it("validate() always passes in preview mode", async () => {
    const el = mount({ required: true, previewMode: true });
    await Promise.resolve();
    expect(el.validate().isValid).toBe(true);
  });

  it("preselects sample values in preview mode so selected-state styling is visible", async () => {
    const el = mount({
      previewMode: true,
      customConfig: {
        items: [
          { label: "None-like", value: "" },
          { label: "A", value: "a" },
          { label: "B", value: "b" }
        ]
      }
    });
    await Promise.resolve();
    await Promise.resolve();

    const group = el.shadowRoot.querySelector("c-newton-selector-group");
    expect(group.selectedValues).toEqual(["a"]);
  });

  it("preselects sample values up to maxSelections in multi-select preview mode", async () => {
    const el = mount({
      previewMode: true,
      selectionMode: "multi",
      maxSelections: 2,
      customConfig: {
        items: [
          { label: "A", value: "a" },
          { label: "B", value: "b" },
          { label: "C", value: "c" }
        ]
      }
    });
    await Promise.resolve();
    await Promise.resolve();

    const group = el.shadowRoot.querySelector("c-newton-selector-group");
    expect(group.selectedValues).toEqual(["a", "b"]);
  });

  it("rebuilds preview items when none option settings change after data loads", async () => {
    const el = mount({
      previewMode: true,
      includeNoneOption: true,
      noneOptionLabel: "No choice",
      noneOptionPosition: "start",
      customConfig: {
        items: [
          { label: "A", value: "a" },
          { label: "B", value: "b" }
        ]
      }
    });
    await Promise.resolve();
    await Promise.resolve();

    let group = el.shadowRoot.querySelector("c-newton-selector-group");
    expect(group.items.map((item) => item.label)).toEqual([
      "No choice",
      "A",
      "B"
    ]);

    el.noneOptionPosition = "end";
    await Promise.resolve();
    await Promise.resolve();

    group = el.shadowRoot.querySelector("c-newton-selector-group");
    expect(group.items.map((item) => item.label)).toEqual([
      "A",
      "B",
      "No choice"
    ]);

    el.noneOptionLabel = "Skip";
    await Promise.resolve();
    await Promise.resolve();

    group = el.shadowRoot.querySelector("c-newton-selector-group");
    expect(group.items.map((item) => item.label)).toEqual(["A", "B", "Skip"]);
  });

  it("returns manual input text through the value output", async () => {
    const el = mount({
      allowManualInput: true,
      manualInputLabel: "Other",
      manualInputMinLength: 3,
      customConfig: {
        items: [{ label: "A", value: "a" }]
      }
    });
    const handler = jest.fn();
    el.addEventListener("valuechange", handler);
    await Promise.resolve();
    await Promise.resolve();

    const group = el.shadowRoot.querySelector("c-newton-selector-group");
    expect(group.items.map((item) => item.value)).toEqual([
      "a",
      MANUAL_INPUT_VALUE
    ]);

    group.dispatchEvent(
      new CustomEvent("selectionchange", {
        detail: {
          values: [MANUAL_INPUT_VALUE],
          items: [group.items[1]],
          manualValue: "Manual answer"
        },
        bubbles: true
      })
    );

    expect(handler.mock.calls[0][0].detail.value).toBe("Manual answer");
    expect(handler.mock.calls[0][0].detail.label).toBe("Manual answer");
    expect(el.validate().isValid).toBe(true);
  });

  it("validates manual input character limits", async () => {
    const el = mount({
      allowManualInput: true,
      manualInputMinLength: 3,
      manualInputMaxLength: 6,
      customConfig: {
        items: [{ label: "A", value: "a" }]
      }
    });
    await Promise.resolve();
    await Promise.resolve();

    const group = el.shadowRoot.querySelector("c-newton-selector-group");
    group.dispatchEvent(
      new CustomEvent("selectionchange", {
        detail: {
          values: [MANUAL_INPUT_VALUE],
          items: [group.items[1]],
          manualValue: "No"
        },
        bubbles: true
      })
    );
    expect(el.validate()).toEqual(expect.objectContaining({ isValid: false }));
  });
});
