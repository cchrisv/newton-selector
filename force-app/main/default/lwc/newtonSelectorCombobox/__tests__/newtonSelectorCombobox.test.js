import { createElement } from "lwc";
import NewtonSelectorCombobox from "c/newtonSelectorCombobox";

const SAMPLE = [
  {
    id: "001a",
    sObjectType: "Account",
    icon: "building-2",
    title: "Acme Corp",
    subtitle: "Global HQ"
  },
  {
    id: "001b",
    sObjectType: "Account",
    icon: "building-2",
    title: "Globex",
    subtitle: "Regional"
  },
  {
    id: "001c",
    sObjectType: "Account",
    icon: "building-2",
    title: "Acme Foods",
    subtitle: "Subsidiary"
  }
];

function flush() {
  return Promise.resolve().then(() => Promise.resolve());
}

function mount(props = {}) {
  const element = createElement("c-newton-selector-combobox", {
    is: NewtonSelectorCombobox
  });
  Object.assign(element, props);
  document.body.appendChild(element);
  return element;
}

function mountLookup(props = {}) {
  return mount({ mode: "lookup", ...props });
}

function input(element) {
  return element.shadowRoot.querySelector('input[type="text"]');
}

function options(element) {
  return Array.from(element.shadowRoot.querySelectorAll('[role="option"]'));
}

function visualOptions(element) {
  return Array.from(
    element.shadowRoot.querySelectorAll(
      "c-newton-selector-flow-cpe-lookup-choice-option"
    )
  );
}

function dropdown(element) {
  return element.shadowRoot.querySelector(
    ".newton-selector-combobox__lookup-dropdown"
  );
}

function selectButton(element) {
  return element.shadowRoot.querySelector(
    ".newton-selector-combobox__select-button"
  );
}

function fireInput(element, value) {
  const searchInput = input(element);
  searchInput.value = value;
  searchInput.dispatchEvent(new CustomEvent("input"));
}

function pressKey(element, key) {
  input(element).dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true })
  );
}

