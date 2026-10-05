import { createElement } from "lwc";
import NewtonSelectorFlowCpeChoiceControl from "c/newtonSelectorFlowCpeChoiceControl";

describe("c-newton-selector-flow-cpe-choice-control", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("translates the combobox selection into a valuechange event", async () => {
    const element = createElement("c-newton-selector-flow-cpe-choice-control", {
      is: NewtonSelectorFlowCpeChoiceControl
    });
    Object.assign(element, {
      label: "Direction",
      items: [
        { label: "Ascending", value: "ASC" },
        { label: "Descending", value: "DESC" }
      ],
      value: "ASC"
    });
    document.body.appendChild(element);
    const handler = jest.fn();
    element.addEventListener("valuechange", handler);
    await Promise.resolve();

    element.shadowRoot
      .querySelector("c-newton-selector-combobox")
      .dispatchEvent(
        new CustomEvent("selectionchange", {
          detail: { value: "DESC", values: ["DESC"] }
        })
      );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toEqual({ value: "DESC" });
  });
});
