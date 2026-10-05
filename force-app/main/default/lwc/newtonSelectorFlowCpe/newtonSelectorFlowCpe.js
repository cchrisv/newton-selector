import { LightningElement, api, track } from "lwc";
import NewtonSelectorFlowCpeConfigModal from "c/newtonSelectorFlowCpeConfigModal";
import {
  CHOOSE_COLLECTION_MESSAGE,
  sectionIssues
} from "c/newtonSelectorFlowCpeUtilityConfigValidation";
import {
  ASPECT_TILES,
  BADGE_POSITIONS,
  BADGE_TONE_SWATCHES,
  CORNER_TILES,
  ELEVATION_TILES,
  ICON_DECOR_TILES,
  LAYOUT_TILES,
  PATTERN_TILES,
  SECTIONS,
  SELECTION_INDICATOR_TILES,
  SIZE_TILES,
  SOURCE_TILES,
  SPACING_TILES,
  SURFACE_TILES,
  TONE_SWATCHES
} from "c/newtonSelectorFlowCpeUtilityConfigOptions";
import {
  DEFAULT_QUERY_LIMIT,
  defaultGridConfig,
  manualInputLabelOf,
  mergeSelectorConfig,
  noneOptionLabelOf
} from "c/newtonSelectorUtilityConfigDefaults";
import { recordCollectionObjectType } from "c/newtonSelectorFlowCpeUtilityConfigState";
import {
  formattedValue,
  getDataType
} from "c/newtonSelectorFlowCpeUtilityHelpers";

const CONFIG_KEY = "selectorConfigJson";
const SOURCE_RECORDS_KEY = "sourceRecords";
const VALUE_KEY = "value";
const VALUES_KEY = "values";
const UNREADABLE_CONFIG_MESSAGE =
  "The saved configuration can't be read. Open Edit configuration to set it up again.";

// The summary quotes the editor's own tile labels, never stored values.
function labelOf(options, value, fallback = "") {
  return options.find((option) => option.value === value)?.label || fallback;
}

function fmtToken(t) {
  return (
    SPACING_TILES.find((tile) => tile.value === String(t))?.sublabel ||
    String(t)
  );
}

export default class NewtonSelectorFlowCpe extends LightningElement {
  @api builderContext;
  @api automaticOutputVariables;

  _inputVariables = [];
  _genericTypeMappings = [];
  _sourceRecordsRef = "";
  _valueRef = "";
  _valuesRef = "";
  _lastGenericSObject = "";
  // The stored JSON didn't parse. It stays stored until the admin saves.
  _configUnreadable = false;
  _errors = [];
  @track _config = mergeSelectorConfig();

  @api
  get inputVariables() {
    return this._inputVariables;
  }
  set inputVariables(v) {
    this._inputVariables = Array.isArray(v) ? v : [];
    this.hydrate();
  }

  @api
  get genericTypeMappings() {
    return this._genericTypeMappings;
  }
  set genericTypeMappings(v) {
    this._genericTypeMappings = Array.isArray(v) ? v : [];
    const existing = this._genericTypeMappings.find((m) => m.typeName === "T");
    if (existing?.typeValue) {
      this._lastGenericSObject = existing.typeValue;
    } else if (this.hasDataSource) {
      this.syncGenericTypeMapping();
    }
    this.refreshErrors();
  }

  hydrate() {
    const json = this.readInput(CONFIG_KEY);
    if (json) {
      try {
        this._config = mergeSelectorConfig(JSON.parse(json));
        this._configUnreadable = false;
      } catch {
        this._config = mergeSelectorConfig();
        this._configUnreadable = true;
      }
    }
    this._sourceRecordsRef = this.readReference(SOURCE_RECORDS_KEY);
    this._valueRef = this.readReference(VALUE_KEY);
    this._valuesRef = this.readReference(VALUES_KEY);

    if (this.hasDataSource && !this._lastGenericSObject) {
      this.syncGenericTypeMapping();
    }
    this.refreshErrors();
  }

  readInput(name) {
    return this._inputVariables.find((iv) => iv.name === name)?.value;
  }

  // A Flow resource input as "{!Name}", the form the editor works with.
  readReference(name) {
    const entry = this._inputVariables.find((iv) => iv.name === name);
    return entry?.value ? formattedValue(entry.value, entry.valueDataType) : "";
  }

  get hasSavedConfig() {
    return this.hasDataSource || this._configUnreadable;
  }

  // --- Mode flags ---
  get hasDataSource() {
    return Boolean(this._config.dataSource);
  }
  get isPicklistMode() {
    return this._config.dataSource === "picklist";
  }
  get isCollectionMode() {
    return this._config.dataSource === "collection";
  }
  get isSObjectMode() {
    return this._config.dataSource === "sobject";
  }
  get isCustomMode() {
    return this._config.dataSource === "custom";
  }

