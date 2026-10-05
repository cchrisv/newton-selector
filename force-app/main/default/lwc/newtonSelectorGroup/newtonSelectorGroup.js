import { LightningElement, api } from "lwc";
import template from "./newtonSelectorGroup.html";
import search from "@salesforce/label/c.Newton_Selector_Search";
import filterItemsLabel from "@salesforce/label/c.Newton_Selector_FilterItems";
import selectAll from "@salesforce/label/c.Newton_Selector_SelectAll";
import clearAll from "@salesforce/label/c.Newton_Selector_ClearAll";
import noItems from "@salesforce/label/c.Newton_Selector_NoItems";
import searchOptions from "@salesforce/label/c.Newton_Selector_SearchOptions";
import filterPicklistOptions from "@salesforce/label/c.Newton_Selector_FilterPicklistOptions";
import noOptionsToDisplay from "@salesforce/label/c.Newton_Selector_NoOptionsToDisplay";
import filterAvailable from "@salesforce/label/c.Newton_Selector_FilterAvailable";
import filterAvailableOptions from "@salesforce/label/c.Newton_Selector_FilterAvailableOptions";
import moveOptions from "@salesforce/label/c.Newton_Selector_MoveOptions";
import moveSelectedToChosen from "@salesforce/label/c.Newton_Selector_MoveSelectedToChosen";
import moveAllToChosen from "@salesforce/label/c.Newton_Selector_MoveAllToChosen";
import removeSelected from "@salesforce/label/c.Newton_Selector_RemoveSelected";
import removeAll from "@salesforce/label/c.Newton_Selector_RemoveAll";
import availableCountFormat from "@salesforce/label/c.Newton_Selector_AvailableCount";
import selectedCountFormat from "@salesforce/label/c.Newton_Selector_SelectedCount";
import availableCards from "@salesforce/label/c.Newton_Selector_AvailableCards";
import available from "@salesforce/label/c.Newton_Selector_Available";
import selectedCards from "@salesforce/label/c.Newton_Selector_SelectedCards";
import chosen from "@salesforce/label/c.Newton_Selector_Chosen";
import availableCardColumn from "@salesforce/label/c.Newton_Selector_AvailableCardColumn";
import availableOptions from "@salesforce/label/c.Newton_Selector_AvailableOptions";
import selectedCardColumn from "@salesforce/label/c.Newton_Selector_SelectedCardColumn";
import chosenOptions from "@salesforce/label/c.Newton_Selector_ChosenOptions";
import noAvailableCards from "@salesforce/label/c.Newton_Selector_NoAvailableCards";
import noAvailableOptions from "@salesforce/label/c.Newton_Selector_NoAvailableOptions";
import dropSelectedCardsHere from "@salesforce/label/c.Newton_Selector_DropSelectedCardsHere";
import moveChoicesHere from "@salesforce/label/c.Newton_Selector_MoveChoicesHere";
import movedTo from "@salesforce/label/c.Newton_Selector_MovedTo";
import moreSelected from "@salesforce/label/c.Newton_Selector_MoreSelected";
import chooseAnOption from "@salesforce/label/c.Newton_Selector_ChooseAnOption";
import characterRange from "@salesforce/label/c.Newton_Selector_CharacterRange";
import manualInputMin from "@salesforce/label/c.Newton_Selector_ManualInputMin";
import manualInputMax from "@salesforce/label/c.Newton_Selector_ManualInputMax";
import {
  filterItems,
  formatLabel,
  tokenToCss,
  MANUAL_INPUT_VALUE
} from "c/newtonSelectorUtilityDataSources";

// Labels the template renders as-is.
const LABELS = {
  search,
  filterItems: filterItemsLabel,
  selectAll,
  clearAll,
  noItems,
  searchOptions,
  filterPicklistOptions,
  noOptionsToDisplay,
  filterAvailable,
  filterAvailableOptions,
  moveOptions,
  moveSelectedToChosen,
  moveAllToChosen,
  removeSelected,
  removeAll,
  availableOptions,
  chosenOptions
};

