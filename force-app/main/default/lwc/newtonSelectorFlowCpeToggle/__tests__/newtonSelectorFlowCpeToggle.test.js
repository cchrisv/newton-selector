import { createElement } from "lwc";
import NewtonSelectorFlowCpeToggle from "c/newtonSelectorFlowCpeToggle";

function mount(props = {}) {
  const el = createElement("c-newton-selector-flow-cpe-toggle", {
    is: NewtonSelectorFlowCpeToggle
  });
  Object.assign(el, props);
  document.body.appendChild(el);
  return el;
}

function choice(el, checked) {
  return el.shadowRoot.querySelector(`button[data-checked="${checked}"]`);
}

describe("c-newton-selector-flow-cpe-toggle", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("renders a two-state selector with the provided label", () => {
    const el = mount({ label: "Show Border" });
    const group = el.shadowRoot.querySelector('[role="radiogroup"]');

    expect(group).not.toBeNull();
    expect(group.getAttribute("aria-label")).toBe("Show Border");
    expect(choice(el, "false").textContent).toContain("Off");
    expect(choice(el, "true").textContent).toContain("On");
  });

  it("marks the option matching the checked value", () => {
    const on = mount({ checked: true });
    expect(choice(on, "true").getAttribute("aria-checked")).toBe("true");
    expect(choice(on, "false").getAttribute("aria-checked")).toBe("false");

    const off = mount({ checked: false });
    expect(choice(off, "true").getAttribute("aria-checked")).toBe("false");
    expect(choice(off, "false").getAttribute("aria-checked")).toBe("true");
  });

  describe("toggle event", () => {
    it("fires toggle with {checked:true} when the on option is chosen", () => {
      const el = mount();
      const handler = jest.fn();
      el.addEventListener("toggle", handler);

      choice(el, "true").click();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].detail).toEqual({ checked: true });
    });

    it("fires toggle with {checked:false} when the off option is chosen", () => {
      const el = mount({ checked: true });
      const handler = jest.fn();
      el.addEventListener("toggle", handler);

      choice(el, "false").click();

      expect(handler.mock.calls[0][0].detail).toEqual({ checked: false });
    });
  });

  it("uses short active and inactive labels when provided", () => {
    const el = mount({
      label: "Required",
      activeLabel: "Required",
      inactiveLabel: "Optional"
    });

    expect(choice(el, "false").textContent).toContain("Optional");
    expect(choice(el, "true").textContent).toContain("Required");
  });

  it("does not fire duplicate events when the selected option is clicked", () => {
    const el = mount({ checked: true });
    const handler = jest.fn();
    el.addEventListener("toggle", handler);

    choice(el, "true").click();

    expect(handler).not.toHaveBeenCalled();
  });
});
