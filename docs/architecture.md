# Architecture

How Newton Selector is put together: the three runtime surfaces, the component tree, how data flows from a Salesforce org to a tile on a Flow screen, and how the editor turns clicks into saved configuration. Written for engineers who will change the code.

If you only want to use the component, start with the [overview](overview.md). For exact option names and defaults, see the [configuration reference](reference-configuration.md).

## The shape of the system

Newton Selector is one Flow screen component plus the editor that configures it. There is no managed state, no custom object and no custom setting. Everything an admin chooses is saved as one JSON string on the Flow element.

```
 DESIGN TIME (Flow Builder)                          RUN TIME (Flow screen)
 ──────────────────────────                          ──────────────────────

 Flow Builder panel                                  Flow screen
   newtonSelectorFlowCpe                               newtonSelectorFlowScreen
        │ opens                                              │ renders
        ▼                                                    ▼
   ConfigModal ── Studio layout                        DataSelector ──► Apex queryItems
     ├ Data / Content / Behavior / Appearance            │ (data, state machine)   (SOQL source only)
     └ ConfigPreview ──► DataSelector (sample data)      ▼
        │                                              Group ──► ChoiceTile ──► Icon
        │ Save                                         (layout)   (one option)
        ▼
   selectorConfigJson  ◄────────── saved on the Flow element ──────────►  read by FlowScreen
   sourceRecords, T
```

Three surfaces share one rendering stack:

1. **The Flow screen component** (`newtonSelectorFlowScreen`) is what end users see.
2. **The Custom Property Editor** (CPE, `newtonSelectorFlowCpe` and its children) is what admins use in Flow Builder.
3. **The live preview** inside the CPE reuses the real `DataSelector → Group → ChoiceTile` stack with sample data. What the admin previews is the code that will run.

The editor also reuses the runtime pieces for its own controls. The editor's tile pickers use `ChoiceTile` directly, so they look and behave like the product. They listen only to `cardselect`, so clicking the tile that is already chosen does nothing. `Group` is used only by `DataSelector`.

## Component tree

The names below are the actual bundles under `force-app/main/default/lwc/`.

```
newtonSelectorFlowScreen                  Flow Screen entry point (lightning__FlowScreen)
  └─ newtonSelectorDataSelector           Loads and normalizes data; selection state; validate()
       └─ newtonSelectorGroup             Renders one of 7 layouts; search, select-all, transfer UI
            └─ newtonSelectorChoiceTile   One option: icon, label, sublabel, badge, appearance
                 └─ newtonSelectorIcon    Lucide-style SVG icon renderer

newtonSelectorFlowCpe                     Panel in Flow Builder; summary + validate(); opens the modal
  └─ newtonSelectorFlowCpeConfigModal     LightningModal; owns the working copy and Save
       ├─ newtonSelectorFlowCpeStudio     Split layout: preview | scrolling chapters; splitter
       ├─ newtonSelectorFlowCpeConfigPreview     Preview with state tabs, uses DataSelector
       ├─ newtonSelectorFlowCpeDataConfig        Data chapter: sources, field maps, overrides, display
       ├─ newtonSelectorFlowCpeContentConfig     Content chapter: label, help, empty/error text
       ├─ newtonSelectorFlowCpeBehaviorConfig    Behavior chapter: mode, default selection, required, auto-advance, none, manual, select all, search
       └─ newtonSelectorFlowCpeAppearanceConfig  Appearance chapter: layout and all visual options

Editor controls (used inside the chapters)
  newtonSelectorFlowCpeWhereBuilder       Visual SOQL WHERE builder
  newtonSelectorFlowCpeResourceSelector   Flow resource / merge-field combobox
  newtonSelectorFlowCpeFieldSelector      Object-scoped field picker
  newtonSelectorFlowCpeIconSelector       Icon picker over the Lucide catalog
  newtonSelectorFlowCpeChoiceControl      Labeled picklist (built on Combobox)
  newtonSelectorFlowCpeLookupChoiceOption Row renderer for the combobox lists; highlights search matches
  newtonSelectorFlowCpeToggle             Two-state toggle
  newtonSelectorFlowCpeToneRow            Tone chip row + custom hex editor (Appearance chapter)
  newtonSelectorCombobox                  Shared combobox (lookup, select and slotted-trigger modes)

Pure-JS utility bundles (no template)
  newtonSelectorUtilityConfigDefaults     defaultSelectorConfig(): the single source of defaults
  newtonSelectorUtilityDataSources        Normalizers for Picklist, Collection and Custom (SOQL rows come from Apex as finished items); overrides, search filter, sort/limit
  newtonSelectorFlowCpeUtilityConfigOptions     Option metadata (labels, values) for editor controls
  newtonSelectorFlowCpeUtilityConfigState       Layout switch and appearance reset; collection object lookup; sample Flow values for Validate query
  newtonSelectorFlowCpeUtilityConfigValidation  Issue generation; what blocks Save
  newtonSelectorFlowCpeUtilityConfigStyles      Shared chapter styles (CSS-only bundle)
  newtonSelectorFlowCpeUtilityTokens            The --newton-studio-* design tokens, defined once (CSS-only bundle)
  newtonSelectorFlowCpeUtilityHelpers           Load-error text, field-type icons and options, merge-field helpers
```

