export const ORDER_DIRECTION_OPTIONS = [
  { label: "Descending (Z → A)", value: "DESC", icon: "arrow-down-z-a" },
  { label: "Ascending (A → Z)", value: "ASC", icon: "arrow-up-a-z" }
];

export const SOURCE_TILES = [
  {
    value: "picklist",
    label: "Picklist",
    sublabel: "Object picklist field",
    icon: "list"
  },
  {
    value: "collection",
    label: "Collection",
    sublabel: "Flow record collection",
    icon: "layers"
  },
  {
    value: "sobject",
    label: "SOQL query",
    sublabel: "Query any object",
    icon: "database"
  },
  {
    value: "custom",
    label: "Custom options",
    sublabel: "Options you type in",
    icon: "square-pen"
  }
];

export const LAYOUT_TILES = [
  {
    value: "grid",
    label: "Grid",
    sublabel: "Responsive tile grid",
    icon: "layout-grid"
  },
  {
    value: "list",
    label: "List",
    sublabel: "Stacked rows",
    icon: "rows-3"
  },
  {
    value: "horizontal",
    label: "Horizontal",
    sublabel: "Scrolling ribbon",
    icon: "panel-left"
  },
  {
    value: "picklist",
    label: "Dropdown",
    sublabel: "Opens on click",
    icon: "list"
  },
  {
    value: "radio",
    label: "Radio",
    sublabel: "Radio rows",
    icon: "list-checks"
  },
  {
    value: "columns",
    label: "Columns",
    sublabel: "Drag between columns",
    icon: "columns-2"
  },
  {
    value: "dualListbox",
    label: "Dual listbox",
    sublabel: "Move between two lists",
    icon: "list-checks"
  }
];

export const SIZE_TILES = [
  {
    value: "small",
    label: "Small",
    sublabel: "Compact · 7.5 rem",
    shape: { width: "1.125rem", height: "1.125rem" }
  },
  {
    value: "medium",
    label: "Medium",
    sublabel: "Balanced · 12 rem",
    shape: { width: "1.875rem", height: "1.875rem" }
  },
  {
    value: "large",
    label: "Large",
    sublabel: "Roomy · 16 rem",
    shape: { width: "2.5rem", height: "2.5rem" }
  }
];

// Grid column width that each tile size sets.
export const SIZE_COLUMN_WIDTHS = {
  small: "7.5rem",
  medium: "12rem",
  large: "16rem"
};

export const ASPECT_TILES = [
  {
    value: "1:1",
    label: "Square",
    sublabel: "1 × 1",
    shape: { width: "2.25rem", height: "2.25rem" }
  },
  {
    value: "4:3",
    label: "Landscape",
    sublabel: "4 × 3",
    shape: { width: "2.75rem", height: "2.0625rem" }
  },
  {
    value: "16:9",
    label: "Wide",
    sublabel: "16 × 9",
    shape: { width: "3rem", height: "1.6875rem" }
  },
  {
    value: "3:4",
    label: "Portrait",
    sublabel: "3 × 4",
    shape: { width: "1.6875rem", height: "2.25rem" }
  }
];

export const PICKLIST_VALUE_SOURCE_OPTIONS = [
  { label: "API name (default)", value: "apiName", icon: "code" },
  { label: "Label", value: "label", icon: "tag" }
];

export const SORT_BY_OPTIONS = [
  { label: "Source order (default)", value: "none", icon: "list-ordered" },
  { label: "Label", value: "label", icon: "tag" },
  { label: "Value", value: "value", icon: "braces" }
];

export const SORT_DIRECTION_OPTIONS = [
  { label: "Ascending (A → Z)", value: "asc", icon: "arrow-up-a-z" },
  { label: "Descending (Z → A)", value: "desc", icon: "arrow-down-z-a" }
];

export const SPACING_TILES = [
  {
    value: "none",
    label: "None",
    sublabel: "0px",
    shape: { width: "0.125rem", height: "0.125rem" }
  },
  {
    value: "1",
    label: "XXS",
    sublabel: "4px",
    shape: { width: "0.375rem", height: "0.375rem" }
  },
  {
    value: "2",
    label: "XS",
    sublabel: "8px",
    shape: { width: "0.5rem", height: "0.5rem" }
  },
  {
    value: "3",
    label: "S",
    sublabel: "12px",
    shape: { width: "0.75rem", height: "0.75rem" }
  },
  {
    value: "4",
    label: "M",
    sublabel: "16px",
    shape: { width: "1rem", height: "1rem" }
  },
  {
    value: "5",
    label: "L",
    sublabel: "20px",
    shape: { width: "1.25rem", height: "1.25rem" }
  },
  {
    value: "6",
    label: "XL",
    sublabel: "24px",
    shape: { width: "1.5rem", height: "1.5rem" }
  },
  {
    value: "7",
    label: "2XL",
    sublabel: "32px",
    shape: { width: "2rem", height: "2rem" }
  },
  {
    value: "8",
    label: "3XL",
    sublabel: "40px",
    shape: { width: "2.25rem", height: "2.25rem" }
  },
  {
    value: "9",
    label: "4XL",
    sublabel: "48px",
    shape: { width: "2.5rem", height: "2.5rem" }
  }
];

