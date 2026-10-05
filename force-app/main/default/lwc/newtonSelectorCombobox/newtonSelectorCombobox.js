import { LightningElement, api } from "lwc";

let comboboxCounter = 0;
const DEFAULT_DEBOUNCE_MS = 300;
const DEFAULT_MIN_SEARCH = 2;
const MODE_MULTI = "multi";

function normalizeResult(result) {
  if (!result || typeof result !== "object") {
    return {
      id: "",
      sObjectType: "",
      icon: "",
      title: "",
      subtitle: "",
      type: "",
      displayType: "",
      badge: ""
    };
  }
  const source = result;
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
    type: String(
      source.type || source.displayType || source.resourceType || ""
    ),
    displayType: String(
      source.displayType || source.type || source.resourceType || ""
    ),
    badge: String(source.badge || "")
  };
}

export default class NewtonSelectorCombobox extends LightningElement {
  @api mode = "slot";
  @api open = false;
  @api dropdownClass = "";
  @api dropdownId = "";
  @api dropdownLabel = "Options";
  @api dropdownRole = "listbox";
  @api label = "Search";
  @api placeholder = "";
  @api variant = "label-stacked";
  @api required = false;
  @api disabled = false;
  @api minSearchTermLength = DEFAULT_MIN_SEARCH;
  @api scrollAfterNItems = null;
  @api fieldLevelHelp;
  @api selectionMode = "single";
  @api enableSearch = false;
  @api placeholderWhenEmpty = "Choose an option";

  _fallbackDropdownId = `newton-selector-combobox-listbox-${++comboboxCounter}`;
  _selection = [];
  _options = [];
  _defaultOptions = [];
  _selectOptions = [];
  _selectValues = [];
  _selectOpen = false;
  _selectSearchTerm = "";
  _dropdownOpen = false;
  _loading = false;
  _inputValue = "";
  _searchTerm = "";
  _debounceTimer;
  _activeIndex = -1;
  _listboxId = `newton-selector-combobox-lb-${comboboxCounter}`;
  _inputId = `newton-selector-combobox-input-${comboboxCounter}`;

