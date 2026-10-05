# Component Levels — Detailed Reference

## Atom

**Format:** `{app}{Name}` | **Data:** Never | **Logic:** Never

Pure presentational. Receives all state via `@api`, communicates out via `CustomEvent`.

**Responsibilities:**
- Render a single UI element or tightly coupled visual group
- Emit semantic events (`toggle`, `iconselect`)
- Accept style configuration via `@api` properties

**Constraints:**
- No `@wire`, no Apex imports
- No `@track` internal state (derive everything from `@api`)
- No child component imports beyond base Lightning components
- No business logic — not even simple conditionals about data shape

**Example — newtonSelectorFlowCpeToggle** (condensed):
```javascript
import { LightningElement, api } from "lwc";

/**
 * Two-state setting control: a radio group of an "off" and an "on" option.
 *
 * @fires toggle — detail `{ checked }`.
 */
export default class NewtonSelectorFlowCpeToggle extends LightningElement {
  /** @type {string} Accessible name; shown above the control unless label-hidden. */
  @api label;
  /** @type {boolean} Current value. */
  @api checked = false;
  /** @type {string} Text of the "on" option. */
  @api activeLabel = "On";
  /** @type {string} Text of the "off" option. */
  @api inactiveLabel = "Off";

  handleChoiceClick(event) {
    this.select(event.currentTarget.dataset.checked === "true");
  }

  select(isOn) {
    if (isOn === (this.checked === true)) return;
    this.dispatchEvent(new CustomEvent("toggle", { detail: { checked: isOn } }));
  }
}
```

---

## Molecule

**Format:** `{app}{Name}` | **Data:** Never | **Logic:** Coordination

Composes 2-5 atoms/molecules. Adds **local coordination** — search filtering, tab selection, drag reordering — but never fetches data.

**Responsibilities:**
- Compose atoms into a meaningful UI group
- Transform child events into higher-level parent events
- Manage local UI state (expanded/collapsed, selected tab, filter text)

**Constraints:**
- No `@wire`, no Apex imports
- Receives all data via `@api`
- Does not contain business rules (validation logic belongs in organisms)
- Maximum 5 direct child components

**Example — newtonSelectorFlowCpeIconSelector** (condensed): filters the
generated icon catalog by a local search term and reports the pick upward.
```javascript
import { LightningElement, api } from "lwc";
import { filterIcons } from "./iconCatalog";

export default class NewtonSelectorFlowCpeIconSelector extends LightningElement {
  @api label = "Icon";

  _value = "";
  _searchTerm = "";

  @api
  get value() {
    return this._value;
  }
  set value(v) {
    this._value = v || "";
  }

  get filteredIcons() {
    return filterIcons(this._searchTerm);
  }

  handleSearchInput(event) {
    this._searchTerm = event.target.value || "";
  }

  handleIconClick(event) {
    this.selectIcon(event.currentTarget.dataset.icon);
  }

  selectIcon(iconName) {
    this._value = iconName;
    this.dispatchEvent(new CustomEvent("iconselect", { detail: { iconName } }));
  }
}
```

---

## Organism

**Format:** `{app}{Name}` | **Data:** wire/Apex | **Logic:** Business rules

Owns a **data domain**. Fetches, transforms, validates, and presents data with full state management.

**Responsibilities:**
- Fetch data via `@wire` or imperative Apex
- Apply business rules and data transformations
- Handle ALL states: loading, error, empty, populated
- Enforce FLS/sharing (at Apex layer)
- Support cross-context rendering (desktop, mobile, Experience Cloud)

**Example — newtonSelectorDataSelector** (condensed): guards async work with a
connected flag and shows the real Apex error message.
```javascript
import { LightningElement } from "lwc";
import queryItems from "@salesforce/apex/NewtonSelectorRuntimeController.queryItems";
import { errorMessageOf } from "c/newtonSelectorUtilityDataSources";

export default class NewtonSelectorDataSelector extends LightningElement {
  _connectedFlag = false;
  _isLoading = false;
  _errorMessage = "";

  connectedCallback() {
    this._connectedFlag = true;
    this.loadData();
  }

  disconnectedCallback() {
    this._connectedFlag = false;
  }

  async loadSObject() {
    this._isLoading = true;
    this._errorMessage = "";
    try {
      this._rawData = await queryItems({ configJson: JSON.stringify(this._sobjectConfig) });
      this.reapplyNormalization();
    } finally {
      this._isLoading = false;
    }
  }

  handleError(error) {
    this._errorMessage = errorMessageOf(error, this.errorStateMessage);
    this._isLoading = false;
  }
}
```

