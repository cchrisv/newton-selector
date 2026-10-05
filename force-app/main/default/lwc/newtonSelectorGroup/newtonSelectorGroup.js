import { LightningElement, api } from "lwc";
import template from "./newtonSelectorGroup.html";
import {
  filterItems,
  tokenToCss,
  MANUAL_INPUT_VALUE
} from "c/newtonSelectorUtilityDataSources";

const MODE_MULTI = "multi";

const VARIANT_LIST = "list";
const VARIANT_GRID = "grid";
const VARIANT_COLUMNS = "columns";
const VARIANT_DUAL_LISTBOX = "dualListbox";
const VARIANT_PICKLIST = "picklist";
const VARIANT_RADIO = "radio";

const DROPZONE_AVAILABLE = "available";
const DROPZONE_SELECTED = "selected";

// Group properties handed to every choice tile unchanged.
const TILE_STYLE_PROPS = [
  "size",
  "aspectRatio",
  "iconSize",
  "badgePosition",
  "badgeVariant",
  "badgeShape",
  "badgeVariantHex",
  "selectionIndicator",
  "elevation",
  "pattern",
  "patternTone",
  "patternHoverTone",
  "patternSelectedTone",
  "patternDisabledTone",
  "patternToneHex",
  "patternHoverToneHex",
  "patternSelectedToneHex",
  "patternDisabledToneHex",
  "cornerStyle",
  "cornerTone",
  "cornerToneHex",
  "surfaceStyle",
  "surfaceTone",
  "surfaceHoverTone",
  "surfaceSelectedTone",
  "surfaceDisabledTone",
  "surfaceToneHex",
  "surfaceHoverToneHex",
  "surfaceSelectedToneHex",
  "surfaceDisabledToneHex",
  "iconDecor",
  "iconStyle",
  "iconShading",
  "iconTone",
  "iconToneHex",
  "iconGlyphTone",
  "iconGlyphToneHex",
  "showIcons",
  "showBadges"
];

// Per-render derived lists, built once in render() and read by the getters.
const VIEWS = new WeakMap();

let GROUP_COUNTER = 0;

