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
    value: "preview-option-a",
    disabled: false
  },
  {
    id: "preview-option-b",
    label: "Option B",
    sublabel: "Sample option",
    icon: "square",
    badge: "Sample",
    helpText: "",
    value: "preview-option-b",
    disabled: false
  },
  {
    id: "preview-option-c",
    label: "Option C",
    sublabel: "Sample option",
    icon: "triangle",
    badge: "Sample",
    helpText: "",
    value: "preview-option-c",
    disabled: false
  },
  {
    id: "preview-option-d",
    label: "Option D",
    sublabel: "Sample option",
    icon: "star",
    badge: "Sample",
    helpText: "",
    value: "preview-option-d",
    disabled: false
  }
]);

function sampleAt(index) {
  return PREVIEW_SAMPLE_ITEMS[index % PREVIEW_SAMPLE_ITEMS.length];
}

function previewValue(value, fallback) {
  return value === undefined || value === null || value === ""
    ? fallback
    : String(value);
}

// Custom options render as configured (gaps filled from the samples); every
// other source shows sample options keyed by the configured overrides.
function previewItems(config) {
  const customItems = config.custom.items.filter(
    (item) => item?.hidden !== true
  );
  if (config.dataSource === "custom" && customItems.length > 0) {
    return customItems.map((item, index) => {
      const sample = sampleAt(index);
      return {
        ...sample,
        ...item,
        id: item.id || `preview-custom-${index}`,
        label: item.label || sample.label,
        sublabel: item.sublabel || sample.sublabel,
        icon: item.icon || sample.icon,
        badge: item.badge || sample.badge,
        value: previewValue(item.value, sample.value),
        disabled: Boolean(item.disabled)
      };
    });
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
  @api forcedState = "";

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
    this.dispatchEvent(
      new CustomEvent("previewstatechange", {
        detail: event.currentTarget.dataset.state
      })
    );
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

  // The empty state already says to pick a data source, so no caption then.
  get previewCaption() {
    if (this.previewEmpty) return "";
    if (
      this._config.dataSource === "custom" &&
      this._config.custom.items.length === 0
    ) {
      return "Sample options until you add your own.";
    }
    return "Sample data. Your real options load when the flow runs.";
  }

  get previewLayoutLabel() {
    return (
      LAYOUT_TILES.find((tile) => tile.value === this._config.layout)?.label ||
      "Grid"
    );
  }

  get previewSelectionLabel() {
    return this._config.selectionMode === "multi" ? "Multi" : "Single";
  }
}
