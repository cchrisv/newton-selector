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

The editor also reuses the runtime pieces for its own controls. The choice controls in the editor are built from `Group` and `ChoiceTile`, so the editor's own tile pickers look and behave like the product.

## Component tree

The names below are the actual bundles under `force-app/main/default/lwc/`.

```
newtonSelectorFlowScreen                  Flow Screen entry point (lightning__FlowScreen)
  └─ newtonSelectorDataSelector           Loads and normalizes data; selection state; validate()
       └─ newtonSelectorGroup             Renders one of 7 layouts; search, select-all, transfer UI
            ├─ newtonSelectorChoiceTile   One option: icon, label, sublabel, badge, appearance
            │    └─ newtonSelectorIcon    Lucide-style SVG icon renderer
            ├─ newtonSelectorCombobox     Dropdown shell for the Dropdown layout
            └─ newtonSelectorFlowCpeLookupChoiceOption

newtonSelectorFlowCpe                     Panel in Flow Builder; summary + validate(); opens the modal
  └─ newtonSelectorFlowCpeConfigModal     LightningModal; owns the working copy and Save
       ├─ newtonSelectorFlowCpeStudio     Split layout: preview | scrolling chapters; splitter
       ├─ newtonSelectorFlowCpeConfigPreview     Preview with state tabs, uses DataSelector
       ├─ newtonSelectorFlowCpeDataConfig        Chapter 01: sources, field maps, overrides, display
       ├─ newtonSelectorFlowCpeContentConfig     Chapter 02: label, help, empty/error text
       ├─ newtonSelectorFlowCpeBehaviorConfig    Chapter 03: mode, required, none, manual, search
       └─ newtonSelectorFlowCpeAppearanceConfig  Chapter 04: layout and all visual options

Editor controls (used inside the chapters)
  newtonSelectorFlowCpeWhereBuilder       Visual SOQL WHERE builder
  newtonSelectorFlowCpeResourceSelector   Flow resource / merge-field combobox
  newtonSelectorFlowCpeFieldSelector      Object-scoped field picker
  newtonSelectorFlowCpeIconSelector       Icon picker over the Lucide catalog
  newtonSelectorFlowCpeChoiceControl      Labeled picklist (built on Combobox)
  newtonSelectorFlowCpeLookupChoiceOption Row renderer for lookup-style dropdowns
  newtonSelectorFlowCpeToggle             Two-state toggle
  newtonSelectorCombobox                  Shared combobox shell

Pure-JS utility bundles (no template)
  newtonSelectorUtilityConfigDefaults     defaultSelectorConfig(): the single source of defaults
  newtonSelectorUtilityDataSources        Normalizers for all four sources; sort/limit helpers
  newtonSelectorFlowCpeUtilityConfigOptions     Option metadata (labels, values) for editor controls
  newtonSelectorFlowCpeUtilityConfigState       Immutable path-patch helpers; query config mapping
  newtonSelectorFlowCpeUtilityConfigValidation  Issue generation; what blocks Save
  newtonSelectorFlowCpeUtilityConfigStyles      Style token helpers (CSS-only bundle)
  newtonSelectorFlowCpeUtilityHelpers           Flow Builder context helpers (types, merge fields)
  newtonSelectorFlowCpeUtilitySearchHighlight   Search match highlighting
```

`newtonSelectorFlowCpeConfigModal` keeps only orchestration, save handling and cross-chapter state. Chapter bodies, validation, state patching and preview are separate modules so each can be tested alone. Most have Jest tests under their `__tests__/` folder.

## Runtime data flow

```
FlowScreen            DataSelector                         Apex / platform
    │  selectorConfigJson │                                      │
    │  (parsed + merged   │                                      │
    │   over defaults)    │                                      │
    ├────── config ──────►│                                      │
    │                     │  by dataSource:                      │
    │                     │   picklist ──► getPicklistValues     │
    │                     │               wire                   │
    │                     │   collection ► normalize in memory   │
    │                     │   custom ────► normalize in memory   │
    │                     │   sobject ───► queryItems(configJson)├──► USER_MODE SOQL
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
 FlowNavigationNextEvent       (auto-advance)                    │
```

**1. Config in.** `FlowScreen` parses `selectorConfigJson`, deep-merges it over `defaultSelectorConfig()` and passes sub-objects to `DataSelector`. JSON that does not parse shows the error state instead of options. An unknown layout becomes `grid`. Boolean settings must be JSON booleans; the strings `"true"` and `"false"` are not read as booleans.

**2. Load.** `DataSelector` picks a loader by `dataSource`:

| Source     | Mechanism                                                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| picklist   | `getPicklistValues` wire adapter. Uses the configured record type, else the master record type `012000000000000AAA`.                           |
| collection | Synchronous. Maps each record through the configured field map.                                                                                |
| custom     | Synchronous. Drops `hidden` items. A missing value (`null` or not set) defaults to the item's index; an empty string stays `""`.               |
| sobject    | Imperative call to `NewtonSelectorRuntimeController.queryItems` (cacheable). Re-runs when the config changes; a failure shows the error state. |

**3. Shape.** Every source normalizes to the same item: `{ id, label, sublabel, icon, badge, helpText, value, disabled, ...}`. After loading, items go through a fixed pipeline: item overrides (picklist, SOQL and custom only), sort and limit, the optional None entry, then the optional manual "Other" entry (always last, sentinel value `__newton_manual_input__`).

**4. Render.** `Group` chooses a layout and renders `ChoiceTile`s. Search is client-side over label, sublabel and help text.

