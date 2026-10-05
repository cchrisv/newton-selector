import { api, LightningElement } from "lwc";
import {
  resetAppearance,
  switchLayout
} from "c/newtonSelectorFlowCpeUtilityConfigState";
import {
  formatRem,
  parseRemValue
} from "c/newtonSelectorUtilityConfigDefaults";
import {
  ASPECT_TILES,
  BADGE_POSITIONS,
  BADGE_SHAPES,
  BADGE_TONE_SWATCHES,
  COLUMN_CHIPS,
  CORNER_TILES,
  ELEVATION_TILES,
  GLYPH_TONE_SWATCHES,
  GRID_MIN_WIDTH_RANGE,
  ICON_DECOR_TILES,
  ICON_SHADING_TILES,
  ICON_SIZE_TILES,
  ICON_STYLE_TILES,
  LAYOUT_TILES,
  PADDING_TILES,
  PATTERN_TILES,
  SELECTION_INDICATOR_TILES,
  SIDE_META,
  SIZE_COLUMN_WIDTHS,
  SIZE_TILES,
  SPACING_TILES,
  SURFACE_TILES,
  TONE_SWATCHES,
  tileList
} from "c/newtonSelectorFlowCpeUtilityConfigOptions";

const STATE_TONES = [
  { key: "normal", label: "Normal", suffix: "Tone" },
  { key: "hover", label: "Hover", suffix: "HoverTone" },
  { key: "selected", label: "Selected", suffix: "SelectedTone" },
  { key: "disabled", label: "Disabled", suffix: "DisabledTone" }
];

// Everything Reset replaces plus the layout it was applied to; Undo is
// offered only while this is unchanged.
function appearanceSignature(config) {
  return JSON.stringify({
    layout: config.layout,
    gridConfig: config.gridConfig,
    layoutGeometry: config.layoutGeometry || {}
  });
}

/**
 * Appearance chapter of the config modal. Reads the merged selector config
 * (every key present) and emits `configpatch` with the whole next config.
 */
export default class NewtonSelectorFlowCpeAppearanceConfig extends LightningElement {
  @api config;

  // "Reset appearance" with Undo: keep what Reset replaced until the
  // appearance changes again, then withdraw the offer so Undo can never
  // overwrite newer work.
  _undoReset = null;

  get gridConfig() {
    return this.config.gridConfig;
  }
  get layout() {
    return this.config.layout;
  }

  get showAspectRatio() {
    return this.layout === "grid" || this.layout === "horizontal";
  }
  get showColumns() {
    return this.layout === "grid";
  }
  get showGridMinWidth() {
    return this.showAspectRatio;
  }
  get showGapHorizontal() {
    return ["grid", "horizontal", "columns", "dualListbox"].includes(
      this.layout
    );
  }
  get showGapVertical() {
    return [
      "grid",
      "list",
      "picklist",
      "radio",
      "columns",
      "dualListbox"
    ].includes(this.layout);
  }

  get layoutTiles() {
    return tileList(LAYOUT_TILES, this.layout);
  }
  get sizeTiles() {
    return tileList(SIZE_TILES, this.gridConfig.size);
  }
  get aspectTiles() {
    return tileList(ASPECT_TILES, this.gridConfig.aspectRatio);
  }
  get columnChips() {
    const active =
      this.gridConfig.columns == null ? "" : String(this.gridConfig.columns);
    return COLUMN_CHIPS.map((chip) => ({
      ...chip,
      className:
        chip.value === active
          ? "newton-studio__col-chip newton-studio__col-chip_active"
          : "newton-studio__col-chip",
      ariaPressed: String(chip.value === active)
    }));
  }
  get selectionIndicatorTiles() {
    return tileList(
      SELECTION_INDICATOR_TILES,
      this.gridConfig.selectionIndicator
    );
  }
  get elevationTiles() {
    return tileList(ELEVATION_TILES, this.gridConfig.elevation);
  }

  get patternTiles() {
    return tileList(PATTERN_TILES, this.gridConfig.pattern);
  }
  get patternToneRows() {
    return this.stateToneRows(
      "pattern",
      "Pattern",
      this.gridConfig.pattern === "none"
    );
  }