  // ========================================================================
  // Summary sections — return readable sentences, not abbreviations.
  // Each section is { title, lines: [{ key, text, detail? }] }.
  // ========================================================================

  // --- Section 1: Data source (what's feeding the selector) ---------------
  get dataSection() {
    const c = this._config;
    const kind = labelOf(SOURCE_TILES, c.dataSource);
    const lines = [];

    if (this.isPicklistMode) {
      const o = c.picklist.objectApiName;
      const f = c.picklist.fieldApiName;
      if (o && f) {
        lines.push({ key: "binding", text: `${o}.${f}`, mono: true });
      } else {
        lines.push({
          key: "missing",
          text: "Object and field not set",
          muted: true
        });
      }
      if (c.picklist.recordTypeId) {
        lines.push({ key: "rt", text: "Filtered by record type", muted: true });
      }
    } else if (this.isCollectionMode) {
      const ref = this._sourceRecordsRef;
      if (ref) lines.push({ key: "binding", text: ref, mono: true });
      else
        lines.push({
          key: "missing",
          text: "No collection bound",
          muted: true
        });
      const mapped = Object.values(c.collection.fieldMap).filter(
        Boolean
      ).length;
      if (mapped)
        lines.push({
          key: "map",
          text: `${mapped} field${mapped === 1 ? "" : "s"} mapped`,
          muted: true
        });
    } else if (this.isSObjectMode) {
      const o = c.sobject.sObjectApiName;
      if (o) lines.push({ key: "binding", text: o, mono: true });
      else
        lines.push({ key: "missing", text: "No object selected", muted: true });
      const meta = [];
      if (c.sobject.whereClause) meta.push("Filtered");
      if (c.sobject.orderByField)
        meta.push(
          `${meta.length ? "sorted" : "Sorted"} by ${c.sobject.orderByField}`
        );
      meta.push(
        `${meta.length ? "up" : "Up"} to ${Number(c.sobject.queryLimit) || DEFAULT_QUERY_LIMIT} options`
      );
      lines.push({ key: "meta", text: meta.join(", "), muted: true });
    } else if (this.isCustomMode) {
      const n = c.custom.items.length;
      lines.push({
        key: "count",
        text: n === 0 ? "No options yet" : `${n} option${n === 1 ? "" : "s"}`,
        muted: n === 0
      });
    }

    return { kind, lines };
  }

  // --- Section 2: Label & text (what the user sees) ---------------------
  get labelSection() {
    const c = this._config;
    const label = (c.label || "").trim();
    const help = (c.helpText || "").trim();
    const tip = (c.fieldLevelHelp || "").trim();
    const lines = [];

    if (label) {
      lines.push({ key: "lbl", text: label });
    } else {
      lines.push({ key: "lbl", text: "No label set", muted: true });
    }
    const extras = [];
    if (help) extras.push("description");
    if (tip) extras.push("tooltip");
    if (extras.length) {
      lines.push({
        key: "extras",
        text: `With ${extras.join(" and ")}`,
        muted: true
      });
    }
    return { lines };
  }

  // --- Section 3: Behavior (how selection works) ------------------------
  get behaviorLines() {
    const c = this._config;
    const lines = [];

    // Primary selection rule — one clear sentence
    if (c.selectionMode === "multi") {
      const min = Number(c.minSelections || 0);
      const max = c.maxSelections;
      let phrase = "Multi select";
      if (min > 0 && max) phrase += `, ${min}–${max} selections`;
      else if (min > 0) phrase += `, at least ${min}`;
      else if (max) phrase += `, up to ${max}`;
      if (c.required && min === 0) phrase += ", required";
      lines.push({ key: "mode", text: phrase });
    } else {
      let phrase = "Single select";
      if (c.required) phrase += ", required";
      lines.push({ key: "mode", text: phrase });
    }

    if (c.autoAdvance && c.selectionMode === "single") {
      lines.push({
        key: "auto",
        text: "Auto-advances the flow on selection",
        muted: true
      });
    }
    if (c.includeNoneOption) {
      const pos = c.noneOptionPosition === "end" ? "end" : "start";
      const lbl = noneOptionLabelOf(c);
      lines.push({
        key: "none",
        text: `Includes "${lbl}" at the ${pos}`,
        muted: true
      });
    }
    if (c.manualInput.enabled) {
      const label = manualInputLabelOf(c);
      const min = Number(c.manualInput.minLength || 0);
      const max = c.manualInput.maxLength;
      let limits = "";
      if (min > 0 && max) limits = `, ${min}-${max} characters`;
      else if (min > 0) limits = `, at least ${min} characters`;
      else if (max) limits = `, up to ${max} characters`;
      lines.push({
        key: "manual",
        text: `Manual "${label}" input${limits}`,
        muted: true
      });
    }
    if (c.enableSearch) {
      lines.push({ key: "search", text: "Search bar enabled", muted: true });
    }
    if (c.showSelectAll && c.selectionMode === "multi") {
      lines.push({
        key: "selall",
        text: "Select all and Clear all buttons",
        muted: true
      });
    }
    const defaultRef =
      c.selectionMode === "multi" ? this._valuesRef : this._valueRef;
    if (defaultRef) {
      lines.push({
        key: "default",
        text: `Default selection: ${defaultRef}`,
        muted: true
      });
    }

    return lines;
  }