const MODE_MULTI = "multi";

const VARIANT_LIST = "list";
const VARIANT_GRID = "grid";
const VARIANT_COLUMNS = "columns";
const VARIANT_DUAL_LISTBOX = "dualListbox";
const VARIANT_PICKLIST = "picklist";
const VARIANT_RADIO = "radio";

const DROPZONE_AVAILABLE = "available";
const DROPZONE_SELECTED = "selected";

const MAX_FIXED_COLUMNS = 6;

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
  @api maxSelections;
  @api showSelectAll = false;
  @api enableSearch = false;
  @api previewMode = false;
  // The selector's question label. It names the Dropdown combobox, because
  // the visible legend lives in the parent's shadow tree.
  @api fieldLabel;

  // Layout knobs. Card styling lives in newtonSelectorChoiceTile; this group
  // only composes cards into layouts and converts SLDS spacing tokens. The
  // data selector always supplies every layout and tile property.
  @api gridMinWidth;
  @api gapHorizontal;
  @api gapVertical;
  @api marginTop;
  @api marginRight;
  @api marginBottom;
  @api marginLeft;
  // An empty padding token keeps the tile's size-based padding.
  @api paddingTop;
  @api paddingRight;
  @api paddingBottom;
  @api paddingLeft;
  // Fixed column count (1-6) for the grid layout; anything else auto-fills.
  @api columns;

  // Choice tile styling (see TILE_STYLE_PROPS).
  @api size;
  @api iconSize;
  @api aspectRatio;
  @api badgePosition;
  @api badgeVariant;
  @api badgeShape;
  @api badgeVariantHex;
  @api selectionIndicator;
  @api elevation;
  @api pattern;
  @api patternTone;
  @api patternHoverTone;
  @api patternSelectedTone;
  @api patternDisabledTone;
  @api patternToneHex;
  @api patternHoverToneHex;
  @api patternSelectedToneHex;
  @api patternDisabledToneHex;
  @api cornerStyle;
  @api cornerTone;
  @api cornerToneHex;
  @api surfaceStyle;
  @api surfaceTone;
  @api surfaceHoverTone;
  @api surfaceSelectedTone;
  @api surfaceDisabledTone;
  @api surfaceToneHex;
  @api surfaceHoverToneHex;
  @api surfaceSelectedToneHex;
  @api surfaceDisabledToneHex;
  @api iconDecor;
  @api iconStyle;
  @api iconShading;
  @api iconTone;
  @api iconToneHex;
  @api iconGlyphTone;
  @api iconGlyphToneHex;
  @api showIcons;
  @api showBadges;

  @api manualInputLabel;
  @api manualInputMinLength = 0;
  @api manualInputMaxLength;

  _selectedValues = [];
  _noneActive = false;
  _manualInputValue = "";
  _searchTerm = "";
  _dragOverZone = "";
  // Dual listbox: the rows highlighted for the next move, the row holding
  // each panel's Tab stop, the row a Shift-click or Shift-arrow extends the
  // highlight from, the row to focus after a move, and the move announcement.
  _dualAvailableValues = [];
  _dualSelectedValues = [];
  _dualAvailableFocus = null;
  _dualSelectedFocus = null;
  _dualAnchor = null;
  _dualPendingFocus = null;
  _dualAnnouncement = "";
  _picklistOpen = false;
  _activeIndex = -1;
  // The Dropdown option last scrolled into view, so a render scrolls only
  // when the active option changes.
  _scrolledIndex = -1;
  _groupName = `newton-group-${++GROUP_COUNTER}`;
  labels = LABELS;

  @api
  get selectedValues() {
    return this._selectedValues;
  }
  set selectedValues(v) {
    this._selectedValues = v;
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
    this._manualInputValue = v;
  }

  render() {
    VIEWS.set(this, this.buildView());
    return template;
  }

  renderedCallback() {
    if (this._picklistOpen && this._activeIndex !== this._scrolledIndex) {
      this._scrolledIndex = this._activeIndex;
      this.template
        .querySelector(".newton-picklist__option_active")
        ?.scrollIntoView({ block: "nearest" });
    }
    if (!this._dualPendingFocus) return;
    const { zone, value } = this._dualPendingFocus;
    this._dualPendingFocus = null;
    // The moved row is missing when the Available search hides it.
    [...this.template.querySelectorAll(`[role="option"][data-zone="${zone}"]`)]
      .find((row) => row.dataset.value === value)
      ?.focus();
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
      const availableRows = this.filteredItems
        .filter((item) => !selected.has(item.value))
        .map((item) => this.decorateCardItem(item, false, maxReached));
      const selectedRows = this.selectedItemsInOrder().map((item) =>
        this.decorateCardItem(item, true, false)
      );
      if (!this.isDualListbox) {
        return {
          tileProps,
          transferAvailableItems: availableRows,
          transferSelectedItems: selectedRows
        };
      }
      return {
        tileProps,
        transferAvailableItems: this.decorateDualRows(
          availableRows,
          this._dualAvailableValues,
          this._dualAvailableFocus
        ),
        transferSelectedItems: this.decorateDualRows(
          selectedRows,
          this._dualSelectedValues,
          this._dualSelectedFocus
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
        picklistItems: cards.map((item, index) => ({
          ...item,
          _optionId: `${this._groupName}-option-${index}`,
          _ariaSelected: String(item._selected),
          _ariaDisabled: String(item._disabled),
          _optionClass:
            index === this._activeIndex
              ? "newton-picklist__option newton-picklist__option_active"
              : "newton-picklist__option"
        }))
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
    if (!this.enableSearch || !this._searchTerm) return this.items;
    return filterItems(this.items, this._searchTerm);
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
    return formatLabel(
      availableCountFormat,
      this.transferAvailableItems.length
    );
  }

  get selectedCountLabel() {
    return formatLabel(selectedCountFormat, this.transferSelectedItems.length);
  }

  get availablePanelLabel() {
    return this.isColumns ? availableCards : available;
  }

  get selectedPanelLabel() {
    return this.isColumns ? selectedCards : chosen;
  }

  // Only Columns names its panels: in the Dual listbox the listbox inside
  // carries the name, so a named panel would repeat it as a second landmark.
  get availablePanelAriaLabel() {
    return this.isColumns ? availableCardColumn : null;
  }

  get selectedPanelAriaLabel() {
    return this.isColumns ? selectedCardColumn : null;
  }

  get availableLabelId() {
    return `${this._groupName}-available-label`;
  }

  get selectedLabelId() {
    return `${this._groupName}-selected-label`;
  }

  get availableEmptyMessage() {
    return this.isColumns ? noAvailableCards : noAvailableOptions;
  }

  get selectedEmptyMessage() {
    return this.isColumns ? dropSelectedCardsHere : moveChoicesHere;
  }

  decorateCardItem(item, isSelected, maxReached) {
    const isNone = item.value === "";
    const disabled = !isNone && maxReached && !isSelected;
    return {
      ...item,
      _selected: isSelected,
      _disabled: disabled,
      _draggable:
        this.isColumns &&
        !disabled &&
        !isNone &&
        item.value !== MANUAL_INPUT_VALUE
    };
  }

  // A Dual listbox row is an option whose tile shows the "highlighted for
  // move" state. One row per panel holds the Tab stop.
  decorateDualRows(rows, highlighted, focusValue) {
    const marked = new Set(highlighted);
    const tabStop = rows.some((row) => row.value === focusValue)
      ? focusValue
      : rows[0]?.value;
    return rows.map((row) => ({
      ...row,
      _selected: marked.has(row.value),
      _ariaSelected: String(marked.has(row.value)),
      _ariaDisabled: String(row._disabled),
      _tabindex: row.value === tabStop ? "0" : "-1"
    }));
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

  get fixedColumns() {
    const cols = Number(this.columns);
    return Number.isInteger(cols) && cols >= 1 && cols <= MAX_FIXED_COLUMNS
      ? cols
      : null;
  }

  get groupClass() {
    const base = `newton-group newton-group_${this.variant}`;
    return this.fixedColumns ? `${base} newton-group_fixed-cols` : base;
  }

  get transferClass() {
    return this.isDualListbox
      ? "slds-dueling-list newton-transfer newton-transfer_dualListbox newton-transfer_has-controls"
      : `newton-transfer newton-transfer_${this.variant}`;
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
    if (this.fixedColumns) {
      parts.push(`--newton-group-cols: ${this.fixedColumns}`);
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
    return this.isPicklistSingle && this.showIcons !== false
      ? this.selectedPicklistItem?.icon || ""
      : "";
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
    return extra > 0 ? formatLabel(moreSelected, visible, extra) : visible;
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

  // A combobox takes no name from its content, so the current value names it
  // only when the selector has no label.
  get picklistAriaLabel() {
    return (
      this.fieldLabel || this.picklistInputTitle || this.picklistPlaceholder
    );
  }

  get picklistExpanded() {
    return String(this._picklistOpen);
  }

  get picklistChevron() {
    return this._picklistOpen ? "chevron-up" : "chevron-down";
  }

  get picklistPlaceholder() {
    return chooseAnOption;
  }

  get showManualInput() {
    return this._selectedValues.includes(MANUAL_INPUT_VALUE);
  }

  get manualInputHelpText() {
    const min = Number(this.manualInputMinLength || 0);
    const max = this.manualInputMaxLength;
    if (min > 0 && max) return formatLabel(characterRange, min, max);
    if (min > 0) return formatLabel(manualInputMin, min);
    if (max) return formatLabel(manualInputMax, max);
    return "";
  }

  get manualInputDescribedBy() {
    return this.manualInputHelpText ? "manual-input-help" : null;
  }

  // --- Dual listbox (SLDS dueling picklist) ---

  get dualMultiselectable() {
    return String(this.isMulti);
  }

  get isAvailableEmpty() {
    return !this.hasAvailableItems;
  }

  get isSelectedEmpty() {
    return !this.hasSelectedItems;
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
    const { value, fromArrowKey } = event.detail;
    const changed = this.isMulti
      ? this.toggleMulti(value)
      : this.selectSingle(value);
    if (changed && !this.previewMode) this.fireChange(fromArrowKey);
  }

  // A click on the selected tile (single mode) re-sends the selection, so
  // auto-advance can act on a default or on a pick made before Back.
  handleCardRepick() {
    if (!this.previewMode) this.fireChange();
  }

  handleAvailableCardSelect(event) {
    event.stopPropagation();
    const { value, fromArrowKey } = event.detail;
    const changed = this.addValue(value);
    if (changed && !this.previewMode) this.fireChange(fromArrowKey);
  }

  handleSelectedCardSelect(event) {
    event.stopPropagation();
    const { value, fromArrowKey } = event.detail;
    const changed = this.removeValue(value);
    if (changed && !this.previewMode) this.fireChange(fromArrowKey);
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
        this.refs.trigger.focus();
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

  // Keeps focus on the trigger or search field while an option is clicked.
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
    this._scrolledIndex = -1;
  }

  applyPicklistValue(value) {
    const changed = this.isMulti
      ? this.toggleMulti(value)
      : this.pickSingle(value);
    if (!this.isMulti) {
      this.closePicklist();
      this.refs.trigger.focus();
    }
    if (changed && !this.previewMode) this.fireChange();
  }

  // Click toggles a row's highlight; Shift-click extends it from the anchor.
  handleDualOptionClick(event) {
    const { zone, value } = event.currentTarget.dataset;
    this.setDualFocus(zone, value);
    if (event.shiftKey && this.isMulti) {
      this.extendDualHighlight(zone, value);
    } else {
      this.toggleDualHighlight(zone, value);
    }
  }

  // Arrow keys, Home and End move focus; Shift extends the highlight to the
  // focused row; Space toggles the focused row.
  handleDualKeydown(event) {
    const { key } = event;
    const zone = event.currentTarget.dataset.zone;
    const rows = this.dualRows(zone);
    const index = rows.findIndex(
      (row) => row.value === event.target.dataset.value
    );
    if (index < 0) return;
    if (key === " ") {
      event.preventDefault();
      this.toggleDualHighlight(zone, rows[index].value);
      return;
    }
    let next;
    if (key === "ArrowDown") {
      next = Math.min(index + 1, rows.length - 1);
    } else if (key === "ArrowUp") {
      next = Math.max(index - 1, 0);
    } else if (key === "Home") {
      next = 0;
    } else if (key === "End") {
      next = rows.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    const { value } = rows[next];
    this.setDualFocus(zone, value);
    event.currentTarget.querySelectorAll('[role="option"]')[next].focus();
    if (event.shiftKey && this.isMulti) this.extendDualHighlight(zone, value);
  }

  dualRows(zone) {
    return zone === DROPZONE_AVAILABLE
      ? this.transferAvailableItems
      : this.transferSelectedItems;
  }

  setDualFocus(zone, value) {
    if (zone === DROPZONE_AVAILABLE) {
      this._dualAvailableFocus = value;
    } else {
      this._dualSelectedFocus = value;
    }
  }

  // Highlighting rows in one panel clears the other panel's highlight.
  setDualHighlight(zone, values) {
    if (zone === DROPZONE_AVAILABLE) {
      this._dualAvailableValues = values;
      this._dualSelectedValues = [];
    } else {
      this._dualSelectedValues = values;
      this._dualAvailableValues = [];
    }
  }

  // A single-select Dual listbox highlights one row at a time.
  toggleDualHighlight(zone, value) {
    const row = this.dualRows(zone).find((item) => item.value === value);
    if (row._disabled) return;
    const current =
      zone === DROPZONE_AVAILABLE
        ? this._dualAvailableValues
        : this._dualSelectedValues;
    const marked = current.includes(value);
    let next;
    if (!this.isMulti) {
      next = marked ? [] : [value];
    } else {
      next = marked
        ? current.filter((item) => item !== value)
        : [...current, value];
    }
    this._dualAnchor = value;
    this.setDualHighlight(zone, next);
  }

  extendDualHighlight(zone, value) {
    const rows = this.dualRows(zone);
    const to = rows.findIndex((row) => row.value === value);
    const anchor = rows.findIndex((row) => row.value === this._dualAnchor);
    const from = anchor < 0 ? to : anchor;
    if (anchor < 0) this._dualAnchor = value;
    this.setDualHighlight(
      zone,
      rows
        .slice(Math.min(from, to), Math.max(from, to) + 1)
        .filter((row) => !row._disabled)
        .map((row) => row.value)
    );
  }

  handleDualAdd() {
    this.moveDual(this._dualAvailableValues, true);
  }

  handleDualRemove() {
    this.moveDual(this._dualSelectedValues, false);
  }

  handleDualAddAll() {
    this.moveDual(
      this.transferAvailableItems
        .filter(
          (item) =>
            !item._disabled &&
            item.value !== "" &&
            item.value !== MANUAL_INPUT_VALUE
        )
        .map((item) => item.value),
      true
    );
  }

  handleDualRemoveAll() {
    this.moveDual(
      this.transferSelectedItems.map((item) => item.value),
      false
    );
  }

  // Moves rows between the panels, announces what moved and puts focus on
  // the first moved row in its new panel.
  moveDual(values, toChosen) {
    const changed = toChosen
      ? this.addValues(values)
      : this.removeValues(values);
    this._dualAvailableValues = [];
    this._dualSelectedValues = [];
    const selected = this.selectedValueSet;
    const moved = values.filter((value) => selected.has(value) === toChosen);
    if (moved.length) {
      const zone = toChosen ? DROPZONE_SELECTED : DROPZONE_AVAILABLE;
      this._dualAnnouncement = formatLabel(
        movedTo,
        moved.map((value) => this.findItem(value).label).join(", "),
        toChosen ? chosenOptions : availableOptions
      );
      this.setDualFocus(zone, moved[0]);
      this._dualPendingFocus = { zone, value: moved[0] };
    }
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
    if (!this.findItem(value) || this.isSelected(value)) return false;
    if (!this.isMulti) return this.setSelectedValues([value]);
    if (this.maxReached(this._selectedValues.length)) return false;
    return this.setSelectedValues([...this._selectedValues, value]);
  }

  selectSingle(value) {
    return value === "" ? this.addValue("") : this.setSelectedValues([value]);
  }

  // Picking the selected Dropdown option again re-sends the selection, so
  // auto-advance can act on a default or on a pick made before Back.
  pickSingle(value) {
    return this.selectSingle(value) || (value !== "" && this.isSelected(value));
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
    if (!this.isSelected(value)) return false;
    if (value === "") {
      this._noneActive = false;
      return true;
    }
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
    return value === ""
      ? this._noneActive
      : this._selectedValues.includes(value);
  }

  findItem(value) {
    return this.items.find((item) => item.value === value);
  }

  handleDragStart(event) {
    const value = event.currentTarget.dataset.value;
    if (!value) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", value);
  }

  handleDragOver(event) {
    if (!this.isColumns) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    this._dragOverZone = event.currentTarget.dataset.zone;
  }

  handleDragLeave(event) {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    this._dragOverZone = "";
  }

  handleDrop(event) {
    if (!this.isColumns) return;
    event.preventDefault();
    const zone = event.currentTarget.dataset.zone;
    const value = event.dataTransfer.getData("text/plain");
    this._dragOverZone = "";
    if (!value) return;

    const changed =
      zone === DROPZONE_SELECTED
        ? this.addValue(value)
        : this.removeValue(value);
    if (changed && !this.previewMode) this.fireChange();
  }

  // Adds the options the search shows to what is already picked, up to the
  // maximum. None and Other are never part of "all".
  handleSelectAll() {
    const changed = this.addValues(
      this.filteredItems
        .map((item) => item.value)
        .filter((value) => value !== "" && value !== MANUAL_INPUT_VALUE)
    );
    this._dualAvailableValues = [];
    this._dualSelectedValues = [];
    if (changed && !this.previewMode) this.fireChange();
  }

  handleClearAll() {
    const changed = this.removeValue("") || this.setSelectedValues([]);
    this._dualAvailableValues = [];
    this._dualSelectedValues = [];
    if (changed && !this.previewMode) this.fireChange();
  }

  selectedItemsInOrder() {
    if (this._noneActive) return [this.findItem("")].filter(Boolean);
    const byValue = new Map(this.items.map((item) => [item.value, item]));
    return this._selectedValues
      .map((value) => byValue.get(value))
      .filter(Boolean);
  }

  // `fromArrowKey` is true when the change came from arrowing through the
  // radio tiles, which must not auto-advance the screen.
  fireChange(fromArrowKey = false) {
    this.dispatchEvent(
      new CustomEvent("selectionchange", {
        detail: {
          values: [...this._selectedValues],
          noneSelected: this._noneActive,
          manualValue: this._manualInputValue,
          fromArrowKey
        },
        bubbles: true,
        composed: false
      })
    );
  }
}