**Template with all states** (condensed): a loading status, an error alert
with the message and a standard SLDS neutral **Try again** button (SOQL failures only),
an empty state, and the options.
```html
<template lwc:if={isLoading}>
  <div class="newton-state newton-state_loading" role="status" aria-live="polite">
    <span class="slds-assistive-text">{labels.loadingOptions}</span>
  </div>
</template>
<template lwc:if={hasError}>
  <div class="newton-state newton-state_error" role="alert">
    <p class="newton-state__message">{resolvedErrorMessage}</p>
    <template lwc:if={canRetry}>
      <button type="button" class="slds-button slds-button_neutral" onclick={handleRetry}>
        {labels.tryAgain}
      </button>
    </template>
  </div>
</template>
```

---

## Template

**Format:** `{app}{Name}` | **Data:** Never | **Logic:** Never

Layout-only via `<slot>`. Provides responsive structure. Contains zero content and zero logic.

**Example:**
```html
<template>
    <div class="slds-grid slds-wrap">
        <div class="slds-col slds-size_1-of-1 slds-medium-size_1-of-3">
            <slot name="sidebar"></slot>
        </div>
        <div class="slds-col slds-size_1-of-1 slds-medium-size_2-of-3">
            <slot name="main"></slot>
        </div>
    </div>
</template>
```

---

## Page

**Format:** `{app}Page{Name}` | **Data:** Orchestration | **Logic:** Process

Composes templates and organisms into complete user journeys. Owns navigation and cross-organism coordination.

**Responsibilities:**
- Place organisms into template slots
- Orchestrate data flow between organisms (via events/shared state)
- Handle navigation (`NavigationMixin`)
- Represent a complete user task from entry to exit

---

## Utility

**Format:** `{app}Utility{Name}` | **Data:** Varies | **Logic:** Technical

**Not an LWC component** — pure JS module. Imported by any level.

**Patterns in this repo:**
- Stateless transforms: `normalizePicklist(picklistValues, valueSource)`,
  `normalizeCollection`, `filterItems` and `formatLabel` in
  `c/newtonSelectorUtilityDataSources`.
- Option shaping: `fieldsToOptions(fields)`, `filterFieldOptions(options, term)`
  and `loadErrorMessage(what, error)` in `c/newtonSelectorFlowCpeUtilityHelpers`.
  The field picker calls the cacheable Apex `getObjectFields` itself; the
  utility only shapes the result and the error text.

---

## Flow Component

**Format:** `{app}Flow{Name}` | **Data:** Delegation | **Logic:** Delegation

Thin wrapper that bridges Flow runtime ↔ LWC organisms.

**Example — newtonSelectorFlowScreen** (condensed): publishes outputs to Flow
and delegates validation to the composed organism.
```javascript
import { LightningElement, api } from "lwc";
import { FlowAttributeChangeEvent } from "lightning/flowSupport";

export default class NewtonSelectorFlowScreen extends LightningElement {
  @api availableActions = [];

  handleValueChange(event) {
    this._value = event.detail.value || "";
    this.dispatchEvent(new FlowAttributeChangeEvent("value", this._value));
  }

  @api
  validate() {
    const result = this.template
      .querySelector("c-newton-selector-data-selector")
      .validate();
    // The Error message applies only while Required is on.
    if (
      !result.isValid &&
      this._config.required &&
      this._config.customErrorMessage
    ) {
      return { isValid: false, errorMessage: this._config.customErrorMessage };
    }
    return result;
  }
}
```

**Key rules:**
- All `@api` properties that Flow sets must dispatch `FlowAttributeChangeEvent` on change
- Always implement `@api validate()` for navigation gates
- Delegate complex UI and data to composed organisms