  // --- Section 4: Appearance (how it looks) -----------------------------
  get appearanceLines() {
    const c = this._config;
    const g = c.gridConfig;
    const preset = defaultGridConfig(c.layout);
    const lines = [];

    const layoutName = labelOf(LAYOUT_TILES, c.layout, "Grid");

    // Primary layout line — includes columns when pinned.
    const cols = Number(g.columns);
    const colsPhrase =
      Number.isFinite(cols) && cols >= 1 && cols <= 6
        ? `${cols} column${cols === 1 ? "" : "s"}`
        : "auto-fit";
    if (c.layout === "grid") {
      lines.push({ key: "layout", text: `${layoutName}, ${colsPhrase}` });
    } else {
      lines.push({ key: "layout", text: layoutName });
    }

    // Tile size — full words, not initials
    const sizeName = labelOf(SIZE_TILES, g.size, "Small");
    const aspect = g.aspectRatio;
    const aspectName = labelOf(ASPECT_TILES, aspect, aspect).toLowerCase();
    const showsAspect = c.layout === "grid" || c.layout === "horizontal";
    lines.push({
      key: "tile",
      text: showsAspect
        ? `${sizeName} tiles, ${aspectName}`
        : `${sizeName} tiles`,
      muted: true
    });

    // Gaps, only when they differ from the layout's preset.
    if (g.gapH !== preset.gapH || g.gapV !== preset.gapV) {
      const gapH = fmtToken(g.gapH);
      const gapV = fmtToken(g.gapV);
      const gapText = gapH === gapV ? `${gapH} gaps` : `${gapH} × ${gapV} gaps`;
      lines.push({ key: "gap", text: gapText, muted: true });
    }

    // Badge, only when shown and not the default placement/tone.
    const badge = g.badge;
    if (
      g.showBadges !== false &&
      (badge.position !== preset.badge.position ||
        badge.variant !== preset.badge.variant)
    ) {
      lines.push({
        key: "badge",
        text: `Badge: ${labelOf(BADGE_POSITIONS, badge.position, "Inline")}, ${labelOf(BADGE_TONE_SWATCHES, badge.variant, "Neutral")}`,
        muted: true
      });
    }

    // Only show selection indicator / elevation when non-default
    const extras = [];
    if (g.selectionIndicator && g.selectionIndicator !== "frame") {
      extras.push(
        `Selection: ${labelOf(SELECTION_INDICATOR_TILES, g.selectionIndicator, g.selectionIndicator)}`
      );
    }
    if (g.elevation && g.elevation !== "outlined") {
      extras.push(
        `Elevation: ${labelOf(ELEVATION_TILES, g.elevation, g.elevation)}`
      );
    }
    if (extras.length) {
      lines.push({ key: "extras", text: extras.join(" · "), muted: true });
    }

    // Pattern / surface / corner / icon decoration — each named by its tile
    // label with its tone, when not the default.
    const tone = (value, fallback) => labelOf(TONE_SWATCHES, value, fallback);
    const decorParts = [];
    if (g.pattern && g.pattern !== "none") {
      decorParts.push(
        `Pattern: ${labelOf(PATTERN_TILES, g.pattern, g.pattern)}, ${tone(g.patternTone, "Neutral")}`
      );
    }
    if (g.surfaceStyle && g.surfaceStyle !== "solid") {
      decorParts.push(
        `Surface: ${labelOf(SURFACE_TILES, g.surfaceStyle, g.surfaceStyle)}, ${tone(g.surfaceTone, "Neutral")}`
      );
    }
    if (g.cornerStyle && g.cornerStyle !== "none") {
      decorParts.push(
        `Corners: ${labelOf(CORNER_TILES, g.cornerStyle, g.cornerStyle)}, ${tone(g.cornerTone, "Neutral")}`
      );
    }
    if (g.iconDecor && g.iconDecor !== "square") {
      decorParts.push(
        `Icon decoration: ${labelOf(ICON_DECOR_TILES, g.iconDecor, g.iconDecor)}`
      );
    }
    if (decorParts.length) {
      lines.push({ key: "decor", text: decorParts.join(" · "), muted: true });
    }

    // Global visibility flags — surfaced as a line so admins aren't
    // confused when icons/badges appear missing from their data.
    const hidden = [];
    if (g.showIcons === false) hidden.push("Icons");
    if (g.showBadges === false)
      hidden.push(hidden.length ? "badges" : "Badges");
    if (hidden.length) {
      lines.push({
        key: "hidden",
        text: `${hidden.join(" and ")} hidden`,
        muted: true
      });
    }

    return lines;
  }