export const PADDING_TILES = [
  {
    value: "",
    label: "Auto",
    sublabel: "From size",
    icon: "wand-sparkles"
  },
  ...SPACING_TILES
];

export const AUTO_SPACING_TILES = [
  {
    value: "",
    label: "Auto",
    sublabel: "Standard spacing",
    icon: "wand-sparkles"
  },
  ...SPACING_TILES
];

export const SPACING_SIDES = ["top", "right", "bottom", "left"];

export const SIDE_META = [
  { side: "top", label: "Top", icon: "panel-top" },
  { side: "right", label: "Right", icon: "panel-right" },
  { side: "bottom", label: "Bottom", icon: "panel-bottom" },
  { side: "left", label: "Left", icon: "panel-left" }
];

export const BADGE_POSITIONS = [
  {
    value: "top-left",
    label: "Top left",
    sublabel: "On the corner",
    icon: "square-arrow-up-left"
  },
  {
    value: "top-right",
    label: "Top right",
    sublabel: "On the corner",
    icon: "square-arrow-up-right"
  },
  {
    value: "bottom-left",
    label: "Bottom left",
    sublabel: "On the corner",
    icon: "square-arrow-down-left"
  },
  {
    value: "bottom-right",
    label: "Bottom right",
    sublabel: "On the corner",
    icon: "square-arrow-down-right"
  },
  {
    value: "bottom-inline",
    label: "Inline",
    sublabel: "Under the text",
    icon: "align-center-horizontal"
  }
];

export const BADGE_SHAPES = [
  {
    value: "pill",
    label: "Pill",
    sublabel: "Rounded ends",
    shape: {
      width: "2.25rem",
      height: "0.75rem",
      radius: "var(--slds-g-radius-border-pill, 999px)"
    }
  },
  {
    value: "square",
    label: "Square",
    sublabel: "Square corners",
    shape: {
      width: "1.5rem",
      height: "1.5rem",
      radius: "var(--slds-g-radius-border-2, 0.25rem)"
    }
  }
];

