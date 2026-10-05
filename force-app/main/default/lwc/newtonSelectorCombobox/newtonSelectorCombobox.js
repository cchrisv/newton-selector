import { LightningElement, api } from "lwc";

let comboboxCounter = 0;
const DEFAULT_DEBOUNCE_MS = 300;
const SELECT_PLACEHOLDER = "Choose an option";

function normalizeResult(source) {
  const idRaw =
    source.id != null && String(source.id) !== "" ? source.id : source.value;
  const titleRaw =
    source.title != null && String(source.title) !== ""
      ? source.title
      : source.label;
  return {
    ...source,
    id: idRaw == null ? "" : String(idRaw),
    sObjectType: String(source.sObjectType || ""),
    icon: String(source.icon || ""),
    title: titleRaw == null ? "" : String(titleRaw),
    subtitle: source.subtitle == null ? "" : String(source.subtitle),
    type: String(source.type || ""),
    badge: String(source.badge || "")
  };
}

export default class NewtonSelectorCombobox extends LightningElement {
  @api mode = "slot";
  @api open = false;
  @api dropdownLabel;
  @api dropdownRole = "listbox";
  @api label;
  @api placeholder = "";
  @api variant = "label-stacked";
  @api required = false;
  @api enableSearch = false;

  _selection = [];
  _options = [];
  _selectOptions = [];
  _selectValue = "";
  _selectOpen = false;
  _selectSearchTerm = "";
  _selectActiveIndex = -1;
  _dropdownOpen = false;
  _loading = false;
  _inputValue = "";
  _debounceTimer;
  _activeIndex = -1;
  _listboxId = `newton-selector-combobox-lb-${++comboboxCounter}`;
  _inputId = `newton-selector-combobox-input-${comboboxCounter}`;

