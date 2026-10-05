import { createElement } from "lwc";
import NewtonSelectorDataSelector from "c/newtonSelectorDataSelector";
import { MANUAL_INPUT_VALUE } from "c/newtonSelectorUtilityDataSources";

function mount(overrides = {}) {
  const el = createElement("c-newton-selector-data-selector", {
    is: NewtonSelectorDataSelector
  });
  Object.assign(el, {
    sourceType: "custom",
    layout: "grid",
    selectionMode: "single",
    required: false,
    overrides: {},
    displayConfig: { sortBy: "none", sortDirection: "asc", limit: null },
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
          manualValue: "No"
        },
        bubbles: true
      })
    );
    expect(el.validate()).toEqual(expect.objectContaining({ isValid: false }));
  });
});
