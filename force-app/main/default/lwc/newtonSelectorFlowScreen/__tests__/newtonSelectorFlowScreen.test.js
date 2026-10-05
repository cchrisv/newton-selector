import { createElement } from "lwc";
import NewtonSelectorFlowScreen from "c/newtonSelectorFlowScreen";

// Jest resolves Custom Labels to their names; give the unreadable-config label
// a value with its placeholder.
jest.mock(
  "@salesforce/label/c.Newton_Selector_ConfigUnreadable",
  () => ({ default: "The saved configuration can't be read ({0})." }),
  { virtual: true }
);

describe("c-newton-selector-flow-screen", () => {
  afterEach(() => {
    while (document.body.firstChild)
      document.body.removeChild(document.body.firstChild);
  });

  it("shows the parse error without a Try again button on malformed JSON", async () => {
    const malformed = "{ not valid";
    let parseError;
    try {
      JSON.parse(malformed);
    } catch (e) {
      parseError = e.message;
    }
    const el = createElement("c-newton-selector-flow-screen", {
      is: NewtonSelectorFlowScreen
    });
    el.selectorConfigJson = malformed;
    document.body.appendChild(el);
    await Promise.resolve();
    const dataSelector = el.shadowRoot.querySelector(
      "c-newton-selector-data-selector"
    );
    const alert = dataSelector.shadowRoot.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain(
      `The saved configuration can't be read (${parseError}).`
    );
    expect(alert.querySelector(".newton-state__retry")).toBeNull();
  });
});
