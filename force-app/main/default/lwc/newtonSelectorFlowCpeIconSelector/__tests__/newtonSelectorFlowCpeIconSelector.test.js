import { createElement } from "lwc";
import NewtonSelectorFlowCpeIconSelector from "c/newtonSelectorFlowCpeIconSelector";

async function mountOpen(value = "") {
  const el = createElement("c-newton-selector-flow-cpe-icon-selector", {
    is: NewtonSelectorFlowCpeIconSelector
  });
  el.value = value;
  document.body.appendChild(el);
  el.shadowRoot.querySelector(".newton-combobox__trigger").click();
  await Promise.resolve();
  return el;
}

function cells(el) {
  return el.shadowRoot.querySelectorAll(".newton-selector-icon-cell");
}

describe("c-newton-selector-flow-cpe-icon-selector", () => {
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
  });

  it("fires iconselect with the clicked icon's name", async () => {
    const el = await mountOpen();
    const handler = jest.fn();
    el.addEventListener("iconselect", handler);

    const firstIcon = cells(el)[0];
    firstIcon.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail.iconName).toBe(
      firstIcon.dataset.icon
    );
  });

  it("filters icons by search term", async () => {
    const el = await mountOpen();
    const before = cells(el).length;
    const searchInput = el.shadowRoot.querySelector(".newton-search__input");
    searchInput.value = "settings";
    searchInput.dispatchEvent(new CustomEvent("input"));
    await Promise.resolve();

    const after = cells(el).length;
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThan(0);
  });

  it("pre-selects the matching entry when value is set", async () => {
    const el = await mountOpen("settings");
    const selected = el.shadowRoot.querySelector(
      ".newton-selector-icon-cell_selected"
    );
    expect(selected).not.toBeNull();
    expect(selected.getAttribute("aria-label")).toBe("Select settings icon");
  });
});
