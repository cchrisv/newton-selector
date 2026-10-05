import { api, LightningElement } from "lwc";
import {
  mergeSelectorConfig,
  selectorPropsFromConfig
} from "c/newtonSelectorUtilityConfigDefaults";
import { LAYOUT_TILES } from "c/newtonSelectorFlowCpeUtilityConfigOptions";

const PREVIEW_SAMPLE_ITEMS = Object.freeze([
  {
    id: "preview-option-a",
    label: "Option A",
    sublabel: "Sample option",
    icon: "circle",
    badge: "Sample",
    helpText: "",
    value: "preview-option-a"
  },
  {
    id: "preview-option-b",
    label: "Option B",
    sublabel: "Sample option",
    icon: "square",
    badge: "Sample",
    helpText: "",
    value: "preview-option-b"
  },
  {
    id: "preview-option-c",
    label: "Option C",
    sublabel: "Sample option",
    icon: "triangle",
    badge: "Sample",
    helpText: "",
    value: "preview-option-c"
  },
  {
    id: "preview-option-d",
    label: "Option D",
    sublabel: "Sample option",
    icon: "star",
    badge: "Sample",
    helpText: "",
    value: "preview-option-d"
  }
]);

function sampleAt(index) {
  return PREVIEW_SAMPLE_ITEMS[index % PREVIEW_SAMPLE_ITEMS.length];
}

// Custom options go through as configured; DataSelector normalizes them
// exactly as at runtime, hidden rows and blank fields included. Other
// sources, and a Custom source with no options yet, show sample options
// keyed by the configured overrides.
function previewItems(config) {
  if (config.dataSource === "custom" && config.custom.items.length > 0) {
    return config.custom.items;
  }
  const values = [
    ...new Set([
      ...Object.keys(config.overrides).filter(Boolean),
      ...PREVIEW_SAMPLE_ITEMS.map((item) => item.value)
    ])
  ].slice(0, 6);
  return values.map((value, index) => ({
    ...sampleAt(index),
    id: `preview-mock-${index}`,
    value
  }));
}

export default class NewtonSelectorFlowCpeConfigPreview extends LightningElement {
  // The Populated / Empty / Error state the admin forces on the preview.
  forcedState = "";
  _config = mergeSelectorConfig();
  _rawConfig;
  // Built once per config change so the preview selector reloads only then.
  _selectorProps = this.buildSelectorProps();

  // The preview reads the config the same way the flow runtime does
  // (mergeSelectorConfig + selectorPropsFromConfig), so it renders what the
  // screen will.
  @api
  get config() {
    return this._rawConfig;
  }
  set config(value) {
    this._rawConfig = value;
    this._config = mergeSelectorConfig(value);
    this._selectorProps = this.buildSelectorProps();
  }

  buildSelectorProps() {
    return {
      ...selectorPropsFromConfig(this._config),
      sourceType: "custom",
      customConfig: { items: previewItems(this._config) },
      previewMode: true
    };
  }

  get selectorProps() {
    return this._selectorProps;
  }

  handlePreviewStateChange(event) {
    const state = event.currentTarget.dataset.state;
    this.forcedState = this.forcedState === state ? "" : state;
  }

  get previewStateButtons() {
    const active = this.forcedState;
    const base = "newton-studio__state-btn";
    const makeButton = (state, label, icon) => ({
      state,
      label,
      icon,
      className: state === active ? `${base} ${base}_active` : base,
      ariaPressed: String(state === active)
    });
    return [
      makeButton("", "Populated", "circle-check"),
      makeButton("empty", "Empty", "funnel"),
      makeButton("error", "Error", "circle-alert")
    ];
  }

  get previewEmpty() {
    return !this._config.dataSource;
  }

  // The empty state already says to pick a data source, and real Custom
  // options need no caption.
  get previewCaption() {
    if (this.previewEmpty) return "";
    if (this._config.dataSource === "custom") {
      return this._config.custom.items.length === 0
        ? "Sample options until you add your own."
        : "";
    }
    return "Sample data. Your real options load when the flow runs.";
  }

  get previewLayoutLabel() {
    return LAYOUT_TILES.find((tile) => tile.value === this._config.layout)
      .label;
  }

  get previewSelectionLabel() {
    return this._config.selectionMode === "multi" ? "Multi" : "Single";
  }
}
