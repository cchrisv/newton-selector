import { createElement } from "lwc";
import NewtonSelectorGroup from "c/newtonSelectorGroup";
import { MANUAL_INPUT_VALUE } from "c/newtonSelectorUtilityDataSources";

// Jest resolves Custom Labels to their names; these tests find panels by
// their accessible names, so give those labels their English text.
jest.mock(
  "@salesforce/label/c.Newton_Selector_AvailableCardColumn",
  () => ({ default: "Available card column" }),
  { virtual: true }
);
jest.mock(
  "@salesforce/label/c.Newton_Selector_SelectedCardColumn",
  () => ({ default: "Selected card column" }),
  { virtual: true }
);
jest.mock(
  "@salesforce/label/c.Newton_Selector_AvailableOptions",
  () => ({ default: "Available options" }),
  { virtual: true }
);

const ITEMS = [
  {
    id: "1",
    label: "Alpha",
    sublabel: "",
    icon: "",
    badge: "",
    helpText: "",
    value: "a"
  },
  {
    id: "2",
    label: "Beta",
    sublabel: "",
    icon: "",
    badge: "",
    helpText: "",
    value: "b"
  },
  {
    id: "3",
    label: "Gamma",
    sublabel: "",
    icon: "",
    badge: "",
    helpText: "",
    value: "c"
  }
];

function mount(props = {}) {
  const el = createElement("c-newton-selector-group", {
    is: NewtonSelectorGroup
  });
  Object.assign(el, { items: ITEMS, selectionMode: "single", ...props });
  document.body.appendChild(el);
  return el;
}

function dispatchCardSelect(hostEl, value) {
  const card = hostEl.shadowRoot.querySelector("c-newton-selector-choice-tile");
  dispatchCardSelectFrom(card, value);
}

function dispatchCardSelectFrom(card, value) {
  card.dispatchEvent(
    new CustomEvent("cardselect", {
      detail: { value },
      bubbles: true
    })
  );
}

describe("c-newton-selector-group", () => {
  // jsdom has no scrollIntoView; the open Dropdown scrolls its active option.
  beforeAll(() => {
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = function () {};
    }
  });

  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
  });

  it("ignores events in preview mode", async () => {
    const el = mount();
    el.previewMode = true;
    const handler = jest.fn();
    el.addEventListener("selectionchange", handler);
    await Promise.resolve();
    dispatchCardSelect(el, "b");
    expect(handler).not.toHaveBeenCalled();
  });

  it("keeps multiselect picklist open and toggles card options", async () => {
    const el = mount({
      variant: "picklist",
      selectionMode: "multi",
      selectedValues: ["a"],
      enableSearch: true
    });
    const handler = jest.fn();
    el.addEventListener("selectionchange", handler);
    await Promise.resolve();

    el.shadowRoot
      .querySelector('[role="combobox"]')
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();

    // The only search box is the one inside the open menu.
    const searches = el.shadowRoot.querySelectorAll('input[type="search"]');
    expect(searches).toHaveLength(1);
    expect(searches[0].getAttribute("aria-controls")).toBe(
      el.shadowRoot.querySelector('[role="listbox"]').id
    );
    const rows = el.shadowRoot.querySelectorAll(
      ".newton-picklist__menu .newton-picklist__option"
    );
    rows[1].click();
    await Promise.resolve();

    expect(handler.mock.calls[0][0].detail.values).toEqual(["a", "b"]);
    expect(
      el.shadowRoot.querySelector(".newton-picklist__menu")
    ).not.toBeNull();
  });

  it("renders drag/drop columns with available and selected card panels", async () => {
    const el = mount({
      variant: "columns",
      selectionMode: "multi",
      selectedValues: ["b"]
    });
    await Promise.resolve();

    const available = el.shadowRoot.querySelector(
      'section[aria-label="Available card column"]'
    );
    const selected = el.shadowRoot.querySelector(
      'section[aria-label="Selected card column"]'
    );
    expect(
      available.querySelectorAll("c-newton-selector-choice-tile")
    ).toHaveLength(2);
    expect(
      selected.querySelector("c-newton-selector-choice-tile").item.value
    ).toBe("b");
  });

  it("filters transfer layouts from the available panel", async () => {
    const el = mount({
      variant: "dualListbox",
      selectionMode: "multi",
      enableSearch: true
    });
    await Promise.resolve();

    const search = el.shadowRoot.querySelector('input[type="search"]');
    search.value = "Gamma";
    search.dispatchEvent(new CustomEvent("input", { bubbles: true }));
    await Promise.resolve();

    const available = el.shadowRoot.querySelector(
      '[role="listbox"][aria-label="Available options"]'
    );
    const options = available.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(1);
    expect(options[0].dataset.value).toBe("c");
  });

  it("shows manual input after the manual option is selected", async () => {
    const manualItem = {
      id: MANUAL_INPUT_VALUE,
      label: "Other",
      value: MANUAL_INPUT_VALUE,
      manualInput: true
    };
    const el = mount({
      items: [...ITEMS, manualItem],
      manualInputLabel: "Other response",
      manualInputMinLength: 2,
      manualInputMaxLength: 10
    });
    const handler = jest.fn();
    el.addEventListener("selectionchange", handler);
    await Promise.resolve();

    const cards = el.shadowRoot.querySelectorAll(
      "c-newton-selector-choice-tile"
    );
    dispatchCardSelectFrom(cards[cards.length - 1], MANUAL_INPUT_VALUE);
    await Promise.resolve();

    const input = el.shadowRoot.querySelector(".newton-manual-input__control");
    expect(input).not.toBeNull();
    expect(input.getAttribute("minlength")).toBe("2");
    expect(input.getAttribute("maxlength")).toBe("10");
    input.value = "Manual";
    input.dispatchEvent(new CustomEvent("input", { bubbles: true }));

    expect(handler.mock.calls.at(-1)[0].detail.values).toEqual([
      MANUAL_INPUT_VALUE
    ]);
    expect(handler.mock.calls.at(-1)[0].detail.manualValue).toBe("Manual");
  });

  it("supports dragging cards between transfer columns", async () => {
    const el = mount({ variant: "columns", selectionMode: "multi" });
    const handler = jest.fn();
    el.addEventListener("selectionchange", handler);
    await Promise.resolve();

    const availableItem = el.shadowRoot.querySelector(".newton-transfer__item");
    const dragData = {};
    const dragStart = new CustomEvent("dragstart", { bubbles: true });
    Object.defineProperty(dragStart, "dataTransfer", {
      value: {
        setData: jest.fn((type, value) => {
          dragData[type] = value;
        })
      }
    });
    availableItem.dispatchEvent(dragStart);

    const selectedPanel = el.shadowRoot.querySelector(
      'section[aria-label="Selected card column"]'
    );
    const drop = new CustomEvent("drop", { bubbles: true });
    Object.defineProperty(drop, "dataTransfer", {
      value: {
        getData: jest.fn((type) => dragData[type])
      }
    });
    selectedPanel.dispatchEvent(drop);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.values).toEqual(["a"]);
  });
});
