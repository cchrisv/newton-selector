import { createElement } from "lwc";
import NewtonSelectorFlowCpeConfigPreview from "c/newtonSelectorFlowCpeConfigPreview";

const CONFIG = { dataSource: "custom", layout: "grid" };

function mount(config = CONFIG) {
  const element = createElement("c-newton-selector-flow-cpe-config-preview", {
    is: NewtonSelectorFlowCpeConfigPreview
  });
  element.config = config;
  document.body.appendChild(element);
  return element;
}

describe("c-newton-selector-flow-cpe-config-preview", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("emits preview state changes from the state buttons", () => {
    const element = mount();
    const handler = jest.fn();
    element.addEventListener("previewstatechange", handler);

    const errorTab = element.shadowRoot.querySelector('[data-state="error"]');
    errorTab.click();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].detail).toBe("error");
  });
});