describe("c-newton-selector-combobox", () => {
  beforeAll(() => {
    if (!Element.prototype.scrollIntoView) {
      Element.prototype.scrollIntoView = function () {};
    }
  });

  afterEach(() => {
    jest.useRealTimers();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("renders an SLDS combobox shell with slotted trigger and dropdown content", async () => {
    const element = mount({
      open: true,
      dropdownLabel: "Account options"
    });

    const trigger = document.createElement("button");
    trigger.slot = "trigger";
    trigger.textContent = "Choose";
    const option = document.createElement("span");
    option.slot = "dropdown";
    option.textContent = "Acme";
    element.appendChild(trigger);
    element.appendChild(option);
    await flush();

    const listbox = element.shadowRoot.querySelector('[role="listbox"]');

    expect(listbox).not.toBeNull();
    expect(listbox.getAttribute("aria-label")).toBe("Account options");
  });

  it("does not render slotted dropdown content while closed", async () => {
    const element = mount();
    await flush();

    expect(element.shadowRoot.querySelector(".slds-dropdown")).toBeNull();
  });

  it("renders static select options with owned combobox row styling", async () => {
    const element = mount({
      mode: "select",
      label: "Sort by",
      value: "label",
      options: [
        { label: "Source order", value: "none", icon: "list-ordered" },
        { label: "Label", value: "label", icon: "tag" }
      ]
    });
    const handler = jest.fn();
    element.addEventListener("selectionchange", handler);
    await flush();

    expect(selectButton(element).textContent).toContain("Label");
    selectButton(element).click();
    await flush();

    const rows = visualOptions(element);
    expect(rows).toHaveLength(2);
    expect(rows[1].selected).toBe(true);
    options(element)[0].click();

    expect(handler.mock.calls[0][0].detail).toEqual({ value: "none" });
  });

  it("closes the select dropdown when focus leaves the combobox", async () => {
    const element = mount({
      mode: "select",
      label: "Sort by",
      options: [{ label: "Label", value: "label" }]
    });
    selectButton(element).click();
    await flush();
    expect(options(element)).toHaveLength(1);

    selectButton(element).dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, relatedTarget: null })
    );
    await flush();

    expect(options(element)).toHaveLength(0);
  });

  it("labels the lookup input and marks it required", () => {
    const element = mountLookup({ label: "Find account", required: true });

    expect(input(element).getAttribute("aria-required")).toBe("true");
    expect(element.shadowRoot.querySelector("label").textContent).toContain(
      "Find account"
    );
    expect(element.shadowRoot.querySelector(".slds-required")).not.toBeNull();
  });

  it("keeps a label-hidden lookup input named by an assistive-text label", () => {
    const element = mountLookup({ label: "Field", variant: "label-hidden" });
    const label = element.shadowRoot.querySelector("label");

    expect(label.textContent).toContain("Field");
    expect(label.className).toContain("slds-assistive-text");
    expect(label.htmlFor).toBe(input(element).id);
  });

  it("keeps a label-hidden select button named by an assistive-text label", () => {
    const element = mount({
      mode: "select",
      label: "Operator",
      variant: "label-hidden",
      options: [{ label: "Equals", value: "=" }]
    });
    const label = element.shadowRoot.querySelector("label");

    expect(label.textContent).toContain("Operator");
    expect(label.className).toContain("slds-assistive-text");
    expect(label.htmlFor).toBe(selectButton(element).id);
  });

  it("normalizes lookup selection values", () => {
    const element = mountLookup();

    element.selection = {
      value: "Account",
      label: "Account"
    };

    expect(element.selection).toEqual(
      expect.objectContaining({
        id: "Account",
        title: "Account"
      })
    );
  });

  it("shows the richer row when the parent resends the same selection id", async () => {
    const element = mountLookup();

    element.selection = { id: "Region__c", title: "Region__c", icon: "type" };
    await flush();
    element.selection = { id: "Region__c", title: "Region", icon: "list" };
    await flush();

    expect(input(element).value).toBe("Region");
    expect(
      element.shadowRoot.querySelector(
        ".newton-selector-combobox__input-entity-icon c-newton-selector-icon"
      ).name
    ).toBe("list");
  });

  it("renders selected single-entry lookup as read-only with a clear action", async () => {
    const element = mountLookup();
    element.selection = { id: "001", title: "Acme", icon: "building-2" };
    await flush();

    expect(input(element).readOnly).toBe(true);
    expect(
      element.shadowRoot.querySelector('button[title="Remove selected option"]')
    ).not.toBeNull();
  });
  it("sets and renders lookup search results", async () => {
    const element = mountLookup();

    input(element).focus();
    await flush();
    element.setSearchResults(SAMPLE);
    await flush();

    expect(options(element)).toHaveLength(3);
    expect(visualOptions(element)[0].row).toEqual(
      expect.objectContaining({
        id: "001a",
        title: "Acme Corp",
        badge: ""
      })
    );
  });

  it("fires debounced lookup search with normalized and raw terms", () => {
    jest.useFakeTimers();
    const element = mountLookup();
    const handler = jest.fn();
    element.addEventListener("search", handler);

    fireInput(element, "AcMe");
    jest.advanceTimersByTime(300);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({
      searchTerm: "acme",
      rawSearchTerm: "AcMe"
    });
  });

  it("fires selectionchange when a lookup option is clicked", async () => {
    const element = mountLookup();
    const handler = jest.fn();
    element.addEventListener("selectionchange", handler);

    input(element).focus();
    await flush();
    element.setSearchResults(SAMPLE);
    await flush();
    options(element)[1].click();
    await flush();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.selectedIds).toEqual(["001b"]);
    expect(dropdown(element)).toBeNull();
  });

  it("clears single-entry lookup selection", async () => {
    const element = mountLookup();
    const handler = jest.fn();
    element.selection = { id: "1", title: "A" };
    element.addEventListener("selectionchange", handler);
    await flush();

    element.shadowRoot
      .querySelector('button[title="Remove selected option"]')
      .click();

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { selectedIds: [] } })
    );
    expect(element.selection).toBeNull();
  });

  it("supports lookup keyboard navigation and selection", async () => {
    const element = mountLookup();
    const handler = jest.fn();
    element.addEventListener("selectionchange", handler);

    input(element).focus();
    await flush();
    element.setSearchResults(SAMPLE);
    await flush();
    pressKey(element, "ArrowDown");
    await flush();
    pressKey(element, "Enter");

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ detail: { selectedIds: ["001b"] } })
    );
  });

  it("clears pending search timer on disconnect", () => {
    jest.useFakeTimers();
    const element = mountLookup();
    const handler = jest.fn();
    element.addEventListener("search", handler);

    fireInput(element, "a");
    document.body.removeChild(element);
    jest.advanceTimersByTime(500);

    expect(handler).not.toHaveBeenCalled();
  });
});
