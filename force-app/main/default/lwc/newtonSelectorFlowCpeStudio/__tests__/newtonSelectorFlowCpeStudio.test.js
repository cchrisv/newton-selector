import { createElement } from "lwc";
import NewtonSelectorFlowCpeStudio from "c/newtonSelectorFlowCpeStudio";

const flush = () => Promise.resolve();

describe("c-newton-selector-flow-cpe-studio", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("allows keyboard resize to give either pane the full available width", async () => {
    const element = createElement("c-newton-selector-flow-cpe-studio", {
      is: NewtonSelectorFlowCpeStudio
    });
    const resizeHandler = jest.fn();
    element.addEventListener("leftwidthchange", resizeHandler);

    document.body.appendChild(element);
    await flush();

    const splitter = element.shadowRoot.querySelector(
      ".newton-studio__splitter"
    );
    splitter.dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true })
    );
    await flush();

    expect(resizeHandler).toHaveBeenLastCalledWith(
      expect.objectContaining({ detail: 100 })
    );
    expect(splitter.getAttribute("aria-valuenow")).toBe("100");

    splitter.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Home", bubbles: true })
    );
    await flush();

    expect(resizeHandler).toHaveBeenLastCalledWith(
      expect.objectContaining({ detail: 0 })
    );
    expect(splitter.getAttribute("aria-valuenow")).toBe("0");
  });
});