**5. Selection out.** `Group` fires `selectionchange`; `DataSelector` turns it into `valuechange` (the selected value, label and record) and `itemschange` (everything rendered). `FlowScreen` converts those into `FlowAttributeChangeEvent`s for the [output variables](reference-flow-component.md#outputs). The typed record outputs (`selectedRecord`, `selectedRecords`) carry records only for the SOQL and Collection sources; Custom and Picklist options have no record, so they stay empty.

**6. Validation.** Flow calls `validate()` on the screen component. It delegates to `DataSelector`, which checks required, manual-input length and min/max selection. If the admin set `customErrorMessage`, it replaces every message.

**7. Auto-advance.** In single mode with `autoAdvance` on and a non-empty value, `FlowScreen` waits 150 ms (reset on each change) then fires `FlowNavigationNextEvent`. Choosing None never advances, and typing in the manual "Other" box never advances.

### Events between components

| Event             | From → To                 | Detail                                              |
| ----------------- | ------------------------- | --------------------------------------------------- |
| `cardselect`      | ChoiceTile → Group        | `{ value, id }`                                     |
| `selectionchange` | Group → DataSelector      | `{ values, items, manualValue }`                    |
| `valuechange`     | DataSelector → FlowScreen | `{ value, values, label, labels, record, records }` |
| `itemschange`     | DataSelector → FlowScreen | `{ values, labels }`                                |

All four bubble but are not composed, so they stop at the component boundary that handles them.

## Design-time flow

```
open modal ──► working copy of config (deep clone)
                  │
   edit control ──► patch helper (immutable path set)  ──► re-run validation ──► update preview
                  │
   Save ──► (disabled while any error) ──► return config to the panel
                  │
panel dispatches:
   configuration_editor_input_value_changed  name=sourceRecords      (if changed)
   configuration_editor_input_value_changed  name=selectorConfigJson  JSON.stringify(config)
   configuration_editor_generic_type_mapping_changed typeName=T       typeValue=<object API name>
```

- **Edits stay local.** The modal works on a copy. With unsaved changes, Cancel and Esc ask before discarding it (the header X is disabled until then).
- **Layout changes keep styling.** Switching layout swaps only the geometry keys of `gridConfig` and remembers each layout's geometry in `layoutGeometry`.
- **The preview never queries data.** It uses neutral sample options, or your real items for the Custom source. Only the **Validate query** button and the SOQL field pickers call Apex from the editor.
- **Generic type `T`.** The component is declared with `<propertyType name="T" extends="SObject">` so Flow knows the record type of `selectedRecord` and `sourceRecords`. The CPE sets `T` from the chosen object (picklist object, SOQL object or collection object), falling back to `Account` for Custom options.
- **Re-hydration.** On reopen the CPE reads `selectorConfigJson` and `sourceRecords` and deep-merges over the defaults. This is what lets a Flow saved with an older config pick up options added later. Saved JSON that does not parse shows an error in the panel instead of being replaced with defaults.
- **Default selection.** The Behavior chapter's **Default selection** writes a Flow resource reference into the component's `value` (single) or `values` (multi) input, so the selector opens with those options selected.

## Apex layer

```
NewtonSelectorRuntimeController   @AuraEnabled entry (queryItems, validateQuery)
  └─ NewtonSelectorService        record → ItemDTO mapping
       └─ NewtonSelectorRecordQuery        Database.queryWithBinds(..., USER_MODE)
            └─ NewtonSelectorQueryBuilder  SOQL text + binds; limit/direction/sort rules
                 ├─ NewtonSelectorQueryFieldAccess       describe checks, canonical names
                 └─ NewtonSelectorWhereParser            WHERE text → predicates
                      ├─ NewtonSelectorWhereScanner      tokenizer
                      ├─ NewtonSelectorWhereOperatorParser
                      └─ NewtonSelectorQueryValueUtil    type coercion

NewtonSelectorFlowCpeController   @AuraEnabled design-time pickers
  └─ NewtonSelectorFlowCpeDescribeService

DTOs: NewtonSelectorQueryDTO (in), NewtonSelectorItemDTO (out), NewtonSelectorQueryValidationResultDTO
Errors: NewtonSelectorException → AuraHandledException at the controller edge
```

Apex is only involved for the SOQL source (runtime) and for the editor's object and field pickers (design time). The other three sources run entirely in the browser. See the [Apex API reference](reference-apex-api.md) and the [security model](explanation-security-model.md).

## Rendering and styling

- **SLDS 2.** All components follow the repo's SLDS 2 rules in `AGENTS.md`: SLDS styling hooks and `--slds-g-*` tokens, BEM class names, no hard-coded colors, spacing or radii.
- **Tile appearance is class-driven.** `ChoiceTile` emits BEM modifier classes (`_size-`, `_aspect-`, `_sel-`, `_elev-`, `_pattern-`, `_ptone-`, `_stone-`, `_corner-`) plus custom-hex CSS variables for the "Custom" color tone. `Group` sets layout variables (`--newton-group-*`, `--newton-tile-pad-*`) from the spacing settings.
- **Icons are local.** `newtonSelectorIcon` renders inline SVG from `lucideIconPaths.js` (about 1,700 Lucide icons), so there is no network fetch and no `lightning-icon` dependency. Names are Lucide icon names, lowercased with `_` read as `-`; unknown names (including SLDS names such as `utility:user`) fall back to a question-mark icon. `npm run generate:lucide-icons` regenerates the catalog and `npm run audit:lucide-icons` guards usage.
- **Accessibility.** Each tile wraps a visually hidden native radio or checkbox, so the browser supplies focus, Tab and Space handling. Groups use `radiogroup` (single) or `group` (multi). Loading is `role="status"`, errors are `role="alert"` with a retry button, and the Dropdown (`picklist`) layout uses `combobox` / `listbox` / `option` roles with arrow-key, Home/End, Enter/Space and Escape handling. Help text is linked with `aria-describedby`.

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