`newtonSelectorFlowCpeConfigModal` keeps only orchestration, save handling and cross-chapter state. Chapter bodies, validation, config-state helpers and preview are separate modules so each can be tested alone. Most have Jest tests under their `__tests__/` folder.

## Runtime data flow

```
FlowScreen            DataSelector                         Apex / platform
    │  selectorConfigJson │                                      │
    │  (parsed + merged   │                                      │
    │   over defaults)    │                                      │
    ├────── config ──────►│                                      │
    │                     │  by dataSource:                      │
    │                     │   picklist ──► getPicklistValues     │
    │                     │               wire, then normalize   │
    │                     │   collection ► normalize in memory   │
    │                     │   custom ────► normalize in memory   │
    │                     │   sobject ───► queryItems(configJson)├──► USER_MODE SOQL
    │                     │               (finished items)       │
    │                     │                                      │
    │                     │  pipeline: overrides → sort/limit    │
    │                     │            → None → manual "Other"   │
    │                     ▼                                      │
    │                   Group ──► ChoiceTile × N                 │
    │                     │  (user clicks)                       │
    │◄── valuechange ─────┤                                      │
    │◄── itemschange ─────┤                                      │
    ▼                                                            │
 FlowAttributeChangeEvent × n  (outputs)                         │
 FlowNavigationNextEvent /                                       │
 FlowNavigationFinishEvent     (auto-advance)                    │
```

**1. Config in.** `FlowScreen` parses `selectorConfigJson`, deep-merges it over `defaultSelectorConfig()` and passes sub-objects to `DataSelector`. JSON that does not parse shows the error state instead of options, with the `Newton_Selector_ConfigUnreadable` message ("This selector's saved configuration can't be read ({0}). A Flow value merged into it may contain a quote, backslash or line break. ...") and the parse error in place of `{0}`. That error has no **Try again** button. An unknown layout becomes `grid`. Boolean settings must be JSON booleans; the strings `"true"` and `"false"` are not read as booleans.

**2. Load.** `DataSelector` picks a loader by `dataSource`:

| Source     | Mechanism                                                                                                                                                                               |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| picklist   | `getPicklistValues` wire adapter. Uses the configured record type, else the master record type `012000000000000AAA`.                                                                    |
| collection | Synchronous. Maps each record through the configured field map.                                                                                                                         |
| custom     | Synchronous. Drops `hidden` items. A missing value (`null` or not set) defaults to the item's index; an empty string stays `""`. There is no per-option `disabled`.                     |
| sobject    | Imperative call to `NewtonSelectorRuntimeController.queryItems` (not cacheable, so each mount reads current records). Re-runs when the config changes; a failure shows the error state. |

**3. Shape.** Every source yields the same item: `{ id, label, sublabel, icon, badge, helpText, value, ...}`. Picklist, Collection and Custom are normalized in the browser; SOQL rows arrive from Apex already in this shape, with no normalizer. After loading, items go through a fixed pipeline: item overrides (every source except collection; the editor sets them only for Picklist and SOQL and clears them when the source changes), sort and limit, the optional None entry, then the optional manual "Other" entry (always last, sentinel value `__newton_manual_input__`).

**4. Render.** `Group` chooses a layout and renders `ChoiceTile`s. Search is client-side over label, sublabel and help text.

