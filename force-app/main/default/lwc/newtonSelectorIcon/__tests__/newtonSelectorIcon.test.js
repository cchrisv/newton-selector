import { createElement } from "lwc";
import NewtonSelectorIcon from "c/newtonSelectorIcon";

describe("c-newton-selector-icon", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("renders a visible fallback for unknown icons", async () => {
    const el = createElement("c-newton-selector-icon", {
      is: NewtonSelectorIcon
    });
    el.name = "not-real";
    document.body.appendChild(el);

    await Promise.resolve();

    const svg = el.shadowRoot.querySelector("svg");
    expect(svg.childNodes.length).toBeGreaterThan(0);
  });
});