export const COLUMN_CHIPS = [
  { value: "", label: "Auto" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
  { value: "6", label: "6" }
];

export const SELECTION_INDICATOR_TILES = [
  {
    value: "checkmark",
    label: "Checkmark",
    sublabel: "Floating circle",
    icon: "check"
  },
  {
    value: "fill",
    label: "Fill",
    sublabel: "Tile fills brand",
    icon: "palette"
  },
  {
    value: "bar",
    label: "Bar",
    sublabel: "Edge accent bar",
    icon: "rows-3"
  },
  {
    value: "frame",
    label: "Frame",
    sublabel: "Inset outline",
    icon: "focus"
  },
  {
    value: "ribbon",
    label: "Ribbon",
    sublabel: "Folded corner",
    icon: "award"
  },
  {
    value: "pulse",
    label: "Pulse",
    sublabel: "Breathing halo",
    icon: "message-circle"
  }
];

export const ELEVATION_TILES = [
  {
    value: "plain",
    label: "Plain",
    sublabel: "No edge",
    icon: "minus"
  },
  {
    value: "subtle",
    label: "Subtle",
    sublabel: "Tinted edge",
    icon: "circle"
  },
  {
    value: "outlined",
    label: "Outlined",
    sublabel: "Crisp edge",
    icon: "square"
  },
  {
    value: "raised",
    label: "Raised",
    sublabel: "Soft depth",
    icon: "upload"
  },
  {
    value: "floating",
    label: "Floating",
    sublabel: "More depth",
    icon: "layers"
  },
  {
    value: "inset",
    label: "Inset",
    sublabel: "Inner edge",
    icon: "scan"
  }
];

export function spacingTileList(source, activeValue) {
  return source.map((t, i) => ({
    id: `${t.value || "auto"}-${i}`,
    value: t.value,
    label: t.label,
    sublabel: t.sublabel,
    icon: t.icon,
    shape: t.shape,
    _selected: t.value === activeValue
  }));
}

export const SECTIONS = [
  { key: "data", label: "Data", icon: "database", numeral: "01" },
  { key: "content", label: "Content", icon: "type", numeral: "02" },
  {
    key: "behavior",
    label: "Behavior",
    icon: "panels-top-left",
    numeral: "03"
  },
  {
    key: "appearance",
    label: "Appearance",
    icon: "palette",
    numeral: "04"
  }
];

// Keys of a per-value override that count as a customization in the editor.
// The runtime (newtonSelectorUtilityDataSources) copies only the text fields
// onto the option; "hidden" is not copied, it removes the option instead.
export const OVERRIDE_FIELDS = [
  "label",
  "sublabel",
  "icon",
  "badge",
  "helpText",
  "hidden"
];

export const GRID_MIN_WIDTH_RANGE = { min: 6, max: 32, step: 1, fallback: 7.5 };

export const PATTERN_TILES = [
  {
    value: "none",
    label: "None",
    sublabel: "Clean surface",
    icon: "ban"
  },
  {
    value: "dots",
    label: "Dots",
    sublabel: "Fine grid",
    icon: "network"
  },
  {
    value: "lines",
    label: "Lines",
    sublabel: "Horizontal",
    icon: "rows-3"
  },
  {
    value: "diagonal",
    label: "Diagonal",
    sublabel: "45° stripes",
    icon: "arrow-up-to-line"
  },
  {
    value: "grid",
    label: "Grid",
    sublabel: "Crosshatch",
    icon: "table"
  },
  {
    value: "glow",
    label: "Glow",
    sublabel: "Radial spotlight",
    icon: "lightbulb"
  },
  {
    value: "noise",
    label: "Noise",
    sublabel: "Subtle grain",
    icon: "signpost"
  },
  {
    value: "paper",
    label: "Paper",
    sublabel: "Paper texture",
    icon: "sticky-note"
  },
  {
    value: "waves",
    label: "Waves",
    sublabel: "Banded rows",
    icon: "chart-line"
  }
];

export const CORNER_TILES = [
  {
    value: "none",
    label: "None",
    sublabel: "Clean corners",
    icon: "ban"
  },
  {
    value: "trim",
    label: "Trim",
    sublabel: "Printer marks",
    icon: "crop"
  },
  {
    value: "brackets",
    label: "Brackets",
    sublabel: "Heavier L-corners",
    icon: "brackets"
  },
  {
    value: "dots",
    label: "Dots",
    sublabel: "Small corner dots",
    icon: "circle"
  }
];

export const SURFACE_TILES = [
  {
    value: "solid",
    label: "Solid",
    sublabel: "Default surface",
    icon: "shapes"
  },
  {
    value: "gradient-top",
    label: "Top fade",
    sublabel: "Linear top-down",
    icon: "gauge"
  },
  {
    value: "gradient-radial",
    label: "Spotlight",
    sublabel: "Radial from top",
    icon: "list"
  },
  {
    value: "gradient-diagonal",
    label: "Diagonal",
    sublabel: "45° linear wash",
    icon: "arrow-up-to-line"
  },
  {
    value: "tint",
    label: "Tint",
    sublabel: "Flat soft fill",
    icon: "palette"
  }
];

export const ICON_DECOR_TILES = [
  {
    value: "none",
    label: "None",
    sublabel: "Plain glyph",
    icon: "ban"
  },
  {
    value: "ring",
    label: "Ring",
    sublabel: "Circular outline",
    icon: "circle"
  },
  {
    value: "halo",
    label: "Halo",
    sublabel: "Aura glyph",
    icon: "lightbulb"
  },
  {
    value: "badge",
    label: "Medal",
    sublabel: "Medal shape",
    icon: "award"
  },
  {
    value: "square",
    label: "Square",
    sublabel: "Square glyph",
    icon: "square"
  }
];

export const ICON_STYLE_TILES = [
  {
    value: "filled",
    label: "Filled",
    sublabel: "Solid tint",
    icon: "circle"
  },
  {
    value: "outlined",
    label: "Outlined",
    sublabel: "Ring only",
    icon: "sliders-horizontal"
  },
  {
    value: "soft",
    label: "Soft",
    sublabel: "Ghost placeholder",
    icon: "layers"
  },
  {
    value: "glow",
    label: "Glow",
    sublabel: "Radiating halo",
    icon: "lightbulb"
  }
];

export const ICON_SHADING_TILES = [
  {
    value: "flat",
    label: "Flat",
    sublabel: "Solid color",
    icon: "rectangle-horizontal"
  },
  {
    value: "gradient",
    label: "Gradient",
    sublabel: "Light to dark",
    icon: "list-ordered"
  },
  {
    value: "emboss",
    label: "Emboss",
    sublabel: "Pressed-in",
    icon: "anchor"
  }
];

export const ICON_SIZE_TILES = [
  {
    value: "xx-small",
    label: "XX-small",
    sublabel: "0.75rem",
    icon: "minimize"
  },
  {
    value: "x-small",
    label: "X-small",
    sublabel: "1rem",
    icon: "minimize"
  },
  {
    value: "small",
    label: "Small",
    sublabel: "1.25rem",
    icon: "rectangle-horizontal"
  },
  {
    value: "medium",
    label: "Medium",
    sublabel: "1.5rem",
    icon: "expand"
  },
  { value: "large", label: "Large", sublabel: "2rem", icon: "expand" }
];

export const GLYPH_TONE_SWATCHES = [
  { value: "auto", label: "Auto" },
  { value: "contrast", label: "Contrast" },
  { value: "neutral", label: "Neutral" },
  { value: "brand", label: "Brand" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error" },
  { value: "violet", label: "Violet" },
  { value: "pink", label: "Pink" },
  { value: "teal", label: "Teal" },
  { value: "custom", label: "Custom" }
];

export const TONE_SWATCHES = [
  { value: "neutral", label: "Neutral" },
  { value: "brand", label: "Brand" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error" },
  { value: "violet", label: "Violet" },
  { value: "pink", label: "Pink" },
  { value: "teal", label: "Teal" },
  { value: "custom", label: "Custom" }
];