**5. Selection out.** `Group` fires `selectionchange`; `DataSelector` turns it into `valuechange` (the selected value, label and record) and `itemschange` (everything rendered except the manual "Other" entry). `valuechange` is also sent once the options load when a selection is pre-set (Default selection, Back, resume), with `userAction: false`. With manual input off, a pre-set value that matches no rendered option is dropped. `allValues` and `allLabels` never include the manual "Other" entry. `FlowScreen` converts those into `FlowAttributeChangeEvent`s for the [output variables](reference-flow-component.md#outputs). The typed record outputs (`selectedRecord`, `selectedRecords`) carry records only for the SOQL and Collection sources; Custom and Picklist options have no record, so they stay empty.

**6. Validation.** Flow calls `validate()` on the screen component. It delegates to `DataSelector`, which checks required, manual-input length and min/max selection. If the admin set `customErrorMessage`, it replaces every message, but only while `required` is on. `FlowScreen` also implements `setCustomValidity(message)` and `reportValidity()`: Flow shows no message for a component that implements `reportValidity`, so `FlowScreen` passes the message (Flow's own, else the `validate()` error) to `DataSelector`, which shows it under the selector as an alert. The next selection change by the user clears or updates it.

**7. Auto-advance.** In single mode with `autoAdvance` on and a non-empty value picked by the user, `FlowScreen` waits 150 ms (reset on each change), then fires `FlowNavigationNextEvent` when `availableActions` has `NEXT`, otherwise `FlowNavigationFinishEvent`. Picking the already-selected option re-sends the selection, so auto-advance also fires for a Default selection or after Back. `ChoiceTile` sends `cardselect` only on a real change; when its checked tile is clicked (or Space is pressed on it) in single mode it sends `cardrepick` instead. Only `Group` listens to `cardrepick` (Grid, List, Horizontal and Radio) and re-fires `selectionchange`; the Dropdown re-fires it when the chosen option is picked again. Columns and Dual listbox have no re-pick: clicking the selected Columns card does nothing. A pre-selection never advances, choosing None never advances, and typing in the manual "Other" box never advances. Moving between radio tiles with the arrow keys changes the selection but does not advance; only a click, or Space, on a tile does.

### Events between components

| Event             | From → To                 | Detail                                                                                     |
| ----------------- | ------------------------- | ------------------------------------------------------------------------------------------ |
| `cardselect`      | ChoiceTile → Group        | `{ value, fromArrowKey }`; sent only when the tile's checked state changes                 |
| `cardrepick`      | ChoiceTile → Group        | `{ value }`; the selected tile was clicked again in single mode                            |
| `selectionchange` | Group → DataSelector      | `{ values, noneSelected, manualValue, fromArrowKey }`                                      |
| `valuechange`     | DataSelector → FlowScreen | `{ value, values, label, labels, record, records, manualInput, userAction, fromArrowKey }` |
| `itemschange`     | DataSelector → FlowScreen | `{ values, labels }`                                                                       |

All five bubble but are not composed, so they stop at the component boundary that handles them. `FlowScreen` uses `manualInput`, `userAction` and `fromArrowKey` (set when arrow-key navigation made the change) to decide whether a change may auto-advance.

## Design-time flow

```
open modal ──► working copy of config (deep clone)
                  │
   edit control ──► configpatch { value: next config }  ──► re-run validation ──► update preview
                    (each chapter builds the whole next config; the modal replaces its copy)
                  │
   Save ──► (disabled while any error) ──► return config to the panel
                  │
panel dispatches:
   configuration_editor_input_value_changed  name=sourceRecords      (if changed)
   configuration_editor_input_value_changed  name=value / name=values (if changed)
   configuration_editor_generic_type_mapping_changed typeName=T       typeValue=<object API name> (if changed)
   configuration_editor_input_value_changed  name=selectorConfigJson  JSON.stringify(config)
```

- **Edits stay local.** The modal works on a copy. With unsaved changes, Cancel and Esc ask before discarding it (the header X is disabled until then).
- **Layout changes keep styling.** Switching layout swaps only the geometry keys of `gridConfig` and remembers each layout's geometry in `layoutGeometry`.
- **The preview never queries data.** It uses neutral sample options. For the Custom source it renders your options exactly as configured, with no sample fill (sample options appear only while there are none).
- **Editor Apex calls.** The editor calls Apex for the object pickers (`searchSObjectTypes`), the field pickers, the WHERE builder and the resource picker's global-variable fields (`getObjectFields`), and **Validate query** (`validateQuery`) and **Load sample rows** (`queryItems`), which both run the real query. The resource picker's record-variable drill-in uses the UI API `getObjectInfo` wire, not Apex.
- **`sourceRecords`** is re-dispatched when it changes, and cleared on save when the source is not Collection.
- **Generic type `T`.** The component is declared with `<propertyType name="T" extends="SObject">`. Flow requires `T` because `sourceRecords`, `selectedRecord` and `selectedRecords` are typed `{T}`. The CPE sets `T` from the chosen object (picklist object, SOQL object or collection object). Custom options have no object, so the CPE sets `T` to `Account`, which exists in every org; the record outputs stay empty.
- **Re-hydration.** On reopen the CPE reads `selectorConfigJson` and `sourceRecords` and deep-merges over the defaults. This is what lets a Flow saved with an older config pick up options added later. Saved JSON that does not parse shows an error in the panel instead of being replaced with defaults.
- **Default selection.** The Behavior chapter's **Default selection** writes a Flow resource reference into the component's `value` (single) or `values` (multi) input, so the selector opens with those options selected. In multi mode only a text collection variable is accepted; typed text is refused with an inline error.

## Apex layer

```
NewtonSelectorRuntimeController   @AuraEnabled entry (queryItems, validateQuery)
  └─ NewtonSelectorService        record → ItemDTO mapping
       └─ NewtonSelectorRecordQuery        Database.queryWithBinds(..., USER_MODE)
            └─ NewtonSelectorQueryBuilder  SOQL text + binds; limit/direction/sort rules
                 ├─ NewtonSelectorQueryFieldAccess       describe checks, canonical names
                 └─ NewtonSelectorWhereParser            WHERE text → predicates
                      ├─ NewtonSelectorWhereScanner      tokenizer
                      │    └─ NewtonSelectorWhereQuotedString   quoted-value and escape reader
                      ├─ NewtonSelectorWhereOperatorParser
                      └─ NewtonSelectorQueryValueUtil    type coercion

NewtonSelectorFlowCpeController   @AuraEnabled design-time pickers (object search, field describe)

DTOs: NewtonSelectorQueryDTO (in), NewtonSelectorItemDTO (out), NewtonSelectorQueryValidationResultDTO
Errors: NewtonSelectorException → AuraHandledException at the controller edge
```

Apex is only involved for the SOQL source (runtime) and for the editor's object and field pickers (design time). The other three sources run entirely in the browser. See the [Apex API reference](reference-apex-api.md) and the [security model](explanation-security-model.md).

## Rendering and styling

- **SLDS 2.** All components follow the repo's SLDS 2 rules in `AGENTS.md`: SLDS styling hooks and `--slds-g-*` tokens, BEM class names, no hard-coded colors, spacing or radii.
- **Tile appearance is class-driven.** `ChoiceTile` emits BEM modifier classes (`_size-`, `_aspect-`, `_sel-`, `_elev-`, `_pattern-`, `_ptone-`, `_stone-`, `_corner-`) plus custom-hex CSS variables for the "Custom" color tone. `Group` sets layout variables (`--newton-group-*`, `--newton-tile-pad-*`) from the spacing settings.
- **Icons are local.** `newtonSelectorIcon` renders inline SVG from `lucideIconPaths.js` (about 1,700 Lucide icons), so there is no network fetch and no `lightning-icon` dependency. Names are Lucide icon names, lowercased with `_` read as `-`; unknown names (including SLDS names such as `utility:user`) fall back to a question-mark icon. `npm run generate:lucide-icons` regenerates the catalog and `npm run audit:lucide-icons` guards usage.
- **Accessibility.** Each selector is a `fieldset` whose `legend` is the field label, and the selector help text is linked with `aria-describedby`. Tiles are native radios or checkboxes (visually hidden), so the browser supplies focus, Tab and Space handling. Loading is `role="status"`, and errors are `role="alert"`; the **Try again** button, a standard SLDS neutral button, shows only for SOQL load failures. The Dropdown (`picklist`) layout uses `combobox` / `listbox` / `option` roles with arrow-key, Home/End, Enter/Space and Escape handling. Its combobox and its open listbox are both named by the field label, and Escape or a single-select choice returns focus to it. Dropdown and Dual listbox rows render `ChoiceTile` in presentational mode (no native input); the `role="option"` row carries the semantics. The Dual listbox follows the SLDS dueling picklist: two `role="listbox"` panels (`aria-multiselectable` in multi mode), `role="option"` rows with `aria-selected` for the move highlight, a roving Tab stop, Up/Down/Home/End to move focus, Space to toggle, Shift+arrow and Shift-click to extend, and a polite live announcement after a move.

## Testing architecture

| Layer            | Tooling               | Location                                             |
| ---------------- | --------------------- | ---------------------------------------------------- |
| LWC unit tests   | `sfdx-lwc-jest`       | `lwc/*/__tests__/`                                   |
| Apex unit tests  | Apex test framework   | `classes/*Test.cls`, `NewtonSelectorTestDataFactory` |
| Flow Builder E2E | Playwright + `sf` CLI | `scripts/e2e/flow-builder-newton-selector-e2e.mjs`   |
| Runtime E2E      | Playwright + `sf` CLI | `scripts/e2e/newton-selector-runtime-e2e.mjs`        |

See [How to develop and test](howto-develop-and-test.md).

## Related

- [Design decisions](explanation-design-decisions.md)
- [Security model](explanation-security-model.md)
- [Known limitations](known-limitations.md)
- [Flow component reference](reference-flow-component.md)