  get cornerTiles() {
    return tileList(CORNER_TILES, this.gridConfig.cornerStyle);
  }
  get cornerToneDisabled() {
    return this.gridConfig.cornerStyle === "none";
  }

  get surfaceTiles() {
    return tileList(SURFACE_TILES, this.gridConfig.surfaceStyle);
  }
  get surfaceToneRows() {
    return this.stateToneRows("surface", "Surface", false);
  }

  get showIconsValue() {
    return this.gridConfig.showIcons;
  }
  get showBadgesValue() {
    return this.gridConfig.showBadges;
  }
  get iconSubchapterClass() {
    return this.showIconsValue
      ? "newton-studio__subchapter"
      : "newton-studio__subchapter newton-studio__subchapter_off";
  }
  get badgeSubchapterClass() {
    return this.showBadgesValue
      ? "newton-studio__subchapter"
      : "newton-studio__subchapter newton-studio__subchapter_off";
  }

  get iconSizeTiles() {
    return tileList(ICON_SIZE_TILES, this.gridConfig.iconSize);
  }
  get iconDecorTiles() {
    return tileList(ICON_DECOR_TILES, this.gridConfig.iconDecor);
  }
  get showIconTreatment() {
    return this.gridConfig.iconDecor !== "none";
  }
  get iconStyleTiles() {
    return tileList(ICON_STYLE_TILES, this.gridConfig.iconStyle);
  }
  get showIconShading() {
    return this.gridConfig.iconStyle === "filled";
  }
  get iconShadingTiles() {
    return tileList(ICON_SHADING_TILES, this.gridConfig.iconShading);
  }
  get toneSwatches() {
    return TONE_SWATCHES;
  }
  get glyphToneSwatches() {
    return GLYPH_TONE_SWATCHES;
  }
  get badgeToneSwatches() {
    return BADGE_TONE_SWATCHES;
  }

  get badgePositionTiles() {
    return tileList(BADGE_POSITIONS, this.gridConfig.badge.position);
  }
  get badgeShapeTiles() {
    return tileList(BADGE_SHAPES, this.gridConfig.badge.shape);
  }

  get gapHTiles() {
    return tileList(SPACING_TILES, this.gridConfig.gapH);
  }
  get gapVTiles() {
    return tileList(SPACING_TILES, this.gridConfig.gapV);
  }
  get marginLinked() {
    return this.gridConfig.margin.linked;
  }
  get paddingLinked() {
    return this.gridConfig.padding.linked;
  }
  get marginAllTiles() {
    return tileList(SPACING_TILES, this.gridConfig.margin.top);
  }
  get paddingAllTiles() {
    return tileList(PADDING_TILES, this.gridConfig.padding.top);
  }
  get marginSideSections() {
    return this.sideSections(SPACING_TILES, "margin", "Margin");
  }
  get paddingSideSections() {
    return this.sideSections(PADDING_TILES, "padding", "Padding");
  }

  get gridMinWidthRange() {
    return GRID_MIN_WIDTH_RANGE;
  }
  get gridMinWidthNumber() {
    return parseRemValue(
      this.gridConfig.minWidth,
      GRID_MIN_WIDTH_RANGE.fallback
    );
  }
  get gridMinWidthDisplay() {
    return `${this.gridMinWidthNumber} rem`;
  }
  get gridMinWidthScaleMin() {
    return `${GRID_MIN_WIDTH_RANGE.min} rem`;
  }
  get gridMinWidthScaleMax() {
    return `${GRID_MIN_WIDTH_RANGE.max} rem`;
  }

  get showResetUndo() {
    return Boolean(
      this._undoReset &&
      appearanceSignature(this.config) === this._undoReset.resetSignature
    );
  }

  // Switching layout keeps every style setting and swaps only the geometry,
  // remembering each layout's own geometry so switching back restores it.
  handleLayoutTileChange(event) {
    const next = switchLayout(this.config, event.detail.value);
    if (next !== this.config) this.emit(next);
  }

  handleResetAppearance() {
    const next = resetAppearance(this.config);
    this._undoReset = {
      before: JSON.parse(
        JSON.stringify({
          gridConfig: this.gridConfig,
          layoutGeometry: this.config.layoutGeometry || {}
        })
      ),
      resetSignature: appearanceSignature(next)
    };
    this.emit(next);
  }