function valuesEqual(left, right) {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

export default class NewtonSelectorGroup extends LightningElement {
  @api items = [];
  @api variant = VARIANT_GRID;
  @api selectionMode = "single";
  @api minSelections = 0;
  @api maxSelections;
  @api showSelectAll = false;
  @api enableSearch = false;
  @api previewMode = false;

  // Layout knobs. Card styling lives in newtonSelectorChoiceTile; this group
  // only composes cards into layouts and converts SLDS spacing tokens.
  @api gridMinWidth = "7.5rem";
  @api gapHorizontal = "2";
  @api gapVertical = "2";
  @api marginTop = "";
  @api marginRight = "";
  @api marginBottom = "";
  @api marginLeft = "";
  // An empty padding token keeps the tile's size-based padding.
  @api paddingTop = "";
  @api paddingRight = "";
  @api paddingBottom = "";
  @api paddingLeft = "";
  // Fixed column count (1-6) for the grid layout; anything else auto-fills.
  @api columns;

  // Choice tile styling (see TILE_STYLE_PROPS).
  @api size = "small";
  @api iconSize = "auto";
  @api aspectRatio = "1:1";
  @api badgePosition = "bottom-inline";
  @api badgeVariant = "neutral";
  @api badgeShape = "pill";
  @api badgeVariantHex = "";
  @api selectionIndicator = "frame";
  @api elevation = "outlined";
  @api pattern = "none";
  @api patternTone = "neutral";
  @api patternHoverTone = "neutral";
  @api patternSelectedTone = "brand";
  @api patternDisabledTone = "neutral";
  @api patternToneHex = "";
  @api patternHoverToneHex = "";
  @api patternSelectedToneHex = "";
  @api patternDisabledToneHex = "";
  @api cornerStyle = "none";
  @api cornerTone = "neutral";
  @api cornerToneHex = "";
  @api surfaceStyle = "solid";
  @api surfaceTone = "neutral";
  @api surfaceHoverTone = "neutral";
  @api surfaceSelectedTone = "brand";
  @api surfaceDisabledTone = "neutral";
  @api surfaceToneHex = "";
  @api surfaceHoverToneHex = "";
  @api surfaceSelectedToneHex = "";
  @api surfaceDisabledToneHex = "";
  @api iconDecor = "square";
  @api iconStyle = "soft";
  @api iconShading = "flat";
  @api iconTone = "brand";
  @api iconToneHex = "";
  @api iconGlyphTone;
  @api iconGlyphToneHex = "";
  @api showIcons;
  @api showBadges;

  @api allowManualInput = false;
  @api manualInputLabel;
  @api manualInputMinLength = 0;
  @api manualInputMaxLength;

  _selectedValues = [];
  _noneActive = false;
  _manualInputValue = "";
  _searchTerm = "";
  _dragOverZone = "";
  _dualAvailableValues = [];
  _dualSelectedValues = [];
  _picklistOpen = false;
  _activeIndex = -1;
  _dragValue = "";
  _groupName = `newton-group-${++GROUP_COUNTER}`;

  @api
  get selectedValues() {
    return this._selectedValues;
  }
  set selectedValues(v) {
    this._selectedValues = Array.isArray(v) ? v : [];
  }

  // The None option's value is "", so "None picked" cannot be told apart from
  // "nothing picked" by value; this flag carries it both ways.
  @api
  get noneSelected() {
    return this._noneActive;
  }
  set noneSelected(v) {
    this._noneActive = Boolean(v);
  }

  @api
  get manualInputValue() {
    return this._manualInputValue;
  }
  set manualInputValue(v) {
    this._manualInputValue = v === undefined || v === null ? "" : String(v);
  }

  render() {
    VIEWS.set(this, this.buildView());
    return template;
  }

  buildView() {
    const tileProps = {
      variant: this.choiceTileVariant,
      selectionMode: this.selectionMode,
      groupName: this._groupName
    };
    TILE_STYLE_PROPS.forEach((name) => {
      tileProps[name] = this[name];
    });
    const selected = this.selectedValueSet;
    const maxReached = this.maxReached(this._selectedValues.length);

    if (this.isTransferLayout) {
      const availableActive = new Set(this._dualAvailableValues);
      const selectedActive = new Set(this._dualSelectedValues);
      return {
        tileProps,
        transferAvailableItems: this.filteredItems
          .filter((item) => !selected.has(item.value))
          .map((item) =>
            this.decorateCardItem(
              item,
              false,
              maxReached,
              availableActive.has(item.value)
            )
          ),
        transferSelectedItems: this.selectedItemsInOrder().map((item) =>
          this.decorateCardItem(
            item,
            true,
            false,
            selectedActive.has(item.value)
          )
        )
      };
    }

    const cards = this.filteredItems.map((item) =>
      this.decorateCardItem(item, selected.has(item.value), maxReached)
    );
    if (this.isRadio) {
      return {
        tileProps,
        radioItems: cards.map((item) => ({
          ...item,
          _radioClass: [
            "newton-radio-card",
            this.isMulti ? "newton-radio-card_multi" : "",
            item._selected ? "newton-radio-card_selected" : "",
            item._disabled ? "newton-radio-card_disabled" : ""
          ]
            .filter(Boolean)
            .join(" ")
        }))
      };
    }
    if (this.isPicklist) {
      return {
        tileProps,
        picklistItems: cards.map((item, index) => {
          const active = index === this._activeIndex;
          return {
            ...item,
            title: item.label,
            subtitle: item.sublabel || "",
            _optionId: `${this._groupName}-option-${index}`,
            _ariaSelected: String(item._selected),
            _ariaDisabled: String(item._disabled),
            _class: [
              "slds-listbox__item",
              "newton-picklist__item",
              item._selected ? "newton-picklist__item_selected" : ""
            ]
              .filter(Boolean)
              .join(" "),
            _optionClass: active
              ? "slds-listbox__option newton-picklist__option slds-has-focus"
              : "slds-listbox__option newton-picklist__option"
          };
        })
      };
    }
    return { tileProps, cards };
  }

  get view() {
    return VIEWS.get(this);
  }
  get tileProps() {
    return this.view.tileProps;
  }
  get cards() {
    return this.view.cards;
  }
  get radioItems() {
    return this.view.radioItems;
  }
  get picklistItems() {
    return this.view.picklistItems;
  }
  get transferAvailableItems() {
    return this.view.transferAvailableItems;
  }
  get transferSelectedItems() {
    return this.view.transferSelectedItems;
  }

  get isMulti() {
    return this.selectionMode === MODE_MULTI;
  }
  get isColumns() {
    return this.variant === VARIANT_COLUMNS;
  }
  get isDualListbox() {
    return this.variant === VARIANT_DUAL_LISTBOX;
  }
  get isPicklist() {
    return this.variant === VARIANT_PICKLIST;
  }
  get isRadio() {
    return this.variant === VARIANT_RADIO;
  }
  get isTransferLayout() {
    return this.isColumns || this.isDualListbox;
  }
  get isBasicCardLayout() {
    return !this.isTransferLayout && !this.isPicklist && !this.isRadio;
  }
  get showOuterSearch() {
    return this.enableSearch && !this.isPicklist && !this.isTransferLayout;
  }

  get filteredItems() {
    const base = Array.isArray(this.items) ? this.items : [];
    if (!this.enableSearch || !this._searchTerm) return base;
    return filterItems(base, this._searchTerm);
  }

  get selectedValueSet() {
    return new Set(this._noneActive ? [""] : this._selectedValues);
  }

  get hasFilteredItems() {
    return this.filteredItems.length > 0;
  }

  get hasAvailableItems() {
    return this.transferAvailableItems.length > 0;
  }

  get hasSelectedItems() {
    return this.transferSelectedItems.length > 0;
  }

  get availableCountLabel() {
    return `${this.transferAvailableItems.length} available`;
  }

  get selectedCountLabel() {
    return `${this.transferSelectedItems.length} selected`;
  }

  get availablePanelLabel() {
    return this.isColumns ? "Available cards" : "Available";
  }

  get selectedPanelLabel() {
    return this.isColumns ? "Selected cards" : "Chosen";
  }

  get availablePanelAriaLabel() {
    return this.isColumns ? "Available card column" : "Available options";
  }

  get selectedPanelAriaLabel() {
    return this.isColumns ? "Selected card column" : "Chosen options";
  }

  get availableLabelId() {
    return `${this._groupName}-available-label`;
  }

  get selectedLabelId() {
    return `${this._groupName}-selected-label`;
  }

  get availableEmptyMessage() {
    return this.isColumns ? "No available cards." : "No available options.";
  }

  get selectedEmptyMessage() {
    return this.isColumns ? "Drop selected cards here." : "Move choices here.";
  }

  decorateCardItem(item, isSelected, maxReached, active = false) {
    const isNone = item.value === "";
    const isManual = item.value === MANUAL_INPUT_VALUE;
    const disabled =
      Boolean(item.disabled) || (!isNone && maxReached && !isSelected);
    return {
      ...item,
      _selected: isSelected,
      _disabled: disabled,
      _draggable: this.isColumns && !disabled && !isNone && !isManual,
      _class: [
        "newton-transfer__item",
        active ? "newton-transfer__item_active" : "",
        disabled ? "newton-transfer__item_disabled" : "",
        this.isColumns ? "newton-transfer__item_draggable" : ""
      ]
        .filter(Boolean)
        .join(" ")
    };
  }

  maxReached(selectedCount) {
    return (
      this.isMulti &&
      this.hasMaxSelections &&
      selectedCount >= Number(this.maxSelections)
    );
  }

  get hasMaxSelections() {
    return (
      this.maxSelections !== undefined &&
      this.maxSelections !== null &&
      this.maxSelections !== ""
    );
  }

  get showToolbar() {
    return (
      this.isMulti &&
      this.showSelectAll &&
      this.filteredItems.length > 0 &&
      !this.previewMode
    );
  }

  get groupRole() {
    return this.isMulti ? "group" : "radiogroup";
  }

  get groupClass() {
    return `newton-group newton-group_${this.variant}`;
  }

  get transferClass() {
    return [
      "newton-transfer",
      `newton-transfer_${this.variant}`,
      this.isDualListbox ? "newton-transfer_has-controls" : ""
    ]
      .filter(Boolean)
      .join(" ");
  }

  get availablePanelClass() {
    return this.transferPanelClass(DROPZONE_AVAILABLE);
  }

  get selectedPanelClass() {
    return this.transferPanelClass(DROPZONE_SELECTED);
  }

  transferPanelClass(zone) {
    return this._dragOverZone === zone
      ? "newton-transfer__panel newton-transfer__panel_drop"
      : "newton-transfer__panel";
  }

  get groupStyle() {
    const parts = [
      `--newton-group-min-w: ${this.gridMinWidth}`,
      `--newton-group-gap-x: ${tokenToCss(this.gapHorizontal)}`,
      `--newton-group-gap-y: ${tokenToCss(this.gapVertical)}`,
      `--newton-group-margin-t: ${tokenToCss(this.marginTop)}`,
      `--newton-group-margin-r: ${tokenToCss(this.marginRight)}`,
      `--newton-group-margin-b: ${tokenToCss(this.marginBottom)}`,
      `--newton-group-margin-l: ${tokenToCss(this.marginLeft)}`
    ];
    if (this.paddingTop) {
      parts.push(`--newton-tile-pad-t: ${tokenToCss(this.paddingTop)}`);
    }
    if (this.paddingRight) {
      parts.push(`--newton-tile-pad-r: ${tokenToCss(this.paddingRight)}`);
    }
    if (this.paddingBottom) {
      parts.push(`--newton-tile-pad-b: ${tokenToCss(this.paddingBottom)}`);
    }
    if (this.paddingLeft) {
      parts.push(`--newton-tile-pad-l: ${tokenToCss(this.paddingLeft)}`);
    }
    const cols = Number(this.columns);
    if (Number.isInteger(cols) && cols >= 1 && cols <= 6) {
      parts.push(`--newton-group-cols: ${cols}`);
    }
    return parts.join("; ");
  }

  get isEmpty() {
    return !this.previewMode && !this.hasFilteredItems;
  }

  get choiceTileVariant() {
    return this.variant === VARIANT_GRID || this.variant === "horizontal"
      ? VARIANT_GRID
      : VARIANT_LIST;
  }

  // --- Picklist (SLDS combobox, listbox with aria-activedescendant) ---

  get selectedPicklistItem() {
    const current = this._noneActive ? "" : this._selectedValues[0];
    return this.findItem(current) || null;
  }

  get isPicklistSingle() {
    return this.isPicklist && !this.isMulti;
  }

  get selectedPicklistIcon() {
    return this.isPicklistSingle ? this.selectedPicklistItem?.icon || "" : "";
  }

  get picklistAriaMultiselectable() {
    return String(this.isMulti);
  }

  get picklistSelectionLabel() {
    const labels = this.selectedItemsInOrder()
      .map((item) => item.label)
      .filter(Boolean);
    const visible = labels.slice(0, 2).join(", ");
    const extra = labels.length - 2;
    return extra > 0 ? `${visible} +${extra} more` : visible;
  }

  get picklistClass() {
    return this._picklistOpen
      ? "newton-picklist newton-picklist_open"
      : "newton-picklist";
  }

  get picklistComboboxClass() {
    const base =
      "slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click";
    return this._picklistOpen ? `${base} slds-is-open` : base;
  }

  get picklistInputContainerClass() {
    const base = "slds-combobox__form-element slds-input-has-icon";
    return this.selectedPicklistIcon
      ? `${base} slds-input-has-icon_left-right`
      : `${base} slds-input-has-icon_right`;
  }

  get picklistInputClass() {
    const base = "slds-input_faux slds-combobox__input newton-picklist__button";
    return this.selectedPicklistIcon
      ? `${base} slds-combobox__input-value`
      : base;
  }

  get picklistListboxId() {
    return `${this._groupName}-picklist-listbox`;
  }

  get picklistControls() {
    return this._picklistOpen ? this.picklistListboxId : null;
  }

  get picklistActiveDescendant() {
    if (!this._picklistOpen) return null;
    return this.picklistItems[this._activeIndex]?._optionId || null;
  }

  get picklistInputValue() {
    if (this.isPicklistSingle) return this.selectedPicklistItem?.label || "";
    return this.picklistSelectionLabel;
  }

  get picklistButtonLabel() {
    return this.picklistInputValue || this.picklistPlaceholder;
  }

  get picklistInputTitle() {
    if (this.isPicklistSingle) {
      const item = this.selectedPicklistItem;
      return [item?.label, item?.sublabel].filter(Boolean).join(" - ");
    }
    return this.picklistInputValue;
  }

  get picklistAriaLabel() {
    return this.picklistInputTitle || this.picklistPlaceholder;
  }

  get picklistExpanded() {
    return String(this._picklistOpen);
  }

  get picklistChevron() {
    return this._picklistOpen ? "chevron-up" : "chevron-down";
  }

  get picklistPlaceholder() {
    return "Choose an option";
  }

  get showManualInput() {
    return this._selectedValues.includes(MANUAL_INPUT_VALUE);
  }

  get manualInputHelpText() {
    const min = Number(this.manualInputMinLength || 0);
    const max = this.manualInputMaxLength;
    if (min > 0 && max) return `${min}-${max} characters`;
    if (min > 0) return `At least ${min} characters`;
    if (max) return `Up to ${max} characters`;
    return "";
  }

  get dualAddDisabled() {
    return this._dualAvailableValues.length === 0;
  }

  get dualRemoveDisabled() {
    return this._dualSelectedValues.length === 0;
  }

  get dualAddAllDisabled() {
    return !this.isMulti || !this.hasAvailableItems;
  }

  get dualRemoveAllDisabled() {
    return !this.hasSelectedItems;
  }

  handleSearch(event) {
    this._searchTerm = event.target.value || "";
    this._activeIndex = this._picklistOpen ? 0 : -1;
  }

  handleManualInput(event) {
    this._manualInputValue = event.target.value || "";
    if (!this.previewMode) this.fireChange();
  }

  handleCardSelect(event) {
    const value = event.detail?.value;
    if (value === undefined || value === null) return;

    const changed = this.isMulti
      ? this.toggleMulti(value)
      : this.selectSingle(value);
    if (changed && !this.previewMode) this.fireChange();
  }

  handleAvailableCardSelect(event) {
    event.stopPropagation();
    const value = event.detail?.value;
    if (value === undefined || value === null) return;
    if (this.isDualListbox) {
      this.toggleDualBuffer("_dualAvailableValues", value);
      this._dualSelectedValues = [];
      return;
    }
    const changed = this.addValue(value);
    if (changed && !this.previewMode) this.fireChange();
  }

  handleSelectedCardSelect(event) {
    event.stopPropagation();
    const value = event.detail?.value;
    if (value === undefined || value === null) return;
    if (this.isDualListbox) {
      this.toggleDualBuffer("_dualSelectedValues", value);
      this._dualAvailableValues = [];
      return;
    }
    const changed = this.removeValue(value);
    if (changed && !this.previewMode) this.fireChange();
  }

  handlePicklistToggle() {
    if (this._picklistOpen) {
      this.closePicklist();
    } else {
      this.openPicklist(false);
    }
  }

  // Focus stays on the trigger (or the search field); arrow keys move the
  // active option, announced through aria-activedescendant.
  handlePicklistKeydown(event) {
    const { key } = event;
    const inSearch = event.currentTarget.type === "search";
    if (key === "Escape") {
      if (this._picklistOpen) {
        event.stopPropagation();
        this.closePicklist();
      }
      return;
    }
    if (!this._picklistOpen) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(key)) {
        event.preventDefault();
        this.openPicklist(key === "ArrowUp");
      }
      return;
    }
    const last = this.picklistItems.length - 1;
    if (key === "ArrowDown") {
      this._activeIndex = Math.min(this._activeIndex + 1, last);
    } else if (key === "ArrowUp") {
      this._activeIndex = Math.max(this._activeIndex - 1, 0);
    } else if (key === "Home" && !inSearch) {
      this._activeIndex = 0;
    } else if (key === "End" && !inSearch) {
      this._activeIndex = last;
    } else if (key === "Enter" || (key === " " && !inSearch)) {
      const item = this.picklistItems[this._activeIndex];
      if (item) this.applyPicklistValue(item.value);
    } else {
      return;
    }
    event.preventDefault();
  }

  handlePicklistFocusOut(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      this.closePicklist();
    }
  }

  // Keeps focus on the trigger while an option is clicked.
  handlePicklistOptionMouseDown(event) {
    event.preventDefault();
  }

  handlePicklistOptionSelect(event) {
    this.applyPicklistValue(event.currentTarget.dataset.value);
  }

  openPicklist(fromEnd) {
    const items = this.picklistItems;
    const selectedIndex = items.findIndex((item) => item._selected);
    this._picklistOpen = true;
    if (selectedIndex >= 0) {
      this._activeIndex = selectedIndex;
    } else {
      this._activeIndex = fromEnd ? items.length - 1 : 0;
    }
  }

  closePicklist() {
    this._picklistOpen = false;
    this._activeIndex = -1;
  }

  applyPicklistValue(value) {
    const item = this.findItem(value);
    if (!item || item.disabled) return;
    const changed = this.isMulti
      ? this.toggleMulti(value)
      : this.selectSingle(value);
    if (!this.isMulti) this.closePicklist();
    if (changed && !this.previewMode) this.fireChange();
  }

  toggleDualBuffer(property, value) {
    const item = this.findItem(value);
    if (!item || item.disabled) return;
    const current = new Set(this[property]);
    if (current.has(value)) {
      current.delete(value);
    } else {
      current.add(value);
    }
    this[property] = [...current];
  }

  handleDualAdd() {
    const changed = this.addValues(this._dualAvailableValues);
    this._dualAvailableValues = [];
    if (changed && !this.previewMode) this.fireChange();
  }

  handleDualRemove() {
    const changed = this.removeValues(this._dualSelectedValues);
    this._dualSelectedValues = [];
    if (changed && !this.previewMode) this.fireChange();
  }

  handleDualAddAll() {
    const values = this.transferAvailableItems
      .filter(
        (item) =>
          !item._disabled &&
          item.value !== "" &&
          item.value !== MANUAL_INPUT_VALUE
      )
      .map((item) => item.value);
    const changed = this.addValues(values);
    this._dualAvailableValues = [];
    if (changed && !this.previewMode) this.fireChange();
  }

  handleDualRemoveAll() {
    const changed = this.removeValues([...this._selectedValues]);
    this._dualSelectedValues = [];
    if (changed && !this.previewMode) this.fireChange();
  }

  toggleMulti(value) {
    if (this.isSelected(value)) {
      return this.removeValue(value);
    }
    return this.addValue(value);
  }

  // The None option's value is "". Picking it clears the selection (the
  // emitted values stay []) and marks None as the active choice.
  addValue(value) {
    if (value === "") {
      const changed = !this._noneActive || this._selectedValues.length > 0;
      this._selectedValues = [];
      this._noneActive = true;
      return changed;
    }
    if (value === MANUAL_INPUT_VALUE) {
      if (!this.isMulti) {
        return this.setSelectedValues([MANUAL_INPUT_VALUE]);
      }
      if (
        this.hasMaxSelections &&
        this._selectedValues.length >= Number(this.maxSelections)
      ) {
        return false;
      }
      return this.setSelectedValues([...this._selectedValues, value]);
    }
    const item = this.findItem(value);
    if (!item || item.disabled || this.isSelected(value)) return false;
    if (!this.isMulti) {
      return this.setSelectedValues([value]);
    }
    if (
      this.hasMaxSelections &&
      this._selectedValues.length >= Number(this.maxSelections)
    ) {
      return false;
    }
    return this.setSelectedValues([...this._selectedValues, value]);
  }

  selectSingle(value) {
    return value === "" ? this.addValue("") : this.setSelectedValues([value]);
  }

  addValues(values) {
    if (values.includes("")) {
      return this.addValue("");
    }
    return values.reduce(
      (changed, value) => this.addValue(value) || changed,
      false
    );
  }

  removeValue(value) {
    const item = this.findItem(value);
    if (!this.isSelected(value) || item?.disabled) return false;
    return this.setSelectedValues(
      this._selectedValues.filter((current) => current !== value)
    );
  }

  removeValues(values) {
    return values.reduce(
      (changed, value) => this.removeValue(value) || changed,
      false
    );
  }

  setSelectedValues(values) {
    if (valuesEqual(this._selectedValues, values)) return false;
    this._selectedValues = [...values];
    if (values.length > 0) this._noneActive = false;
    return true;
  }

  isSelected(value) {
    return this._selectedValues.includes(value);
  }

  findItem(value) {
    const source = Array.isArray(this.items) ? this.items : [];
    return source.find((item) => item.value === value);
  }

  handleDragStart(event) {
    const value = event.currentTarget?.dataset?.value;
    if (!value || !this.isColumns) return;
    this._dragValue = value;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", value);
    }
  }

  handleDragOver(event) {
    if (!this.isColumns) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
    this._dragOverZone = event.currentTarget?.dataset?.zone || "";
  }

  handleDragLeave(event) {
    if (event.currentTarget?.contains(event.relatedTarget)) return;
    this._dragOverZone = "";
  }

  handleDrop(event) {
    if (!this.isColumns) return;
    event.preventDefault();
    const zone = event.currentTarget?.dataset?.zone;
    const value =
      event.dataTransfer?.getData("text/plain") || this._dragValue || "";
    this._dragValue = "";
    this._dragOverZone = "";
    if (!value) return;

    const changed =
      zone === DROPZONE_SELECTED
        ? this.addValue(value)
        : zone === DROPZONE_AVAILABLE
          ? this.removeValue(value)
          : false;
    if (changed && !this.previewMode) this.fireChange();
  }

  handleSelectAll() {
    const allValues = this.filteredItems
      .filter(
        (item) =>
          !item.disabled &&
          item.value !== "" &&
          item.value !== MANUAL_INPUT_VALUE
      )
      .map((item) => item.value);
    const nextValues = this.hasMaxSelections
      ? allValues.slice(0, Number(this.maxSelections))
      : allValues;
    const changed = this.setSelectedValues(nextValues);
    this._dualAvailableValues = [];
    this._dualSelectedValues = [];
    if (changed && !this.previewMode) this.fireChange();
  }

  handleClearAll() {
    const changed = this.setSelectedValues([]);
    this._dualAvailableValues = [];
    this._dualSelectedValues = [];
    if (changed && !this.previewMode) this.fireChange();
  }

  selectedItemsInOrder() {
    const source = Array.isArray(this.items) ? this.items : [];
    const byValue = new Map(source.map((item) => [item.value, item]));
    return this._selectedValues
      .map((value) => byValue.get(value))
      .filter(Boolean);
  }

  fireChange() {
    this.dispatchEvent(
      new CustomEvent("selectionchange", {
        detail: {
          values: [...this._selectedValues],
          items: this.selectedItemsInOrder(),
          noneSelected: this._noneActive,
          manualValue: this._manualInputValue
        },
        bubbles: true,
        composed: false
      })
    );
  }
}
