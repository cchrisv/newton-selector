import { LightningElement, api } from "lwc";
import { filterIcons, findIconByName } from "./iconCatalog";

const ICON_PAGE_SIZE = 80;

export default class NewtonSelectorFlowCpeIconSelector extends LightningElement {
  @api label = "Icon";

  _value = "";
  _searchTerm = "";
  _isOpen = false;
  _visibleLimit = ICON_PAGE_SIZE;

  @api
  get value() {
    return this._value;
  }
  set value(v) {
    this._value = v || "";
  }

  get selectedEntry() {
    return findIconByName(this._value);
  }

  get filteredIcons() {
    return filterIcons(this._searchTerm);
  }

  // The selected icon leads the list when it matches the search.
  get orderedIcons() {
    const filtered = this.filteredIcons;
    const selected = this.selectedEntry;
    if (!selected || !filtered.includes(selected)) {
      return filtered;
    }
    return [selected, ...filtered.filter((entry) => entry !== selected)];
  }

  get visibleIcons() {
    return this.orderedIcons.slice(0, this._visibleLimit).map((entry) => ({
      ...entry,
      displayLabel: entry.humanLabel,
      assistiveLabel: `Select ${entry.humanLabel} icon`,
      selected: entry.iconName === this._value,
      buttonClass:
        entry.iconName === this._value
          ? "newton-selector-icon-cell newton-selector-icon-cell_selected"
          : "newton-selector-icon-cell"
    }));
  }

  get hasVisibleIcons() {
    return this.filteredIcons.length > 0;
  }
  get hasMoreIcons() {
    return this.visibleIcons.length < this.filteredIcons.length;
  }
  get showMoreLabel() {
    const remaining = this.filteredIcons.length - this.visibleIcons.length;
    return `Show ${Math.min(remaining, ICON_PAGE_SIZE)} more`;
  }
  get resultCountLabel() {
    return `${this.visibleIcons.length} of ${this.filteredIcons.length} icons`;
  }

  get placeholderLabel() {
    return this._value || "Select an icon...";
  }

  get hasSelection() {
    return Boolean(this._value);
  }

  handleSearchInput(event) {
    this._searchTerm = event.target.value || "";
    this._visibleLimit = ICON_PAGE_SIZE;
  }

  handleIconClick(event) {
    this.selectIcon(event.currentTarget.dataset.icon);
  }

  handleOpen() {
    this._isOpen = !this._isOpen;
    this._visibleLimit = ICON_PAGE_SIZE;
  }

  handleShowMore() {
    this._visibleLimit += ICON_PAGE_SIZE;
  }

  // Close when focus leaves the selector. The panel is focusable
  // (tabindex="-1"), so clicks on its non-interactive areas keep focus inside.
  handleFocusOut(event) {
    if (!event.relatedTarget || !this.template.contains(event.relatedTarget)) {
      this._isOpen = false;
    }
  }

  handleClear() {
    this.refs.trigger.focus();
    this.selectIcon("");
  }

  selectIcon(iconName) {
    this._value = iconName;
    this._isOpen = false;
    this.dispatchEvent(new CustomEvent("iconselect", { detail: { iconName } }));
  }
}
