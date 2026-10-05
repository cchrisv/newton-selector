import { createElement } from "lwc";
import NewtonSelectorChoiceTile from "c/newtonSelectorChoiceTile";

const SAMPLE_ITEM = {
  id: "i-1",
  label: "First option",
  sublabel: "Helpful subtitle",
  icon: "building-2",
  badge: "New",
  helpText: "Hover for info",
  value: "first",
  disabled: false
};

function mount({ item, ...props } = {}) {
  const el = createElement("c-newton-selector-choice-tile", {
    is: NewtonSelectorChoiceTile
  });
  el.item = { ...SAMPLE_ITEM, ...item };
  Object.assign(el, props);
  document.body.appendChild(el);
  return el;
}

describe("c-newton-selector-choice-tile", () => {
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
  });

  it("renders title, sub, and badge in grid variant", () => {
    const el = mount();
    const title = el.shadowRoot.querySelector(
      ".newton-selector-choice-tile__title"
    );
    const sub = el.shadowRoot.querySelector(
      ".newton-selector-choice-tile__sub"
    );
    const badge = el.shadowRoot.querySelector(
      ".newton-selector-choice-tile__badge"
    );
    expect(title.textContent).toBe("First option");
    expect(sub.textContent).toBe("Helpful subtitle");
    expect(badge.textContent).toBe("New");
  });

  it("renders a radio input with groupName in single-select mode", () => {
    const el = mount({ selectionMode: "single", groupName: "my-group" });
    const input = el.shadowRoot.querySelector("input");
    expect(input.type).toBe("radio");
    expect(input.name).toBe("my-group");
  });

  it("renders a checkbox input with empty name in multi-select mode", () => {
    const el = mount({ selectionMode: "multi" });
    const input = el.shadowRoot.querySelector("input");
    expect(input.type).toBe("checkbox");
    expect(input.name).toBe("");
  });

  it("dispatches cardselect on change with value and id", () => {
    const el = mount();
    const handler = jest.fn();
    el.addEventListener("cardselect", handler);
    const input = el.shadowRoot.querySelector("input");
    input.dispatchEvent(new CustomEvent("change"));
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({
      value: "first",
      id: "i-1"
    });
  });

  it("disables the input and suppresses events when disabled", () => {
    const el = mount({ disabled: true });
    const input = el.shadowRoot.querySelector("input");
    expect(input.disabled).toBe(true);
    const handler = jest.fn();
    el.addEventListener("cardselect", handler);
    input.dispatchEvent(new CustomEvent("change"));
    expect(handler).not.toHaveBeenCalled();
  });

  it("renders helpText with aria-describedby target", () => {
    const el = mount();
    const input = el.shadowRoot.querySelector("input");
    const helpId = input.getAttribute("aria-describedby");
    expect(helpId).toBeTruthy();
    const helpEl = el.shadowRoot.querySelector(
      ".newton-selector-choice-tile__help"
    );
    expect(helpEl).not.toBeNull();
    expect(helpEl.getAttribute("id")).toBe(helpId);
    expect(helpEl.textContent).toBe("Hover for info");
  });

  it("omits aria-describedby when the item has no help text", () => {
    const el = mount({ item: { helpText: "" } });
    const input = el.shadowRoot.querySelector("input");
    expect(input.hasAttribute("aria-describedby")).toBe(false);
  });

  it("hides icons and badges when showIcons/showBadges are false", () => {
    const el = mount({ showIcons: false, showBadges: false });
    const iconNames = Array.from(
      el.shadowRoot.querySelectorAll("c-newton-selector-icon")
    ).map((icon) => icon.name);
    expect(iconNames).not.toContain("building-2");
    expect(el.shadowRoot.textContent).not.toContain("New");
  });
});