  disconnectedCallback() {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = undefined;
    }
  }

  // The parent's row is the only source of what is displayed, so a richer row
  // with the same id (for example, a field label once metadata loads) replaces
  // the one shown.
  @api
  set selection(value) {
    if (value == null) {
      this._selection = [];
      return;
    }
    const rows = Array.isArray(value) ? value : [value];
    this._selection = rows.map(normalizeResult).filter((row) => row.id);
  }

  get selection() {
    return this._selection[0] || null;
  }

  get isLookupMode() {
    return this.mode === "lookup";
  }

  get isSelectMode() {
    return this.mode === "select";
  }

  get computedComboboxClass() {
    return this.open
      ? "slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click slds-is-open"
      : "slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click";
  }

  get labelClass() {
    return this.variant === "label-hidden"
      ? "slds-form-element__label slds-assistive-text"
      : "slds-form-element__label";
  }

  @api
  set options(value) {
    const rows = Array.isArray(value) ? value : [];
    this._selectOptions = rows.map(normalizeResult);
  }

  get options() {
    return this._selectOptions.map((row) => ({ ...row }));
  }

  @api
  set value(value) {
    if (value === undefined) return;
    this._selectValue = value === null ? "" : String(value);
  }

  get value() {
    return this._selectValue;
  }

  get inputId() {
    return this._inputId;
  }

  get selectedIds() {
    return this._selection.map((row) => row.id);
  }

  get selectedSelectOption() {
    return (
      this._selectOptions.find((row) => row.id === this._selectValue) || null
    );
  }

  get selectButtonLabel() {
    return this.selectedSelectOption?.title || SELECT_PLACEHOLDER;
  }

  get selectedSelectIconName() {
    return this.selectedSelectOption?.icon || null;
  }

  get selectComboboxClass() {
    const base =
      "slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click newton-selector-combobox__select";
    return this._selectOpen ? `${base} slds-is-open` : base;
  }

  get selectInputContainerClass() {
    const base = "slds-combobox__form-element slds-input-has-icon";
    return this.selectedSelectIconName
      ? `${base} slds-input-has-icon_left-right`
      : `${base} slds-input-has-icon_right`;
  }

  get selectButtonClass() {
    const base =
      "slds-input_faux slds-combobox__input newton-selector-combobox__select-button";
    return this.selectedSelectIconName
      ? `${base} slds-combobox__input-value`
      : base;
  }

  get selectExpanded() {
    return String(this._selectOpen);
  }

  get selectChevron() {
    return this._selectOpen ? "chevron-up" : "chevron-down";
  }

  get filteredSelectOptions() {
    const term = this._selectSearchTerm.trim().toLowerCase();
    return this._selectOptions
      .filter((row) => {
        if (!term) return true;
        return [row.title, row.subtitle, row.id, row.type]
          .join(" ")
          .toLowerCase()
          .includes(term);
      })
      .map((row, index) => {
        const isSelected = row.id === this._selectValue;
        const isActive = index === this._selectActiveIndex;
        return {
          ...row,
          key: `${row.id}-${index}`,
          index,
          optionId: `${this._listboxId}-select-${index}`,
          isSelected,
          ariaSelected: String(isSelected),
          optionClass: isActive
            ? "slds-media slds-listbox__option slds-listbox__option_entity slds-media_small newton-selector-combobox__option slds-has-focus newton-selector-combobox__option_active"
            : "slds-media slds-listbox__option slds-listbox__option_entity slds-media_small newton-selector-combobox__option",
          searchTerm: term
        };
      });
  }

  get selectActiveOptionId() {
    return (
      this.filteredSelectOptions[this._selectActiveIndex]?.optionId || null
    );
  }

  get hasSelectOptions() {
    return this.filteredSelectOptions.length > 0;
  }

  get hasSelection() {
    return this._selection.length > 0;
  }

  get selectedIconName() {
    return this._selection[0]?.icon || null;
  }

  get inputDisplayValue() {
    return this.hasSelection ? this._selection[0].title : this._inputValue;
  }

  get showSearchIcon() {
    return !this.hasSelection;
  }

  get inputContainerClass() {
    const base = "slds-combobox__form-element slds-input-has-icon";
    return this.hasSelection
      ? `${base} slds-input-has-icon_left-right`
      : `${base} slds-input-has-icon_right`;
  }

  get inputClass() {
    const base =
      "slds-input slds-combobox__input newton-selector-combobox__lookup-input";
    return this.hasSelection ? `${base} slds-combobox__input-value` : base;
  }

  get requiredAria() {
    return this.required ? "true" : "false";
  }

  get listboxActiveOptionId() {
    const row = this.displayedOptions[this._activeIndex];
    return row ? row.optionId : null;
  }

  get displayedOptions() {
    const term = this._dropdownOpen
      ? this._inputValue.trim().toLowerCase()
      : "";
    return this._options.map((row, index) => ({
      key: row.id + index,
      id: row.id,
      index,
      sObjectType: row.sObjectType,
      icon: row.icon,
      title: row.title,
      subtitle: row.subtitle,
      type: row.type,
      badge: row.badge,
      optionId: `${this._listboxId}-opt-${index}`,
      searchTerm: term,
      isActive: index === this._activeIndex,
      ariaSelected: index === this._activeIndex ? "true" : "false"
    }));
  }

  get comboboxExpanded() {
    return this._dropdownOpen ? "true" : "false";
  }

  get lookupComboboxClass() {
    const base =
      "slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click newton-selector-combobox__lookup";
    return this._dropdownOpen ? `${base} slds-is-open` : base;
  }

  get ariaBusyValue() {
    return this._loading ? "true" : "false";
  }

  get noResultsMessage() {
    const term = this.isSelectMode ? this._selectSearchTerm : this._inputValue;
    return term.trim() ? "No results found." : "No options available.";
  }

  @api
  setSearchResults(results) {
    this._loading = false;
    const rows = Array.isArray(results) ? results : [];
    this._options = rows.map(normalizeResult);
    this._activeIndex = this._options.length ? 0 : -1;
  }

  @api
  getSelection() {
    return this._selection.map((row) => ({ ...row }));
  }

  openSelect(fromEnd) {
    this._selectOpen = true;
    const rows = this.filteredSelectOptions;
    const selectedIndex = rows.findIndex((row) => row.isSelected);
    if (selectedIndex >= 0) {
      this._selectActiveIndex = selectedIndex;
    } else {
      this._selectActiveIndex = fromEnd ? rows.length - 1 : 0;
    }
    this._scrollActiveIntoView(this._selectActiveIndex);
  }

  closeSelect() {
    this._selectOpen = false;
    this._selectActiveIndex = -1;
    this._selectSearchTerm = "";
  }

  handleSelectToggle() {
    if (this._selectOpen) {
      this.closeSelect();
    } else {
      this.openSelect(false);
    }
  }

  handleSelectSearch(event) {
    this._selectSearchTerm = event.target.value || "";
    this._selectActiveIndex = this.filteredSelectOptions.length ? 0 : -1;
  }

  handleSelectOptionMouseDown(event) {
    event.preventDefault();
  }

  handleSelectOption(event) {
    this.commitSelectValue(event.currentTarget.dataset.value);
  }

  commitSelectValue(value) {
    this._selectValue = value;
    this.closeSelect();
    this.refs.selectButton.focus();
    this.dispatchEvent(
      new CustomEvent("selectionchange", {
        detail: { value }
      })
    );
  }

  // Option rows cancel mousedown, so focus only leaves the combobox when the
  // user moves elsewhere.
  handleSelectFocusOut(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      this.closeSelect();
    }
  }

  // Select-only combobox keyboard model, shared by the button and the filter
  // input. Space types into the filter, and Home/End move its caret.
  handleSelectKeydown(event) {
    const key = event.key;
    const inSearch = event.currentTarget.type === "search";
    if (!this._selectOpen) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(key)) {
        event.preventDefault();
        this.openSelect(key === "ArrowUp");
      }
      return;
    }
    if (key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.closeSelect();
      this.refs.selectButton.focus();
      return;
    }
    const last = this.filteredSelectOptions.length - 1;
    let next = this._selectActiveIndex;
    if (key === "ArrowDown") {
      next = Math.min(next + 1, last);
    } else if (key === "ArrowUp") {
      next = Math.max(next - 1, 0);
    } else if (key === "Home" && !inSearch) {
      next = 0;
    } else if (key === "End" && !inSearch) {
      next = last;
    } else if (key === "Enter" || (key === " " && !inSearch)) {
      event.preventDefault();
      const row = this.filteredSelectOptions[this._selectActiveIndex];
      if (row) {
        this.commitSelectValue(row.id);
      }
      return;
    } else {
      return;
    }
    event.preventDefault();
    this._selectActiveIndex = last < 0 ? -1 : next;
    this._scrollActiveIntoView(this._selectActiveIndex);
  }

  handleNativeInput(event) {
    this._inputValue = event.target.value || "";
    const raw = this._inputValue;
    this.openDropdown();
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    // eslint-disable-next-line @lwc/lwc/no-async-operation
    this._debounceTimer = window.setTimeout(
      () => this.fireSearch(raw),
      DEFAULT_DEBOUNCE_MS
    );
  }

  fireSearch(raw) {
    this._loading = true;
    this.dispatchEvent(
      new CustomEvent("search", {
        detail: {
          searchTerm: raw.trim().toLowerCase(),
          rawSearchTerm: raw
        }
      })
    );
  }

  handleClearSelection() {
    this._selection = [];
    this._inputValue = "";
    this.dispatchEvent(
      new CustomEvent("selectionchange", {
        detail: { selectedIds: [] }
      })
    );

    Promise.resolve().then(() => this.refs.searchinput?.focus());
  }

  handleFocus() {
    if (this.hasSelection) {
      return;
    }
    this.openDropdown();
    if (!this._inputValue.trim() && !this._loading) {
      this.fireSearch("");
    }
  }

  handleLookupFocusOut(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      this.closeDropdown();
    }
  }

  handlePointerDownOption(event) {
    event.preventDefault();
  }

  openDropdown() {
    this._dropdownOpen = true;
  }

  closeDropdown() {
    this._dropdownOpen = false;
    this._activeIndex = -1;
  }

  handleSelect(event) {
    const id = event.currentTarget.dataset.id;
    const row = this._options.find((option) => option.id === id);
    if (!row) {
      return;
    }
    this.applySelection(row);
  }

  applySelection(row) {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = undefined;
    }
    this._selection = [row];
    this._options = [];
    this.closeDropdown();
    this._inputValue = "";
    this.dispatchEvent(
      new CustomEvent("selectionchange", {
        detail: {
          selectedIds: this.selectedIds
        }
      })
    );
  }

  handleKeydown(event) {
    if (event.key === "Tab") {
      this.closeDropdown();
      return;
    }
    // An open list consumes Esc, so the editor modal does not also treat it
    // as "discard changes". A closed list lets it through.
    if (event.key === "Escape") {
      if (this._dropdownOpen) {
        event.preventDefault();
        event.stopPropagation();
        this.closeDropdown();
      }
      return;
    }
    if (
      !this._dropdownOpen &&
      !this.hasSelection &&
      (event.key === "ArrowDown" || event.key === "Enter")
    ) {
      this.openDropdown();
    }
    if (!this._options.length) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      this._activeIndex = (this._activeIndex + 1) % this._options.length;
      this._scrollActiveIntoView(this._activeIndex);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      this._activeIndex =
        (this._activeIndex - 1 + this._options.length) % this._options.length;
      this._scrollActiveIntoView(this._activeIndex);
    } else if (event.key === "Home") {
      event.preventDefault();
      this._activeIndex = 0;
      this._scrollActiveIntoView(this._activeIndex);
    } else if (event.key === "End") {
      event.preventDefault();
      this._activeIndex = Math.max(this._options.length - 1, 0);
      this._scrollActiveIntoView(this._activeIndex);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const row = this._options[this._activeIndex];
      if (row) {
        this.applySelection(row);
      }
    }
  }

  // Looks the row up by data-index: LWC rewrites template ids under synthetic
  // shadow, so an id selector would not match.
  _scrollActiveIntoView(index) {
    if (index < 0) {
      return;
    }
    Promise.resolve().then(() => {
      this.template
        .querySelector(
          `.newton-selector-combobox__option[data-index="${index}"]`
        )
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }
}