  handleUndoReset() {
    const { before } = this._undoReset;
    this._undoReset = null;
    this.emit({ ...this.config, ...before });
  }

  handleSizeTileChange(event) {
    const size = event.detail.value;
    this.patchGrid({ size, minWidth: SIZE_COLUMN_WIDTHS[size] });
  }
  handleColumnsChange(event) {
    const raw = event.currentTarget.dataset.value;
    this.patchGrid({ columns: raw === "" ? null : Number(raw) });
  }
  handleGridMinWidthChange(event) {
    this.patchGrid({ minWidth: formatRem(Number(event.target.value)) });
  }

  // Tile groups name the gridConfig key they set in data-key and report the
  // value in the cardselect detail.
  handleTileChange(event) {
    this.patchGrid({ [event.currentTarget.dataset.key]: event.detail.value });
  }
  handleBadgeTileChange(event) {
    this.patchBadge({ [event.currentTarget.dataset.key]: event.detail.value });
  }

  // Tone rows report { key, value } for both tonechange and hexchange; the
  // badge's keys live under gridConfig.badge.
  handleToneRowChange(event) {
    const { key, value } = event.detail;
    if (key === "variant" || key === "variantHex") {
      this.patchBadge({ [key]: value });
    } else {
      this.patchGrid({ [key]: value });
    }
  }

  handleShowIconsToggle(event) {
    this.patchGrid({ showIcons: event.detail.checked });
  }
  handleShowBadgesToggle(event) {
    this.patchGrid({ showBadges: event.detail.checked });
  }

  handleMarginLinkToggle(event) {
    this.patchBoxLinked("margin", event.detail.checked);
  }
  handlePaddingLinkToggle(event) {
    this.patchBoxLinked("padding", event.detail.checked);
  }
  handleMarginAllChange(event) {
    this.patchBoxAll("margin", event.detail.value);
  }
  handlePaddingAllChange(event) {
    this.patchBoxAll("padding", event.detail.value);
  }
  handleMarginSideChange(event) {
    this.patchBoxSide(
      "margin",
      event.currentTarget.dataset.side,
      event.detail.value
    );
  }
  handlePaddingSideChange(event) {
    this.patchBoxSide(
      "padding",
      event.currentTarget.dataset.side,
      event.detail.value
    );
  }

  stateToneRows(axis, axisLabel, disabled) {
    return STATE_TONES.map((state) => {
      const toneKey = `${axis}${state.suffix}`;
      const hexKey = `${toneKey}Hex`;
      const stateLabel = state.label.toLowerCase();
      return {
        rowKey: `${axis}-${state.key}`,
        label: state.label,
        groupLabel: `${axisLabel} ${stateLabel} color`,
        toneKey,
        hexKey,
        value: this.gridConfig[toneKey],
        hexValue: this.gridConfig[hexKey],
        disabled,
        colorAriaLabel: `Pick ${axisLabel.toLowerCase()} ${stateLabel} color`,
        hexAriaLabel: `${axisLabel} ${stateLabel} hex color value`
      };
    });
  }
  sideSections(source, name, property) {
    return SIDE_META.map((meta) => ({
      ...meta,
      groupLabel: `${property} ${meta.label.toLowerCase()}`,
      tiles: tileList(source, this.gridConfig[name][meta.side])
    }));
  }

  emit(config) {
    this.dispatchEvent(
      new CustomEvent("configpatch", { detail: { value: config } })
    );
  }
  patchGrid(values) {
    this.emit({
      ...this.config,
      gridConfig: { ...this.gridConfig, ...values }
    });
  }
  patchBadge(values) {
    this.patchGrid({ badge: { ...this.gridConfig.badge, ...values } });
  }
  patchBoxLinked(name, linked) {
    const box = { ...this.gridConfig[name], linked };
    if (linked) {
      box.right = box.bottom = box.left = box.top;
    }
    this.patchGrid({ [name]: box });
  }
  patchBoxAll(name, value) {
    this.patchGrid({
      [name]: {
        linked: true,
        top: value,
        right: value,
        bottom: value,
        left: value
      }
    });
  }
  patchBoxSide(name, side, value) {
    this.patchGrid({
      [name]: { ...this.gridConfig[name], [side]: value, linked: false }
    });
  }
}