  disconnectedCallback() {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = undefined;
    }
  }

  @api
  set selection(value) {
    if (value == null) {
      if (this._selection.length) {
        this._selection = [];
      }
      return;
    }
    let incoming;
    if (Array.isArray(value)) {
      incoming = value.map(normalizeResult).filter((row) => row.id);
    } else {
      const one = normalizeResult(value);
      incoming = one.id ? [one] : [];
    }
    const currentIds = this._selection.map((row) => row.id).join("\u0001");
    const nextIds = incoming.map((row) => row.id).join("\u0001");
    if (currentIds === nextIds && currentIds !== "") {
      return;
    }
    this._selection = incoming;
  }

  get selection() {
    return this._selection[0] || null;
  }

  get isOpen() {
    return this.open === true || this.open === "true";
  }

  get isLookupMode() {
    return this.mode === "lookup";
  }

  get isSelectMode() {
    return this.mode === "select";
  }

  get isMultiSelectMode() {
    return this.selectionMode === MODE_MULTI;
  }

  get resolvedDropdownId() {
    return this.dropdownId || this._fallbackDropdownId;
  }

  get computedComboboxClass() {
    return [
      "slds-combobox",
      "slds-dropdown-trigger",
      "slds-dropdown-trigger_click",
      this.isOpen ? "slds-is-open" : ""
    ]
      .filter(Boolean)
      .join(" ");
  }

  get computedDropdownClass() {
    return [
      "slds-dropdown",
      "slds-dropdown_fluid",
      "newton-selector-combobox__dropdown",
      this.dropdownClass
    ]
      .filter(Boolean)
      .join(" ");
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
    this._selectValues = value === null || value === "" ? [] : [String(value)];
  }

  get value() {
    return this._selectValues[0] || "";
  }

  @api
  set values(value) {
    if (value === undefined) return;
    this._selectValues = Array.isArray(value)
      ? value.map((item) => String(item)).filter(Boolean)
      : [];
  }

  get values() {
    return [...this._selectValues];
  }

  get inputId() {
    return this._inputId;
  }

  get selectedIds() {
    return this._selection.map((row) => row.id);
  }

  get selectValueSet() {
    return new Set(this._selectValues);
  }

  get selectedSelectOptions() {
    const selected = this.selectValueSet;
    return this._selectOptions.filter((row) => selected.has(row.id));
  }

  get selectedSelectOption() {
    return this.selectedSelectOptions[0] || null;
  }

  get selectButtonLabel() {
    if (this.isMultiSelectMode) {
      const labels = this.selectedSelectOptions
        .map((row) => row.title)
        .filter(Boolean);
      if (!labels.length) return this.placeholderWhenEmpty;
      const visible = labels.slice(0, 2).join(", ");
      const extra = labels.length - 2;
      return extra > 0 ? `${visible} +${extra} more` : visible;
    }
    return this.selectedSelectOption?.title || this.placeholderWhenEmpty;
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

  get computedSelectDropdownClass() {
    return [
      "slds-dropdown",
      "slds-dropdown_fluid",
      "newton-selector-combobox__dropdown",
      "newton-selector-combobox__select-dropdown",
      this.scrollableClass
    ].join(" ");
  }

  get filteredSelectOptions() {
    const selected = this.selectValueSet;
    const term = this._selectSearchTerm.trim().toLowerCase();
    return this._selectOptions
      .filter((row) => {
        if (!term) return true;
        return [row.title, row.subtitle, row.id, row.type, row.displayType]
          .join(" ")
          .toLowerCase()
          .includes(term);
      })
      .map((row, index) => ({
        ...row,
        key: `${row.id}-${index}`,
        optionId: `${this._listboxId}-select-${index}`,
        isSelected: selected.has(row.id),
        ariaSelected: String(selected.has(row.id)),
        searchTerm: term
      }));
  }

  get hasSelectOptions() {
    return this.filteredSelectOptions.length > 0;
  }

  get hasSelection() {
    return this._selection.length > 0;
  }

  get showExternalLabel() {
    return this.variant === "label-stacked";
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

  get showClearButton() {
    return this.hasSelection && !this.disabled;
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

  get listboxClass() {
    return "slds-listbox slds-listbox_vertical newton-selector-combobox__listbox";
  }

  get listboxActiveOptionId() {
    const row = this.displayedOptions[this._activeIndex];
    return row ? row.optionId : null;
  }

  get displayedOptions() {
    const term = this._dropdownOpen
      ? this._searchTerm.trim().toLowerCase()
      : "";
    return this._options.map((row, index) => ({
      key: row.id + index,
      id: row.id,
      sObjectType: row.sObjectType,
      icon: row.icon,
      title: row.title,
      subtitle: row.subtitle,
      type: row.type,
      displayType: row.displayType,
      badge: row.badge,
      optionId: `${this._listboxId}-opt-${index}`,
      searchTerm: term,
      isActive: index === this._activeIndex,
      ariaSelected: index === this._activeIndex ? "true" : "false"
    }));
  }

  get scrollableClass() {
    const value = this.scrollAfterNItems;
    if (value != null) {
      const count = Number(value);
      if (count === 5 || count === 7 || count === 10) {
        return `slds-dropdown_length-with-icon-${count}`;
      }
    }
    return "";
  }

  get effectiveMinSearchLength() {
    const value = this.minSearchTermLength;
    if (value === null || value === undefined || value === "") {
      return DEFAULT_MIN_SEARCH;
    }
    const count = Number(value);
    if (Number.isNaN(count)) {
      return DEFAULT_MIN_SEARCH;
    }
    return Math.max(0, Math.floor(count));
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

  get computedPlaceholder() {
    return this.placeholder || "Search...";
  }

  get computedLookupDropdownClass() {
    return [
      "slds-dropdown",
      "slds-dropdown_fluid",
      "newton-selector-combobox__dropdown",
      "newton-selector-combobox__lookup-dropdown",
      this.scrollableClass
    ].join(" ");
  }

  get noResultsMessage() {
    const term = (this._searchTerm || "").trim();
    return term ? "No results found." : "No options available.";
  }

  @api
  setSearchResults(results) {
    this._loading = false;
    const rows = Array.isArray(results) ? results : [];
    this._options = rows.map(normalizeResult);
    this._activeIndex = this._options.length ? 0 : -1;
  }

  @api
  setDefaultResults(results) {
    const rows = Array.isArray(results) ? results : [];
    this._defaultOptions = rows.map(normalizeResult);
  }

  @api
  getSelection() {
    return this._selection.map((row) => ({ ...row }));
  }

  handleSelectToggle() {
    if (this.disabled) return;
    this._selectOpen = !this._selectOpen;
  }

  handleSelectSearch(event) {
    this._selectSearchTerm = event.target.value || "";
  }

  handleSelectOptionMouseDown(event) {
    event.preventDefault();
  }

  handleSelectOption(event) {
    const value = event.currentTarget.dataset.value;
    if (value === undefined || value === null) return;
    const row = this._selectOptions.find((option) => option.id === value);
    if (row?.disabled) return;

    const current = this.selectValueSet;
    let values;
    if (this.isMultiSelectMode) {
      if (current.has(value)) {
        current.delete(value);
      } else {
        current.add(value);
      }
      values = [...current];
      this._selectOpen = true;
    } else {
      values = value === "" ? [] : [value];
      this._selectOpen = false;
    }

    this._selectValues = values;
    const selectedRows = this.selectedSelectOptions.map((option) => ({
      ...option
    }));
    this.dispatchEvent(
      new CustomEvent("selectionchange", {
        detail: {
          selectedIds: values,
          value: values[0] || "",
          values,
          item: selectedRows[0] || null,
          items: selectedRows
        }
      })
    );
  }

  // Option rows cancel mousedown, so focus only leaves the combobox when the
  // user moves elsewhere.
  handleSelectFocusOut(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      this._selectOpen = false;
    }
  }

  handleSelectKeydown(event) {
    if (event.key === "Escape") {
      this._selectOpen = false;
      event.stopPropagation();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.handleSelectToggle();
    }
  }

  handleNativeInput(event) {
    this._inputValue = event.target.value;
    const raw = this._inputValue || "";
    this._searchTerm = raw;
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
    const sanitized = raw.trim().toLowerCase();
    const min = this.effectiveMinSearchLength;
    if (sanitized.length < min) {
      this._options = this._defaultOptions.length
        ? [...this._defaultOptions]
        : [];
      this._activeIndex = this._options.length ? 0 : -1;
      this._loading = false;
      return;
    }
    this._loading = true;
    this.dispatchEvent(
      new CustomEvent("search", {
        detail: {
          searchTerm: sanitized,
          rawSearchTerm: raw,
          selectedIds: this.selectedIds
        }
      })
    );
  }

  handleClearSelection() {
    this._selection = [];
    this._searchTerm = "";
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
    if (this.disabled) {
      return;
    }
    const min = this.effectiveMinSearchLength;
    if (min === 0 && !String(this._inputValue || "").trim() && !this._loading) {
      this.fireSearch("");
      return;
    }
    if (!this._inputValue && this._defaultOptions.length) {
      this._options = [...this._defaultOptions];
      this._activeIndex = this._options.length ? 0 : -1;
      this._loading = false;
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
    if (this.disabled) {
      return;
    }
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
    this._searchTerm = "";
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
    if (
      !this._dropdownOpen &&
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
      this._scrollActiveIntoView();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      this._activeIndex =
        (this._activeIndex - 1 + this._options.length) % this._options.length;
      this._scrollActiveIntoView();
    } else if (event.key === "Home") {
      event.preventDefault();
      this._activeIndex = 0;
      this._scrollActiveIntoView();
    } else if (event.key === "End") {
      event.preventDefault();
      this._activeIndex = Math.max(this._options.length - 1, 0);
      this._scrollActiveIntoView();
    } else if (event.key === "Enter") {
      event.preventDefault();
      const row = this._options[this._activeIndex];
      if (row) {
        this.applySelection(row);
      }
    } else if (event.key === "Escape") {
      this.closeDropdown();
    }
  }

  _scrollActiveIntoView() {
    const optionId = this.listboxActiveOptionId;
    if (!optionId) {
      return;
    }

    Promise.resolve().then(() => {
      const element = this.template.querySelector(`[id="${optionId}"]`);
      element?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }
}
