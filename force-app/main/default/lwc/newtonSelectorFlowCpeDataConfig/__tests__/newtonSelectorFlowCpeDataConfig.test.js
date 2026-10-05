import { createElement } from "lwc";
import NewtonSelectorFlowCpeDataConfig from "c/newtonSelectorFlowCpeDataConfig";
import { getObjectInfo, getPicklistValues } from "lightning/uiObjectInfoApi";
import searchSObjectTypes from "@salesforce/apex/NewtonSelectorFlowCpeController.searchSObjectTypes";
import searchLookupDatasetFieldsForObject from "@salesforce/apex/NewtonSelectorFlowCpeController.searchLookupDatasetFieldsForObject";
import queryItems from "@salesforce/apex/NewtonSelectorRuntimeController.queryItems";

jest.mock("lightning/uiObjectInfoApi", () => {
  const {
    createLdsTestWireAdapter
  } = require("@salesforce/wire-service-jest-util");
  return {
    getObjectInfo: createLdsTestWireAdapter(jest.fn()),
    getPicklistValues: createLdsTestWireAdapter(jest.fn())
  };
});
jest.mock(
  "@salesforce/apex/NewtonSelectorFlowCpeController.searchSObjectTypes",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/NewtonSelectorFlowCpeController.searchLookupDatasetFieldsForObject",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/NewtonSelectorRuntimeController.queryItems",
  () => ({ default: jest.fn() }),
  { virtual: true }
);
jest.mock(
  "@salesforce/apex/NewtonSelectorRuntimeController.validateQuery",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

const BASE_CONFIG = {
  dataSource: "custom",
  picklist: {},
  collection: { fieldMap: {} },
  sobject: {
    sObjectApiName: "Account",
    labelField: "Name",
    valueField: "Id",
    orderDirection: "ASC",
    limit: 25
  },
  custom: {
    items: [
      { label: "One", value: "one", icon: "circle" },
      { label: "Two", value: "two", icon: "" }
    ]
  },
  overrides: {},
  display: {}
};

const flushPromises = () => Promise.resolve();

function mount(props = {}) {
  const element = createElement("c-newton-selector-flow-cpe-data-config", {
    is: NewtonSelectorFlowCpeDataConfig
  });
  Object.assign(element, { config: BASE_CONFIG, ...props });
  document.body.appendChild(element);
  return element;
}

function collect(element, eventName = "configpatch") {
  const events = [];
  element.addEventListener(eventName, (event) => events.push(event.detail));
  return events;
}

function cardSelect(node, value) {
  node.dispatchEvent(
    new CustomEvent("cardselect", {
      detail: { value },
      bubbles: true,
      composed: true
    })
  );
}

function valueChanged(node, newValue, detail = {}) {
  node.dispatchEvent(
    new CustomEvent("valuechanged", {
      detail: { newValue, ...detail },
      bubbles: true,
      composed: true
    })
  );
}

function iconSelected(node, iconName) {
  node.dispatchEvent(
    new CustomEvent("iconselect", {
      detail: { iconName },
      bubbles: true,
      composed: true
    })
  );
}

function change(node, value) {
  node.value = value;
  node.dispatchEvent(
    new CustomEvent("change", {
      detail: { value },
      bubbles: true,
      composed: true
    })
  );
}

function valueChange(node, value) {
  node.value = value;
  node.dispatchEvent(
    new CustomEvent("valuechange", {
      detail: { value },
      bubbles: true,
      composed: true
    })
  );
}

function click(node) {
  node.dispatchEvent(
    new MouseEvent("click", { bubbles: true, composed: true })
  );
}

function toggle(node, checked) {
  node.checked = checked;
  node.dispatchEvent(
    new CustomEvent("toggle", {
      detail: { checked },
      bubbles: true,
      composed: true
    })
  );
}

function byLabel(root, selector, label) {
  return [...root.querySelectorAll(selector)].find(
    (node) => node.label === label || node.getAttribute("label") === label
  );
}

function overrideModeToggle(element) {
  return element.shadowRoot.querySelector(".newton-studio__mode-control");
}

describe("c-newton-selector-flow-cpe-data-config events", () => {
  beforeEach(() => {
    searchSObjectTypes.mockResolvedValue([]);
    searchLookupDatasetFieldsForObject.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("emits source and reference changes without mutating input config", () => {
    const element = mount();
    const patches = collect(element);

    cardSelect(
      element.shadowRoot.querySelector('[aria-label="Data source"]'),
      "collection"
    );

    expect(patches).toHaveLength(1);
    expect(patches[0].path).toEqual([]);
    expect(patches[0].value.dataSource).toBe("collection");
    expect(element.config.dataSource).toBe("custom");

    const collectionElement = mount({
      config: { ...BASE_CONFIG, dataSource: "collection" }
    });
    const collectionRefs = collect(collectionElement, "refchange");
    valueChanged(
      collectionElement.shadowRoot.querySelector(
        "c-newton-selector-flow-cpe-resource-selector"
      ),
      "{!records}"
    );

    expect(collectionRefs).toEqual([
      { name: "sourceRecordsRef", value: "{!records}" }
    ]);
  });

  it("filters collection binding to record collections and hydrates field mapping from the selected object", () => {
    const element = mount({
      config: { ...BASE_CONFIG, dataSource: "collection" }
    });
    const patches = collect(element);
    const refs = collect(element, "refchange");

    const collectionselector = element.shadowRoot.querySelector(
      "c-newton-selector-flow-cpe-resource-selector"
    );
    expect(collectionselector.builderContextFilterType).toBe("SObject");
    expect(collectionselector.builderContextFilterCollectionBoolean).toBe(true);

    valueChanged(collectionselector, "{!accounts}", {
      objectType: "Account",
      isCollection: true
    });

    expect(refs).toEqual([{ name: "sourceRecordsRef", value: "{!accounts}" }]);
    expect(patches.at(-1).value.collection.objectApiName).toBe("Account");
    expect(patches.at(-1).value.collection.fieldMap).toEqual({
      label: "",
      sublabel: "",
      icon: "",
      value: "",
      badge: "",
      helpText: ""
    });
  });

  it("resolves collection field mapping metadata from a mapped Get Records resource", () => {
    const element = mount({
      sourceRecordsRef: "{!Get_Contacts}",
      builderContext: {
        recordLookups: [
          {
            name: "Get_Contacts",
            label: "Get Contacts",
            object: "Contact",
            getFirstRecordOnly: "false"
          }
        ]
      },
      config: {
        ...BASE_CONFIG,
        dataSource: "collection",
        collection: {
          fieldMap: { label: "", value: "" }
        }
      }
    });

    const fieldselectors = element.shadowRoot.querySelectorAll(
      "c-newton-selector-flow-cpe-field-selector[data-field]"
    );

    expect(fieldselectors).toHaveLength(6);
    fieldselectors.forEach((selector) => {
      expect(selector.objectApiName).toBe("Contact");
    });
  });

  it("hydrates collection object metadata from builder context when the selection event omits objectType", () => {
    const element = mount({
      config: { ...BASE_CONFIG, dataSource: "collection" },
      builderContext: {
        recordLookups: [
          {
            name: "Get_Accounts",
            label: "Get Accounts",
            object: "Account",
            getFirstRecordOnly: "false"
          }
        ]
      }
    });
    const patches = collect(element);

    valueChanged(
      element.shadowRoot.querySelector(
        "c-newton-selector-flow-cpe-resource-selector"
      ),
      "{!Get_Accounts}",
      { isCollection: true }
    );

    expect(patches.at(-1).value.collection.objectApiName).toBe("Account");
    expect(patches.at(-1).value.collection.fieldMap).toEqual({
      label: "",
      sublabel: "",
      icon: "",
      value: "",
      badge: "",
      helpText: ""
    });
  });

  it("emits custom item add, edit, duplicate, move, and remove patches", () => {
    const element = mount();
    const patches = collect(element);

    click(element.shadowRoot.querySelector(".newton-studio__button-with-icon"));
    expect(patches.at(-1).value.custom.items).toHaveLength(3);

    valueChanged(
      element.shadowRoot.querySelector(
        'c-newton-selector-flow-cpe-resource-selector[data-index="0"][data-field="label"]'
      ),
      "Uno"
    );
    expect(patches.at(-1).value.custom.items[0].label).toBe("Uno");

    iconSelected(
      element.shadowRoot.querySelector(
        'c-newton-selector-flow-cpe-icon-selector[data-index="1"]'
      ),
      "list-checks"
    );
    expect(patches.at(-1).value.custom.items[1].icon).toBe("list-checks");

    toggle(
      element.shadowRoot.querySelector(
        'c-newton-selector-flow-cpe-toggle[data-index="1"]'
      ),
      true
    );
    expect(patches.at(-1).value.custom.items[1].hidden).toBe(true);

    const firstRowButtons = [
      ...element.shadowRoot.querySelectorAll(
        '.newton-studio__custom-row-head button[data-index="0"]'
      )
    ];

    click(firstRowButtons[2]);
    expect(patches.at(-1).value.custom.items).toEqual([
      BASE_CONFIG.custom.items[0],
      BASE_CONFIG.custom.items[0],
      BASE_CONFIG.custom.items[1]
    ]);

    click(firstRowButtons[1]);
    expect(patches.at(-1).value.custom.items[0].value).toBe("two");

    click(firstRowButtons[3]);
    expect(patches.at(-1).value.custom.items).toEqual([
      BASE_CONFIG.custom.items[1]
    ]);
  });

  it("emits override and bulk override patches", async () => {
    const element = mount({
      config: {
        ...BASE_CONFIG,
        dataSource: "picklist",
        picklist: { objectApiName: "Account", fieldApiName: "Rating" }
      }
    });
    const patches = collect(element);
    getPicklistValues.emit({
      values: [
        { label: "Alpha", value: "Alpha" },
        { label: "Beta", value: "Beta" }
      ]
    });
    await flushPromises();

    toggle(overrideModeToggle(element), true);
    await flushPromises();

    click(byLabel(element.shadowRoot, "lightning-button", "Select all shown"));
    await flushPromises();

    expect(
      element.shadowRoot.querySelector(".newton-studio__bulk")
    ).not.toBeNull();

    valueChanged(
      element.shadowRoot.querySelectorAll(
        ".newton-studio__bulk c-newton-selector-flow-cpe-resource-selector"
      )[1],
      "Featured"
    );
    iconSelected(
      element.shadowRoot.querySelector(
        ".newton-studio__bulk c-newton-selector-flow-cpe-icon-selector"
      ),
      "star"
    );
    click(byLabel(element.shadowRoot, "lightning-button", "Apply to selected"));

    expect(patches.at(-1).value.overrides).toEqual({
      Alpha: { icon: "star", badge: "Featured" },
      Beta: { icon: "star", badge: "Featured" }
    });

    click(
      element.shadowRoot.querySelector(
        '.newton-studio__overrides-trigger[data-value="Alpha"]'
      )
    );
    await flushPromises();
    valueChanged(
      element.shadowRoot.querySelector(
        'c-newton-selector-flow-cpe-resource-selector[data-value="Alpha"][data-field="label"]'
      ),
      "Alpha label"
    );
    expect(patches.at(-1).value.overrides.Alpha.label).toBe("Alpha label");

    toggle(
      element.shadowRoot.querySelector(
        'c-newton-selector-flow-cpe-toggle[data-value="Alpha"]'
      ),
      true
    );
    expect(patches.at(-1).value.overrides.Alpha.hidden).toBe(true);

    toggle(
      element.shadowRoot.querySelector(
        'c-newton-selector-flow-cpe-toggle[data-value="Alpha"]'
      ),
      false
    );
    expect(patches.at(-1).value.overrides.Alpha).toBeUndefined();
  });

  it("does not expose per-item overrides for record collections", async () => {
    const element = mount({
      config: {
        ...BASE_CONFIG,
        dataSource: "collection",
        collection: {
          objectApiName: "Account",
          fieldMap: { label: "Name", value: "Id" }
        }
      }
    });

    expect(
      byLabel(
        element.shadowRoot,
        "c-newton-selector-flow-cpe-toggle",
        "Option overrides"
      )
    ).toBeUndefined();
    expect(element.shadowRoot.textContent).not.toContain("Known item values");
  });

  it("keeps override rows lightweight and expands from the chevron", async () => {
    const values = Array.from({ length: 30 }, (_, index) => `Value ${index}`);
    const element = mount({
      config: {
        ...BASE_CONFIG,
        dataSource: "picklist",
        picklist: { objectApiName: "Account", fieldApiName: "Rating" }
      }
    });
    getPicklistValues.emit({
      values: values.map((value) => ({ label: value, value }))
    });

    await flushPromises();
    expect(
      element.shadowRoot.querySelector(".newton-studio__overrides-toolbar")
    ).toBeNull();

    toggle(overrideModeToggle(element), true);
    await flushPromises();

    const rows = () =>
      element.shadowRoot.querySelectorAll(".newton-overrides__row");
    expect(rows().length).toBeLessThan(30);
    expect(
      element.shadowRoot.querySelectorAll(
        ".newton-studio__overrides-grid c-newton-selector-flow-cpe-resource-selector"
      )
    ).toHaveLength(0);

    click(
      element.shadowRoot.querySelector(
        '.newton-studio__overrides-chev[data-value="Value 0"]'
      )
    );
    await flushPromises();

    expect(
      element.shadowRoot.querySelector(
        '.newton-studio__overrides-trigger[data-value="Value 0"]'
      ).ariaExpanded
    ).toBe("true");
    expect(
      element.shadowRoot.querySelectorAll(
        ".newton-studio__overrides-grid c-newton-selector-flow-cpe-resource-selector"
      )
    ).toHaveLength(4);

    click(
      [...element.shadowRoot.querySelectorAll("lightning-button")].find(
        (button) => button.label.startsWith("Show")
      )
    );
    await flushPromises();

    expect(rows()).toHaveLength(30);
  });

  it("shows bulk controls only when multiple override rows are selected", async () => {
    const element = mount({
      config: {
        ...BASE_CONFIG,
        dataSource: "picklist",
        picklist: { objectApiName: "Account", fieldApiName: "Rating" }
      }
    });
    getPicklistValues.emit({
      values: [
        { label: "Alpha", value: "Alpha" },
        { label: "Beta", value: "Beta" }
      ]
    });
    await flushPromises();

    toggle(overrideModeToggle(element), true);
    await flushPromises();

    expect(element.shadowRoot.querySelector(".newton-studio__bulk")).toBeNull();

    change(
      element.shadowRoot.querySelector(
        'input[type="checkbox"][data-value="Alpha"]'
      ),
      true
    );
    await flushPromises();
    expect(element.shadowRoot.querySelector(".newton-studio__bulk")).toBeNull();

    change(
      element.shadowRoot.querySelector(
        'input[type="checkbox"][data-value="Beta"]'
      ),
      true
    );
    await flushPromises();
    expect(
      element.shadowRoot.querySelector(".newton-studio__bulk")
    ).not.toBeNull();

    toggle(overrideModeToggle(element), false);
    await flushPromises();
    expect(element.shadowRoot.querySelector(".newton-studio__bulk")).toBeNull();
  });

  it("captures sObject sample load failures", async () => {
    queryItems.mockRejectedValue({ body: { message: "No access" } });
    const element = mount({
      config: { ...BASE_CONFIG, dataSource: "sobject" }
    });

    toggle(overrideModeToggle(element), true);
    await flushPromises();

    click(byLabel(element.shadowRoot, "lightning-button", "Load sample rows"));
    await flushPromises();
    await flushPromises();

    expect(element.shadowRoot.textContent).toContain("No access");
  });

  it("renders SOQL preview with syntax-highlighted tokens", async () => {
    const element = mount({
      config: {
        ...BASE_CONFIG,
        dataSource: "sobject",
        sobject: {
          ...BASE_CONFIG.sobject,
          whereClause: "Name LIKE 'Acme%' AND IsActive__c = TRUE",
          orderByField: "Name",
          orderByDirection: "ASC"
        }
      }
    });
    await flushPromises();

    const code = element.shadowRoot.querySelector(
      ".newton-query-preview__code code"
    );
    expect(code.textContent).toContain(
      "SELECT Id, Name FROM Account WHERE Name LIKE 'Acme%' AND IsActive__c = TRUE ORDER BY Name ASC LIMIT 25"
    );

    const keywordTokens = [
      ...code.querySelectorAll(".newton-query-preview__token_keyword")
    ].map((node) => node.textContent);
    expect(keywordTokens).toEqual(
      expect.arrayContaining(["SELECT", "FROM", "WHERE", "LIKE", "AND"])
    );
    expect(
      code.querySelector(".newton-query-preview__token_object").textContent
    ).toBe("Account");
    expect(
      code.querySelector(".newton-query-preview__token_string").textContent
    ).toBe("'Acme%'");
    expect(
      code.querySelector(".newton-query-preview__token_boolean").textContent
    ).toBe("TRUE");
  });

  it("emits display sorting patches", () => {
    const element = mount({
      config: { ...BASE_CONFIG, display: { sortBy: "label" } }
    });
    const patches = collect(element);

    valueChange(
      byLabel(
        element.shadowRoot,
        "c-newton-selector-flow-cpe-choice-control",
        "Sort by"
      ),
      "label"
    );
    valueChange(
      byLabel(
        element.shadowRoot,
        "c-newton-selector-flow-cpe-choice-control",
        "Direction"
      ),
      "desc"
    );
    change(
      byLabel(element.shadowRoot, "lightning-input", "Maximum options"),
      "3"
    );

    expect(patches.at(-3).value.display.sortBy).toBe("label");
    expect(patches.at(-2).value.display.sortDirection).toBe("desc");
    expect(patches.at(-1).value.display.limit).toBe(3);
  });

  it("hides the record type selector when the selected object has no record types", async () => {
    const element = mount({
      config: {
        ...BASE_CONFIG,
        dataSource: "picklist",
        picklist: { objectApiName: "Account", fieldApiName: "Industry" }
      }
    });

    getObjectInfo.emit({
      defaultRecordTypeId: "012000000000000AAA",
      recordTypeInfos: {
        "012000000000000AAA": {
          name: "Master",
          developerName: "Master",
          master: true,
          available: true,
          recordTypeId: "012000000000000AAA"
        }
      }
    });
    await flushPromises();

    expect(
      byLabel(
        element.shadowRoot,
        "c-newton-selector-flow-cpe-choice-control",
        "Record type"
      )
    ).toBeUndefined();
  });

  it("shows object record types as Newton selector choices when available", async () => {
    const element = mount({
      config: {
        ...BASE_CONFIG,
        dataSource: "picklist",
        picklist: { objectApiName: "Account", fieldApiName: "Industry" }
      }
    });
    const patches = collect(element);

    getObjectInfo.emit({
      defaultRecordTypeId: "012Default",
      recordTypeInfos: {
        "012000000000000AAA": {
          name: "Master",
          developerName: "Master",
          master: true,
          available: true,
          recordTypeId: "012000000000000AAA"
        },
        "012Default": {
          name: "Business",
          developerName: "Business",
          master: false,
          available: true,
          recordTypeId: "012Default"
        },
        "012Partner": {
          name: "Partner",
          developerName: "Partner",
          master: false,
          available: true,
          recordTypeId: "012Partner"
        }
      }
    });
    await flushPromises();

    const recordTypeselector = byLabel(
      element.shadowRoot,
      "c-newton-selector-flow-cpe-choice-control",
      "Record type"
    );
    expect(recordTypeselector).not.toBeUndefined();
    expect(recordTypeselector.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Default (Business)",
          sublabel: "Uses this object's default record type"
        }),
        expect.objectContaining({
          label: "Business",
          value: "012Default",
          badge: "Default"
        }),
        expect.objectContaining({ label: "Partner", value: "012Partner" })
      ])
    );
    expect(recordTypeselector.value).not.toBe("");

    valueChange(recordTypeselector, recordTypeselector.value);
    expect(patches.at(-1).value.picklist.recordTypeId).toBe("");

    valueChange(recordTypeselector, "012Partner");
    expect(patches.at(-1).value.picklist.recordTypeId).toBe("012Partner");
  });
});