  // ========================================================================
  // Validation
  // ========================================================================
  @api
  validate() {
    return this.computeErrors();
  }

  // Same checks and words as the editor, so the panel and the modal agree.
  computeErrors() {
    if (this._configUnreadable) {
      return [{ key: CONFIG_KEY, errorString: UNREADABLE_CONFIG_MESSAGE }];
    }
    if (!this.hasDataSource) {
      return [
        {
          key: "selectorConfigJson",
          errorString: "Choose a data source: click Configure selector."
        }
      ];
    }
    const errors = [];
    if (!this._lastGenericSObject) {
      errors.push({
        key: "T",
        errorString: "Finish setup: open Edit configuration and click Save."
      });
    }
    const refs = { sourceRecordsRef: this._sourceRecordsRef };
    for (const section of SECTIONS) {
      for (const message of sectionIssues(section.key, this._config, refs)
        .errors) {
        errors.push({
          key:
            message === CHOOSE_COLLECTION_MESSAGE
              ? "sourceRecords"
              : "selectorConfigJson",
          errorString: message
        });
      }
    }
    return errors;
  }

  // The panel's error list, recomputed when its inputs change rather than on
  // every render.
  refreshErrors() {
    this._errors = this.computeErrors().map((e, i) => ({
      key: `err-${i}`,
      message: e.errorString
    }));
  }
  get hasValidationErrors() {
    return this._errors.length > 0;
  }

  // ========================================================================
  // Configure button — opens the studio modal.
  // ========================================================================
  async handleOpenConfigure() {
    const result = await NewtonSelectorFlowCpeConfigModal.open({
      size: "large",
      description: "Configure Newton Selector",
      initialConfig: this._config,
      initialSourceRecordsRef: this._sourceRecordsRef,
      initialValueRef: this._valueRef,
      initialValuesRef: this._valuesRef,
      builderContext: this.builderContext,
      automaticOutputVariables: this.automaticOutputVariables
    });

    if (!result || result.action !== "save") return;

    this._config = mergeSelectorConfig(result.config);
    this._configUnreadable = false;
    if (result.sourceRecordsRef !== this._sourceRecordsRef) {
      this._sourceRecordsRef = result.sourceRecordsRef;
      this.dispatchCpeChange(
        SOURCE_RECORDS_KEY,
        this._sourceRecordsRef,
        "reference"
      );
    }
    if (result.valueRef !== this._valueRef) {
      this._valueRef = result.valueRef;
      this.dispatchCpeChange(
        VALUE_KEY,
        this._valueRef,
        getDataType(this._valueRef)
      );
    }
    if (result.valuesRef !== this._valuesRef) {
      this._valuesRef = result.valuesRef;
      this.dispatchCpeChange(
        VALUES_KEY,
        this._valuesRef,
        getDataType(this._valuesRef)
      );
    }
    this.syncGenericTypeMapping();
    this.dispatchCpeChange(CONFIG_KEY, JSON.stringify(this._config), "String");
    this.refreshErrors();
  }

  // ========================================================================
  // Generic T type mapping sync
  // ========================================================================
  syncGenericTypeMapping() {
    const target = this.resolveGenericSObject();
    if (!target || target === this._lastGenericSObject) return;
    this._lastGenericSObject = target;
    this.dispatchEvent(
      new CustomEvent("configuration_editor_generic_type_mapping_changed", {
        bubbles: true,
        composed: true,
        cancelable: false,
        detail: { typeName: "T", typeValue: target }
      })
    );
  }

  resolveGenericSObject() {
    if (this.isPicklistMode) return this._config.picklist.objectApiName || "";
    if (this.isSObjectMode) return this._config.sobject.sObjectApiName || "";
    if (this.isCollectionMode) {
      return (
        this._config.collection.objectApiName ||
        recordCollectionObjectType(this.builderContext, this._sourceRecordsRef)
      );
    }
    // Flow needs T resolved for the {T} outputs even though Custom options
    // have no object; Account exists in every org.
    if (this.hasDataSource) return "Account";
    return "";
  }

  dispatchCpeChange(name, newValue, newValueDataType) {
    this.dispatchEvent(
      new CustomEvent("configuration_editor_input_value_changed", {
        bubbles: true,
        composed: true,
        cancelable: false,
        detail: { name, newValue, newValueDataType }
      })
    );
  }
}
