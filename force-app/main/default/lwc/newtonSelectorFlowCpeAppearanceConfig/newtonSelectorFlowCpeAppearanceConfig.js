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
  AUTO_SPACING_TILES,
  BADGE_POSITIONS,
  BADGE_SHAPES,
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
  SPACING_SIDES,
  SURFACE_TILES,
  TONE_SWATCHES,
  spacingTileList
} from "c/newtonSelectorFlowCpeUtilityConfigOptions";

// The runtime accepts #RGB, #RRGGBB and #RRGGBBAA and drops anything else.
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const ICON_SIZE_OPTIONS = [
  { value: "auto", label: "Auto", sublabel: "Match tile", icon: "refresh-cw" },
  ...ICON_SIZE_TILES
];

const BADGE_TONES = [
  ...TONE_SWATCHES.slice(0, -1),
  { value: "inverse", label: "Inverse" },
  TONE_SWATCHES[TONE_SWATCHES.length - 1]
];

const STATE_TONES = [
  { key: "normal", label: "Normal", suffix: "Tone" },
  { key: "hover", label: "Hover", suffix: "HoverTone" },
  { key: "selected", label: "Selected", suffix: "SelectedTone" },
  { key: "disabled", label: "Disabled", suffix: "DisabledTone" }
];

/**
 * Appearance chapter of the config modal. Reads the merged selector config
 * (every key present) and emits `configpatch` with the whole next config.
 */
export default class NewtonSelectorFlowCpeAppearanceConfig extends LightningElement {
  @api config;

