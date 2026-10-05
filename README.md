# Professor Flow | Newton Selector

> A unified, modern choice selector for Salesforce Flow Screens — powered by a point-and-click Custom Property Editor.

![Salesforce API](https://img.shields.io/badge/Salesforce%20API-v66.0-blue?logo=salesforce)
![LWC](https://img.shields.io/badge/LWC-JavaScript-yellow?logo=javascript)
![Apex](https://img.shields.io/badge/Apex-with%20sharing-success?logo=salesforce)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## Table of Contents

- [Documentation](#documentation)
- [Overview](#overview)
- [Features at a Glance](#features-at-a-glance)
- [Data Sources](#data-sources)
- [Layouts](#layouts)
- [Selection Modes](#selection-modes)
- [Visual Customization](#visual-customization)
- [Flow Outputs](#flow-outputs)
- [Component Architecture](#component-architecture)
- [Apex Layer](#apex-layer)
- [Installation](#installation)
- [Development Setup](#development-setup)
- [Testing](#testing)

---

## Documentation

Full guides live in [`docs/`](docs/README.md):

| Need                      | Read                                                                                                                                                                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| What it is, for everyone  | [Overview](docs/overview.md), [Using a Newton Selector](docs/guide-using-the-selector.md)                                                                                                                                                                                                              |
| Build your first selector | [Tutorial](docs/tutorial-first-selector.md)                                                                                                                                                                                                                                                            |
| Do a specific task        | [SOQL](docs/howto-build-a-soql-selector.md), [collections](docs/howto-use-a-record-collection.md), [multi-select](docs/howto-multi-select-and-validation.md), [styling](docs/howto-style-a-selector.md), [outputs](docs/howto-use-outputs-in-a-flow.md), [troubleshooting](docs/howto-troubleshoot.md) |
| Look up an option or API  | [Configuration](docs/reference-configuration.md), [Flow component](docs/reference-flow-component.md), [Apex API](docs/reference-apex-api.md), [WHERE clause](docs/reference-where-clause.md)                                                                                                           |
| Understand the design     | [Architecture](docs/architecture.md), [Design decisions](docs/explanation-design-decisions.md), [Security model](docs/explanation-security-model.md)                                                                                                                                                   |
| Work on the code          | [Develop and test](docs/howto-develop-and-test.md)                                                                                                                                                                                                                                                     |
| Know the rough edges      | [Known limitations](docs/known-limitations.md)                                                                                                                                                                                                                                                         |

---

## Overview

**Newton Selector** replaces plain picklists and radio groups on Flow Screens with a rich, visually customizable selector. Everything -- data source, layout, content, behavior, appearance, and validation -- is configured through a built-in Custom Property Editor (CPE). No code, no formula fields, no hacks.

Drop the `Professor Flow | Newton Selector` component onto any Flow Screen and the CPE walks you through:

1. Where to get the options (picklist, record collection, SOQL query, or static list)
2. How to display them (grid, list, horizontal ribbon, picklist/dropdown, radio cards, card columns, or dual-listbox-style transfer)
3. How they should look (size, aspect ratio, icons, badges, patterns, elevation, spacing, surfaces, and selected states)
4. Whether to allow a manual "Other" value alongside sourced options
5. What the Flow should receive when a user picks something (value, label, selection count, full SObject record)

---

## Features at a Glance

| Capability              | Detail                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **4 data sources**      | Picklist field, Record collection, SOQL query, Custom static list                                                           |
| **7 layouts**           | Grid, List, Horizontal ribbon, Picklist/dropdown, Radio cards, Columns, Dual-listbox-style transfer                         |
| **Selection modes**     | Single and Multi, with optional minimum and maximum selections in multi mode                                                |
| **Auto-advance**        | Automatically navigates to the next screen after a single selection                                                         |
| **Search/filter**       | Inline search bar filters tiles as the user types                                                                           |
| **Select all**          | Select-all and clear-all buttons for multi-select (runtime support; no editor control yet)                                  |
| **None option**         | Configurable --None-- tile that clears the selection (position: start or end)                                               |
| **Manual input**        | Optional "Other" choice with configurable label and min/max character rules                                                 |
| **9 output variables**  | value, values, selectedRecord, selectedRecords, selectedLabel, selectedLabels, allValues, allLabels, selectionCount         |
| **Option overrides**    | Per-option label, sublabel, icon, badge, help text, and hide overrides for Picklist and SOQL sources                        |
| **Sort and limit**      | Sort by label, value, or source order; optional result cap                                                                  |
| **Required validation** | Block flow navigation with a configurable error message                                                                     |
| **Translatable text**   | Built-in end-user text is `Newton_Selector_*` Custom Labels, translatable in Setup                                          |
| **SLDS 2-oriented UI**  | Uses SLDS utilities, design tokens and accessibility patterns. `npm run lint:slds` runs the SLDS linter over the components |

---

## Data Sources

Configure the source once in the CPE; the component handles fetching, normalizing, and rendering.

### Picklist

Reads values from any SObject picklist or multi-select picklist field. Supports record type filtering so only active, record-type-appropriate values appear. Values can be the API name (default) or the label.

### Record Collection

Accepts a Flow record collection variable (`{T[]}`) as input. A field-mapping section in the CPE lets you point Label, Sublabel, Icon, Badge, Help Text, and Value at any field on the collection's SObject -- no Apex required.

### SOQL Query

Issues a server-side SOQL query at runtime via `NewtonSelectorRuntimeController.queryItems`. The CPE exposes:

- **Object selector** -- searchable dropdown of queryable, accessible SObjects (first 80 matches)
- **WHERE builder** -- visual clause builder with field selector, type-aware operator sets, and AND/OR logic
- **Field mapping** -- map any field to label, sublabel, value, icon, badge, and help text
- **ORDER BY** -- field + direction selector
- **LIMIT** -- rows to load, 1 to 2,000 (blank uses 50)
- **Query validation** -- design-time validation via `NewtonSelectorRuntimeController.validateQuery`, which runs the query once and reports the real error if it fails; a SOQL preview card shows the query the editor builds from your settings

All queries run in `USER_MODE` and field-level security is enforced server-side.

### Custom (Static) List

Type options directly into the CPE. Each item has a label, value, sublabel, icon, and badge. Useful for short, stable lists that don't live in the org's data model.

### Manual Input

Manual input is a behavior-level option that can add an "Other" choice to any selector configuration. The admin controls the displayed option label and optional minimum/maximum character limits. If a custom static list has no items, manual input can stand on its own as the only selectable path.

---

## Layouts

| Layout           | Best for                                                                                       |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| **Grid**         | Visual, icon-forward choices; responsive tile grid with configurable column count or auto-fill |
| **List**         | Dense option sets; stacked rows with icon, label, sublabel, and badge                          |
| **Horizontal**   | Timeline steps, status sequences, or any scrollable ribbon of options                          |
| **Dropdown**     | Space-constrained screens; compact combobox-style selector that expands on click               |
| **Radio**        | Accessibility-first flows; card-styled radio group pattern                                     |
| **Columns**      | Multi-select card movement with drag/drop between available and selected columns               |
| **Dual listbox** | Transfer pattern with add and remove controls                                                  |

---

## Selection Modes

| Mode       | Behaviour                                                                                                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Single** | One option selected at a time. Outputs `value`, `selectedRecord`, `selectedLabel`, and `selectionCount`. Auto-advance applies only to this mode.                                                |
| **Multi**  | Any number of options, optionally bounded by **Minimum selections** and **Maximum selections** (Behavior chapter). Outputs `values`, `selectedRecords`, `selectedLabels`, and `selectionCount`. |

Both modes support the `required` flag, which blocks the Flow's Next button until a valid selection is made and shows a configurable error message. **Default selection** (Behavior chapter) pre-selects options from a Flow resource by setting the component's `value` (single) or `values` (multi) input. In multi mode it accepts only a text collection variable.

---

## Visual Customization

All visual settings are managed in the CPE's **04 Appearance** chapter -- no CSS editing required.

### Tile Size and Aspect Ratio

| Size            | Column width |
| --------------- | ------------ |
| Small (default) | 7.5 rem      |
| Medium          | 12 rem       |
| Large           | 16 rem       |

Aspect ratio options: `1:1` (square), `4:3` (landscape), `16:9` (wide), `3:4` (portrait).

### Elevation

Controls the tile card style: `plain`, `subtle`, `outlined`, `raised`, `floating`, or `inset`.

### Selection Indicator

How a selected tile communicates its state:

- `checkmark` -- floating circle badge at the top-right corner
- `fill` -- tile surface fills with brand-weak colour
- `bar` -- thick brand-coloured bar on the leading edge
- `frame` -- inset selected outline (default)
- `ribbon` -- folded corner marker
- `pulse` -- selected halo

### Patterns and Surface Styles

Layered decorative overlays on the tile figure: `dots`, `lines`, `diagonal`, `grid`, `glow`, `noise`, `paper`, `waves`, or `none`. Each pattern can be tinted with a tone (brand, success, warning, error, or a custom hex).

### Badges

Every tile can carry a badge from its data source. The CPE lets you configure position (`top-left`, `top-right`, `bottom-left`, `bottom-right`, `bottom-inline`), shape (`pill` / `square`), and variant (standard SLDS semantic tones plus custom hex).

### Spacing

Grid gap, margin, and padding accept SLDS 2 spacing tokens only (`1`--`9`, `none`, or Auto). Linked toggles apply one value to all sides at once.

---

## Flow Outputs

Every output is available as a Flow resource once the component is placed on a screen.

| Variable          | Type      | Description                                                                                                                        |
| ----------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `value`           | String    | The value of the currently selected option (single mode)                                                                           |
| `values`          | String[]  | All selected values (multi mode)                                                                                                   |
| `selectedRecord`  | SObject   | The source record for the selected option (SOQL: `Id` plus the queried fields; Collection: the record; Custom and Picklist: empty) |
| `selectedRecords` | SObject[] | All selected records (SOQL and Collection sources, multi mode; empty for Custom and Picklist)                                      |
| `selectedLabel`   | String    | Display label of the selected option (single mode)                                                                                 |
| `selectedLabels`  | String[]  | Display labels of all selected options (multi mode)                                                                                |
| `allValues`       | String[]  | Every value rendered by the selector, in display order                                                                             |
| `allLabels`       | String[]  | Every label rendered by the selector, in display order                                                                             |
| `selectionCount`  | Integer   | Number of currently selected options                                                                                               |

---

## Component Architecture

Two entry points share one rendering stack. The Flow screen component renders the selector at runtime. The Custom Property Editor (CPE) configures it in Flow Builder and previews it with the same components.

```
newtonSelectorFlowScreen                  Flow Screen component (runtime entry point)
  +-- newtonSelectorDataSelector          Data loading, source switching, selection state, validate()
        +-- newtonSelectorGroup           Layout renderer, search/select-all, transfer controls
              +-- newtonSelectorChoiceTile    One option (icon, label, sublabel, badge)

newtonSelectorFlowCpe                     Custom Property Editor panel in Flow Builder
  +-- newtonSelectorFlowCpeConfigModal    LightningModal shell and orchestration
        +-- newtonSelectorFlowCpeStudio   Split layout: preview | four scrolling chapters
        +-- newtonSelectorFlowCpeConfigPreview   Live preview (reuses DataSelector with sample data)
        +-- newtonSelectorFlowCpeDataConfig / ContentConfig / BehaviorConfig / AppearanceConfig

Editor controls: ResourceSelector, WhereBuilder, FieldSelector, IconSelector, ChoiceControl,
                 LookupChoiceOption, Toggle, and the shared newtonSelectorCombobox
Primitives:      newtonSelectorIcon (Lucide-style SVG catalog)
Utilities:       newtonSelectorUtilityConfigDefaults, newtonSelectorUtilityDataSources,
                 newtonSelectorFlowCpeUtility{ConfigOptions,ConfigState,ConfigStyles,
                 ConfigValidation,Helpers,SearchHighlight}
```

The editor saves the whole configuration as one JSON string (`selectorConfigJson`) on the Flow screen element. See [Architecture](docs/architecture.md) for the full tree, data flow and design-time flow.

---

## Apex Layer

Apex is used only by the SOQL data source (runtime) and by the editor's object and field pickers (design time). Picklist, collection and custom sources run entirely in the browser.

| Group           | Classes                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Entry points    | `NewtonSelectorRuntimeController` (`queryItems`, `validateQuery`), `NewtonSelectorFlowCpeController` (`searchSObjectTypes`, `searchLookupDatasetFieldsForObject`, `getObjectFields`) |
| Query execution | `NewtonSelectorService`, `NewtonSelectorRecordQuery` (`Database.queryWithBinds` in `USER_MODE`), `NewtonSelectorQueryBuilder` (limits, ordering, bind assembly)                      |
| Validation      | `NewtonSelectorQueryFieldAccess`, `NewtonSelectorQueryValueUtil`                                                                                                                     |
| WHERE parsing   | `NewtonSelectorWhereParser`, `NewtonSelectorWhereScanner`, `NewtonSelectorWhereOperatorParser`                                                                                       |
| CPE describe    | `NewtonSelectorFlowCpeDescribeService`                                                                                                                                               |
| Data and errors | `NewtonSelectorQueryDTO`, `NewtonSelectorItemDTO`, `NewtonSelectorQueryValidationResultDTO`, `NewtonSelectorException`                                                               |

Runtime classes run `with sharing`, object and field names are validated against describe results, every WHERE value is a bind variable (except `INCLUDES`/`EXCLUDES`, which are escaped literals), and results are capped at 2,000 rows. See the [Apex API reference](docs/reference-apex-api.md) and the [security model](docs/explanation-security-model.md).

---

## Installation

### Prerequisites

- [Salesforce CLI](https://developer.salesforce.com/tools/salesforcecli) (sf v2+)
- A Salesforce org (Developer Edition, scratch org, or sandbox)

### Deploy to an existing org

```bash
# Authenticate
sf org login web --alias my-org

# Deploy all metadata
sf project deploy start --source-dir force-app --target-org my-org
```

### Scratch org quick-start

```bash
# Create a scratch org
sf org create scratch \
  --definition-file config/project-scratch-def.json \
  --alias newton-dev \
  --duration-days 30

# Deploy
sf project deploy start --source-dir force-app --target-org newton-dev

# Open the org
sf org open --target-org newton-dev
```

### Post-install

1. Assign a permission set. `Newton_Selector_User` grants what people running a Flow need (the runtime Apex). `Newton_Selector_Admin` adds the editor's object and field pickers for people who build Flows. Users still need object and field access for whatever each selector reads.

   ```bash
   sf org assign permset --name Newton_Selector_User --target-org my-org
   sf org assign permset --name Newton_Selector_Admin --target-org my-org
   ```

2. In Flow Builder, drag **Professor Flow | Newton Selector** onto a Screen element.
3. Click the component to open the CPE and configure your data source, content, behavior, layout, and appearance.

---

## Development Setup

```bash
# Install Node dependencies
npm install

# Run the linter
npm run lint

# Run the SLDS linter over the components
npm run lint:slds

# Format all source files
npm run prettier

# Verify formatting without writing changes
npm run prettier:verify
```

[Husky](https://typicode.github.io/husky/) runs Prettier, ESLint, and related Jest tests against staged files on every commit via `lint-staged`. No additional setup is needed after `npm install`.

---

## Testing

### LWC Unit Tests (Jest)

```bash
# Run all tests once
npm run test:unit

# Watch mode (re-runs on file save)
npm run test:unit:watch

# With coverage report
npm run test:unit:coverage
```

Test files live under `force-app/main/default/lwc/<component>/__tests__/`.

### End-to-end tests (Playwright)

```bash
# Install the Chromium browser used by Playwright
npm run test:e2e:install

# Flow Builder: drive the editor, save, retrieve and debug the Flow
SF_TARGET_ORG=my-org npm run test:e2e:builder

# Runtime: run a multi-screen Flow through every layout, behavior and data source
SF_TARGET_ORG=my-org npm run test:e2e:runtime
```

Both scripts require `SF_TARGET_ORG` and expect `force-app` to be deployed. Each generates its Flow into the `fixtures` package directory, deploys it, removes the local file after the run, and writes `results.json`, `diagnostics.json` and screenshots under `output/playwright/`. See [How to develop and test](docs/howto-develop-and-test.md).

### Apex Tests

```bash
sf apex run test --target-org my-org --result-format human --wait 10
```

Key test classes: `NewtonSelectorRuntimeControllerTest`, `NewtonSelectorServiceTest`, `NewtonSelectorRecordQueryTest`, and `NewtonSelectorFlowCpeControllerTest`. All use `NewtonSelectorTestDataFactory` for consistent setup data.

---

## License

MIT. Copyright (c) 2026 Christiaan Van Der Merwe. See [LICENSE](LICENSE).

The resource picker (`newtonSelectorFlowCpeResourceSelector`), the toggle (`newtonSelectorFlowCpeToggle`) and the merge-field helpers in `newtonSelectorFlowCpeUtilityHelpers` are adapted from [UnofficialSF LightningFlowComponents](https://github.com/UnofficialSF/LightningFlowComponents) (`fsc_flowCombobox`, `fsc_flowCheckbox`, `fsc_flowComboboxUtils`) and remain under the Apache License 2.0. See [NOTICE](NOTICE).
