import { createElement } from "lwc";
import NewtonSelectorFlowCpeAppearanceConfig from "c/newtonSelectorFlowCpeAppearanceConfig";
import { mergeSelectorConfig } from "c/newtonSelectorUtilityConfigDefaults";

const BASE_CONFIG = {
  dataSource: "custom",
  selectionMode: "single",
  layout: "grid",
  gridConfig: {
    size: "small",
    minWidth: "7.5rem",
    columns: null,
    aspectRatio: "1:1",
    selectionIndicator: "frame",
    elevation: "outlined",
    pattern: "none",
    surfaceStyle: "solid",
    iconDecor: "square",
    iconStyle: "soft",
    iconShading: "flat",
    iconTone: "brand",
    iconSize: "auto",
    badge: {},
    margin: {
      linked: true,
      top: "",
      right: "",
      bottom: "",
      left: ""
    },
    padding: { linked: true, top: "", right: "", bottom: "", left: "" }
  }
};

function mount(config = BASE_CONFIG) {
  const element = createElement(
    "c-newton-selector-flow-cpe-appearance-config",
    {
      is: NewtonSelectorFlowCpeAppearanceConfig
    }
  );
  element.config = mergeSelectorConfig(config);
  document.body.appendChild(element);
  return element;
}

function collect(element) {
  const events = [];
  element.addEventListener("configpatch", (event) => events.push(event.detail));
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

function inputChange(node, value) {
  node.value = value;
  node.dispatchEvent(
    new CustomEvent("change", { bubbles: true, composed: true })
  );
}

function group(root, label) {
  return root.querySelector(`[aria-label="${label}"]`);
}

function byLabel(root, selector, label) {
  return [...root.querySelectorAll(selector)].find(
    (node) => node.label === label || node.getAttribute("label") === label
  );
}

describe("c-newton-selector-flow-cpe-appearance-config events", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
  });

  it("emits layout patches without changing selection mode", () => {
    const element = mount({ ...BASE_CONFIG, selectionMode: "single" });
    const patches = collect(element);

    cardSelect(group(element.shadowRoot, "Layout"), "dualListbox");
    expect(patches[0].value.layout).toBe("dualListbox");
    expect(patches[0].value.selectionMode).toBe("single");

    cardSelect(group(element.shadowRoot, "Layout"), "columns");
    expect(patches[1].value.layout).toBe("columns");
    expect(patches[1].value.selectionMode).toBe("single");

    const multiElement = mount({ ...BASE_CONFIG, selectionMode: "multi" });
    const multiPatches = collect(multiElement);
    cardSelect(group(multiElement.shadowRoot, "Layout"), "picklist");
    expect(multiPatches[0].value.layout).toBe("picklist");
    expect(multiPatches[0].value.selectionMode).toBe("multi");

    cardSelect(group(multiElement.shadowRoot, "Layout"), "radio");
    expect(multiPatches[1].value.layout).toBe("radio");
    expect(multiPatches[1].value.selectionMode).toBe("multi");

    const singleSelect = mount(BASE_CONFIG);
    const singlePatches = collect(singleSelect);
    cardSelect(group(singleSelect.shadowRoot, "Layout"), "list");
    expect(singlePatches[0].value.layout).toBe("list");
  });

  it("emits grid sizing, spacing, and column patches from rendered controls", () => {
    const element = mount();
    const patches = collect(element);

    cardSelect(group(element.shadowRoot, "Tile size"), "large");
    cardSelect(group(element.shadowRoot, "Aspect ratio"), "16:9");
    click(
      element.shadowRoot.querySelector(
        ".newton-studio__col-chip[data-value='3']"
      )
    );
    cardSelect(group(element.shadowRoot, "Horizontal gap"), "8");
    inputChange(
      byLabel(element.shadowRoot, "lightning-input", "Minimum column width"),
      "18"
    );

    expect(patches.at(-5).value.gridConfig.size).toBe("large");
    expect(patches.at(-4).value.gridConfig.aspectRatio).toBe("16:9");
    expect(patches.at(-3).value.gridConfig.columns).toBe(3);
    expect(patches.at(-2).value.gridConfig.gapH).toBe("8");
    expect(patches.at(-1).value.gridConfig.minWidth).toBe("18rem");
  });

  it("emits surface, icon, and badge patches from rendered controls", () => {
    const element = mount({
      ...BASE_CONFIG,
      gridConfig: {
        ...BASE_CONFIG.gridConfig,
        badge: { variant: "custom" }
      }
    });
    const patches = collect(element);

    cardSelect(group(element.shadowRoot, "Surface style"), "gradient-radial");
    cardSelect(group(element.shadowRoot, "Icon size"), "small");
    toggle(
      byLabel(
        element.shadowRoot,
        "c-newton-selector-flow-cpe-toggle",
        "Show icons"
      ),
      false
    );
    cardSelect(group(element.shadowRoot, "Badge position"), "top-right");
    inputChange(
      element.shadowRoot.querySelector(
        'input[aria-label="Badge hex color value"]'
      ),
      "#123456"
    );

    expect(patches.at(-5).value.gridConfig.surfaceStyle).toBe(
      "gradient-radial"
    );
    expect(patches.at(-4).value.gridConfig.iconSize).toBe("small");
    expect(patches.at(-3).value.gridConfig.showIcons).toBe(false);
    expect(patches.at(-2).value.gridConfig.badge.position).toBe("top-right");
    expect(patches.at(-1).value.gridConfig.badge.variantHex).toBe("#123456");
  });

  it("emits state-specific pattern and surface color patches", () => {
    const element = mount({
      ...BASE_CONFIG,
      gridConfig: {
        ...BASE_CONFIG.gridConfig,
        pattern: "dots",
        patternSelectedTone: "custom",
        surfaceSelectedTone: "custom"
      }
    });
    const patches = collect(element);

    click(
      group(element.shadowRoot, "Pattern hover color").querySelector(
        "[data-value='warning']"
      )
    );
    inputChange(
      element.shadowRoot.querySelector(
        'input[aria-label="Pattern selected hex color value"]'
      ),
      "#112233"
    );
    click(
      group(element.shadowRoot, "Surface hover color").querySelector(
        "[data-value='teal']"
      )
    );
    inputChange(
      element.shadowRoot.querySelector(
        'input[aria-label="Surface selected hex color value"]'
      ),
      "#445566"
    );

    expect(patches.at(-4).value.gridConfig.patternHoverTone).toBe("warning");
    expect(patches.at(-3).value.gridConfig.patternSelectedToneHex).toBe(
      "#112233"
    );
    expect(patches.at(-2).value.gridConfig.surfaceHoverTone).toBe("teal");
    expect(patches.at(-1).value.gridConfig.surfaceSelectedToneHex).toBe(
      "#445566"
    );
  });

  it("emits icon decoration, style, color, and glyph color patches", () => {
    const element = mount({
      ...BASE_CONFIG,
      gridConfig: {
        ...BASE_CONFIG.gridConfig,
        iconDecor: "ring",
        iconTone: "custom",
        iconGlyphTone: "custom"
      }
    });
    const patches = collect(element);

    cardSelect(group(element.shadowRoot, "Icon decoration"), "badge");
    cardSelect(group(element.shadowRoot, "Icon style"), "outlined");
    click(
      group(element.shadowRoot, "Icon color").querySelector(
        "[data-value='brand']"
      )
    );
    click(
      group(element.shadowRoot, "Icon glyph color").querySelector(
        "[data-value='contrast']"
      )
    );
    inputChange(
      element.shadowRoot.querySelector(
        'input[aria-label="Icon decoration hex color value"]'
      ),
      "#654321"
    );

    expect(patches.at(-5).value.gridConfig.iconDecor).toBe("badge");
    expect(patches.at(-4).value.gridConfig.iconStyle).toBe("outlined");
    expect(patches.at(-3).value.gridConfig.iconTone).toBe("brand");
    expect(patches.at(-2).value.gridConfig.iconGlyphTone).toBe("contrast");
    expect(patches.at(-1).value.gridConfig.iconToneHex).toBe("#654321");
  });

  it("hides dependent controls when the icon and badge switches turn off", async () => {
    const element = mount({
      ...BASE_CONFIG,
      gridConfig: {
        ...BASE_CONFIG.gridConfig,
        showIcons: true,
        showBadges: true
      }
    });
    const patches = collect(element);

    toggle(
      byLabel(
        element.shadowRoot,
        "c-newton-selector-flow-cpe-toggle",
        "Show icons"
      ),
      false
    );
    await Promise.resolve();
    expect(patches.at(-1).value.gridConfig.showIcons).toBe(false);

    element.config = patches.at(-1).value;
    await Promise.resolve();
    expect(group(element.shadowRoot, "Icon size")).toBeNull();

    toggle(
      byLabel(
        element.shadowRoot,
        "c-newton-selector-flow-cpe-toggle",
        "Show badges"
      ),
      false
    );
    await Promise.resolve();
    expect(patches.at(-1).value.gridConfig.showBadges).toBe(false);

    element.config = patches.at(-1).value;
    await Promise.resolve();
    expect(group(element.shadowRoot, "Badge position")).toBeNull();
    expect(group(element.shadowRoot, "Badge color")).toBeNull();
    expect(group(element.shadowRoot, "Badge shape")).toBeNull();
  });

  it("emits linked and per-side margin and padding patches", () => {
    const unlinked = {
      ...BASE_CONFIG,
      gridConfig: {
        ...BASE_CONFIG.gridConfig,
        margin: { ...BASE_CONFIG.gridConfig.margin, linked: false }
      }
    };
    const element = mount(unlinked);
    const patches = collect(element);

    toggle(
      byLabel(
        element.shadowRoot,
        "c-newton-selector-flow-cpe-toggle",
        "Link all sides"
      ),
      true
    );
    cardSelect(
      element.shadowRoot.querySelector('[aria-label^="Padding"]'),
      "4"
    );
    cardSelect(
      element.shadowRoot.querySelector(
        '.newton-studio__selectorgroup[data-side="left"]'
      ),
      "7"
    );

    expect(patches.at(-3).value.gridConfig.margin.linked).toBe(true);
    expect(patches.at(-2).value.gridConfig.padding).toMatchObject({
      linked: true,
      top: "4",
      right: "4",
      bottom: "4",
      left: "4"
    });
    expect(patches.at(-1).value.gridConfig.margin).toMatchObject({
      left: "7",
      linked: false
    });
  });
});