  // Hex fields whose typed value was rejected, keyed by config key; the value
  // is "true" so it can drive aria-invalid directly.
  _hexErrors = {};

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
  get hexErrors() {
    return this._hexErrors;
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
  get showGapCard() {
    return this.showGapHorizontal || this.showGapVertical;
  }

  get layoutTiles() {
    return this.selectedTiles(LAYOUT_TILES, this.layout);
  }
  get sizeTiles() {
    return this.selectedTiles(SIZE_TILES, this.gridConfig.size);
  }
  get aspectTiles() {
    return this.selectedTiles(ASPECT_TILES, this.gridConfig.aspectRatio);
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
    return this.selectedTiles(
      SELECTION_INDICATOR_TILES,
      this.gridConfig.selectionIndicator
    );
  }
  get elevationTiles() {
    return this.selectedTiles(ELEVATION_TILES, this.gridConfig.elevation);
  }

  get patternTiles() {
    return this.selectedTiles(PATTERN_TILES, this.gridConfig.pattern);
  }
  get patternToneRows() {
    return this.stateToneRows(
      "pattern",
      "Pattern",
      this.gridConfig.pattern !== "none"
    );
  }

  get cornerTiles() {
    return this.selectedTiles(CORNER_TILES, this.gridConfig.cornerStyle);
  }
  get cornerToneChips() {
    return this.toneChips(
      TONE_SWATCHES,
      this.gridConfig.cornerTone,
      this.gridConfig.cornerStyle !== "none"
    );
  }
  get cornerToneIsCustom() {
    return this.gridConfig.cornerTone === "custom";
  }

  get surfaceTiles() {
    return this.selectedTiles(SURFACE_TILES, this.gridConfig.surfaceStyle);
  }
  get surfaceToneRows() {
    return this.stateToneRows("surface", "Surface", true);
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
    return this.selectedTiles(ICON_SIZE_OPTIONS, this.gridConfig.iconSize);
  }
  get iconDecorTiles() {
    return this.selectedTiles(ICON_DECOR_TILES, this.gridConfig.iconDecor);
  }
  get showIconTreatment() {
    return this.gridConfig.iconDecor !== "none";
  }
  get iconStyleTiles() {
    return this.selectedTiles(ICON_STYLE_TILES, this.gridConfig.iconStyle);
  }
  get showIconShading() {
    return this.gridConfig.iconStyle === "filled";
  }
  get iconShadingTiles() {
    return this.selectedTiles(ICON_SHADING_TILES, this.gridConfig.iconShading);
  }
  get iconToneChips() {
    return this.toneChips(TONE_SWATCHES, this.gridConfig.iconTone, true);
  }
  get iconToneIsCustom() {
    return this.gridConfig.iconTone === "custom";
  }
  get iconGlyphToneChips() {
    return this.toneChips(
      GLYPH_TONE_SWATCHES,
      this.gridConfig.iconGlyphTone,
      true
    );
  }
  get iconGlyphToneIsCustom() {
    return this.gridConfig.iconGlyphTone === "custom";
  }

  get badgePositionTiles() {
    return this.selectedTiles(BADGE_POSITIONS, this.gridConfig.badge.position);
  }
  get badgeVariantChips() {
    return this.toneChips(BADGE_TONES, this.gridConfig.badge.variant, true);
  }
  get badgeVariantIsCustom() {
    return this.gridConfig.badge.variant === "custom";
  }
  get badgeShapeTiles() {
    return this.selectedTiles(BADGE_SHAPES, this.gridConfig.badge.shape);
  }

  get gapHTiles() {
    return spacingTileList(AUTO_SPACING_TILES, this.gridConfig.gapH);
  }
  get gapVTiles() {
    return spacingTileList(AUTO_SPACING_TILES, this.gridConfig.gapV);
  }
  get marginLinked() {
    return this.gridConfig.margin.linked;
  }
  get paddingLinked() {
    return this.gridConfig.padding.linked;
  }
  get marginAllTiles() {
    return spacingTileList(AUTO_SPACING_TILES, this.gridConfig.margin.top);
  }
  get paddingAllTiles() {
    return spacingTileList(PADDING_TILES, this.gridConfig.padding.top);
  }
  get marginSideSections() {
    return this.sideSections(AUTO_SPACING_TILES, "margin", "Margin");
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
      JSON.stringify(this.gridConfig) === this._undoReset.resetSignature
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
      resetSignature: JSON.stringify(next.gridConfig)
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

  // Tile groups and tone chips name the gridConfig key they set in
  // data-key; tiles report the value in the cardselect detail, chips in
  // data-value.
  handleTileChange(event) {
    this.patchGrid({ [event.currentTarget.dataset.key]: event.detail.value });
  }
  handleToneChange(event) {
    const { key, value } = event.currentTarget.dataset;
    this.patchGrid({ [key]: value });
  }
  handleBadgeTileChange(event) {
    this.patchBadge({ [event.currentTarget.dataset.key]: event.detail.value });
  }
  handleBadgeVariantChange(event) {
    this.patchBadge({ variant: event.currentTarget.dataset.value });
  }

  // Color swatches always produce a valid hex; typed values are checked and
  // only stored when valid (or cleared), otherwise an inline error shows.
  handleHexChange(event) {
    const key = event.target.dataset.hexKey;
    const value = event.target.value.trim();
    const valid = value === "" || HEX_COLOR.test(value);
    const errors = { ...this._hexErrors };
    if (valid) delete errors[key];
    else errors[key] = "true";
    this._hexErrors = errors;
    if (!valid) return;
    if (key === "variantHex") this.patchBadge({ variantHex: value });
    else this.patchGrid({ [key]: value });
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

  selectedTiles(source, active) {
    return source.map((tile) => ({
      ...tile,
      id: tile.value,
      _selected: tile.value === active
    }));
  }
  toneChips(tones, active, enabled) {
    return tones.map((tone) => ({
      ...tone,
      className: [
        "newton-tone-chip",
        `newton-tone-chip_${tone.value}`,
        tone.value === active ? "newton-tone-chip_active" : "",
        enabled ? "" : "newton-tone-chip_disabled"
      ]
        .filter(Boolean)
        .join(" "),
      ariaPressed: String(tone.value === active),
      dotClassName: `newton-tone-chip__dot newton-tone-chip__dot_${tone.value}`,
      disabled: !enabled
    }));
  }
  stateToneRows(axis, axisLabel, enabled) {
    return STATE_TONES.map((state) => {
      const toneKey = `${axis}${state.suffix}`;
      const hexKey = `${toneKey}Hex`;
      const active = this.gridConfig[toneKey];
      const stateLabel = state.label.toLowerCase();
      return {
        label: state.label,
        toneKey,
        hexKey,
        rowKey: `${axis}-${state.key}`,
        ariaLabel: `${axisLabel} ${stateLabel} color`,
        chips: this.toneChips(TONE_SWATCHES, active, enabled),
        isCustom: enabled && active === "custom",
        hexValue: this.gridConfig[hexKey],
        hexId: `${axis}-${state.key}-tone-hex`,
        hexErrorId: `${axis}-${state.key}-tone-hex-error`,
        hexInvalid: this._hexErrors[hexKey],
        colorAriaLabel: `Pick ${axisLabel.toLowerCase()} ${stateLabel} color`,
        hexAriaLabel: `${axisLabel} ${stateLabel} hex color value`
      };
    });
  }
  sideSections(source, name, property) {
    return SIDE_META.map((meta) => ({
      ...meta,
      groupLabel: `${property} ${meta.label.toLowerCase()}`,
      tiles: spacingTileList(source, this.gridConfig[name][meta.side])
    }));
  }

  emit(config) {
    this.dispatchEvent(
      new CustomEvent("configpatch", { detail: { path: [], value: config } })
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
    if (!SPACING_SIDES.includes(side)) return;
    this.patchGrid({
      [name]: { ...this.gridConfig[name], [side]: value, linked: false }
    });
  }
}
