# Reference: configuration

Every setting in the Newton Selector Custom Property Editor (CPE), its stored key, allowed values and default. Settings are grouped the way the editor groups them: **01 Data**, **02 Content**, **03 Behavior**, **04 Appearance**.

Admins edit these through the UI. The keys matter when you read the saved Flow metadata, write tests, or hand-edit `selectorConfigJson`. See [How the editor stores your choices](#how-the-editor-stores-your-choices).

## Studio layout

Click **Configure selector** (or **Edit configuration** once configured) on the Newton Selector component in Flow Builder. A large modal titled **Configure Newton Selector** opens.

- **Left:** a live preview. Tabs: **Populated**, **Empty**, **Error**. The title reads `{Layout} · {Single|Multi}`.
- **Right:** one scrolling column with four chapters: **01 Data** ("Where the tiles come from"), **02 Content** ("What the user reads"), **03 Behavior** ("How users interact") and **04 Appearance** ("How it looks").
- **Between them:** a draggable splitter. Arrow keys move it 5%, Shift plus arrow moves it 10%.
- **Footer:** **Cancel** and **Save**. Save is disabled while any error exists, and a line beside it says why, for example "1 error to fix · Data: Add at least one option." Warnings never block Save. Nothing is written to the Flow until you click Save. With unsaved changes, Cancel or Esc asks "Discard your unsaved changes?" with **Keep editing** and **Discard changes**; the header X is disabled until then.

The preview uses neutral sample options and never queries your org. A Custom source previews your real items. Until you pick a source the preview says "Pick a data source to see your selector come to life."

The 03 Behavior chapter and the Display options card stay hidden until you pick a data source.

## 01 Data

### Data source

| UI label       | Value        | Meaning                           |
| -------------- | ------------ | --------------------------------- |
| Picklist       | `picklist`   | Values of a picklist field        |
| Collection     | `collection` | A Flow record collection variable |
| SOQL query     | `sobject`    | A runtime query against an object |
| Custom options | `custom`     | A list you type in                |

Key: `dataSource`. Default: empty (nothing selected).

### Picklist

| UI label        | Key                      | Notes                                                                                           |
| --------------- | ------------------------ | ----------------------------------------------------------------------------------------------- |
| Object          | `picklist.objectApiName` | Required.                                                                                       |
| Picklist field  | `picklist.fieldApiName`  | Required. Only PICKLIST and MULTIPICKLIST fields are offered.                                   |
| Record Type     | `picklist.recordTypeId`  | Shown only when the object has non-master record types. "Default" is stored as an empty string. |
| Output value as | `picklist.valueSource`   | `apiName` ("API name (default)") or `label`.                                                    |

### Collection

| UI label               | Key                            | Notes                                                                                                                |
| ---------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Flow record collection | Flow input `sourceRecords`     | Required. Only SObject collections are offered. Changing it to another object, or clearing it, blanks the field map. |
| Label                  | `collection.fieldMap.label`    | Required.                                                                                                            |
| Value                  | `collection.fieldMap.value`    |                                                                                                                      |
| Sublabel               | `collection.fieldMap.sublabel` |                                                                                                                      |
| Icon                   | `collection.fieldMap.icon`     |                                                                                                                      |
| Badge                  | `collection.fieldMap.badge`    |                                                                                                                      |
| Help text              | `collection.fieldMap.helpText` |                                                                                                                      |

### SOQL query

| UI label             | Key                        | Default | Notes                                                 |
| -------------------- | -------------------------- | ------- | ----------------------------------------------------- |
| SObject              | `sobject.sObjectApiName`   |         | Choosing one resets the WHERE and ORDER BY.           |
| Where clause builder | `sobject.whereClause`      | empty   | See the [WHERE reference](reference-where-clause.md). |
| Order by             | `sobject.orderByField`     |         |                                                       |
| Direction            | `sobject.orderByDirection` | `ASC`   | `ASC` or `DESC`.                                      |
| Rows to load         | `sobject.limit`            | 50      | 1 to 2,000. Blank uses 50.                            |
| Label (required)     | `sobject.labelField`       | `Name`  |                                                       |
| Value                | `sobject.valueField`       | `Id`    |                                                       |
| Sublabel             | `sobject.sublabelField`    |         |                                                       |
| Icon                 | `sobject.iconField`        |         |                                                       |
| Badge                | `sobject.badgeField`       |         |                                                       |
| Help text            | `sobject.helpField`        |         |                                                       |

Under the field map, a **SOQL preview** card shows the query the editor builds from these settings, with **Validate query** (runs it once against your org and shows the result or the real error) and **Copy query**.

### Custom options

An **Options** card with **Add option** and, per row, Move up, Move down, Duplicate and Delete. Each row has:

| Field       | Key        | Notes                                                     |
| ----------- | ---------- | --------------------------------------------------------- |
| Hide option | `hidden`   | Hidden rows are skipped at runtime and in the preview.    |
| Icon        | `icon`     |                                                           |
| Label       | `label`    |                                                           |
| Value       | `value`    | Always fill this in. A blank value stays an empty string. |
| Sublabel    | `sublabel` |                                                           |
| Badge       | `badge`    |                                                           |
| Help text   | `helpText` |                                                           |

Text fields accept merge fields. Row headers count from 0 ("Option · 0"). Custom options carry only the fields above (plus `hidden`); the tile's look always comes from the Appearance chapter.

### Option overrides (Picklist and SOQL only)

Adjust how individual options render without changing the data. Stored in `overrides`, keyed by the option's value. Default `{}`.

- Toggle **Option overrides**: Default or Advanced. Switching back to Default clears every override and offers **Undo** until your next change to the overrides.
- Per-row fields: Hide option, Icon, Label override, Subtitle, Badge, Help text.
- Filter box, **Select all shown**, and **Bulk apply · N selected** (Icon, Sublabel, Badge, Help text; Clear and Apply to selected). Bulk apply never changes label or hide.
- A row checked for bulk apply shows as selected, and a row opened for editing shows as expanded, so you can see which rows a bulk apply will change. The **Bulk apply** card is drawn apart from the rows it edits.
- SOQL rows need **Load sample rows** first so the editor has values to key on.

### Display options (all sources)

| UI label        | Key                     | Values                                                | Default |
| --------------- | ----------------------- | ----------------------------------------------------- | ------- |
| Sort by         | `display.sortBy`        | `none` (Source order), `label`, `value`               | `none`  |
| Direction       | `display.sortDirection` | `asc`, `desc`. Shown only when Sort by is not `none`. | `asc`   |
| Maximum options | `display.limit`         | Number 0 or more. Blank means no cap.                 | none    |

## 02 Content

All five fields accept merge fields and are always visible.

A blank message, None label or manual option label is saved blank, and the selector shows its Custom Label at run time, so each user sees the translation for their own language. Type your own text to override it for every user.

| UI label                            | Key                 | Default                                                                      |
| ----------------------------------- | ------------------- | ---------------------------------------------------------------------------- |
| Selector label                      | `label`             | empty                                                                        |
| Help text (description under label) | `helpText`          | empty                                                                        |
| Label tooltip (info icon)           | `fieldLevelHelp`    | empty                                                                        |
| No options message                  | `emptyStateMessage` | empty: shows `No options available.` (`Newton_Selector_EmptyStateDefault`)   |
| Load error message                  | `errorStateMessage` | empty: shows `Could not load options.` (`Newton_Selector_ErrorStateDefault`) |

## 03 Behavior

| UI label              | Key                                             | Values / default                                                                                                                        |
| --------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Mode (Single / Multi) | `selectionMode`                                 | `single` (default), `multi`. Choosing Multi switches `autoAdvance` off.                                                                 |
| Required              | `required`                                      | Off by default.                                                                                                                         |
| Error message         | `customErrorMessage`                            | Shown only when Required is on. Optional. Replaces every validation message.                                                            |
| Auto-advance          | `autoAdvance`                                   | Off by default. Single mode only.                                                                                                       |
| None option           | `includeNoneOption`                             | Off by default. Works in single and multi.                                                                                              |
| None option label     | `noneOptionLabel`                               | empty: shows `--None--` (`Newton_Selector_NoneOptionDefault`). Shown when None option is on.                                            |
| Position              | `noneOptionPosition`                            | `start` (default) or `end`.                                                                                                             |
| Manual input          | `manualInput.enabled`                           | Off by default. Adds an "Other" choice with a text box.                                                                                 |
| Manual option label   | `manualInput.label`                             | empty: shows `Other` (`Newton_Selector_ManualOptionDefault`)                                                                            |
| Minimum characters    | `manualInput.minLength`                         | `0`                                                                                                                                     |
| Maximum characters    | `manualInput.maxLength`                         | Unlimited                                                                                                                               |
| Search                | `enableSearch`                                  | Off by default. Adds a filter box above the options.                                                                                    |
| Default selection     | Flow input `value` (single) or `values` (multi) | Optional. Single mode: a Flow text resource whose value is selected when the screen opens. Multi mode: a text collection variable only. |

In multi mode, **Minimum selections** (`minSelections`, blank or 0 means none) and **Maximum selections** (`maxSelections`, blank means no maximum) sit on the Selection mode card.

**Default selection** is the one Behavior setting that is not stored in `selectorConfigJson`: the editor writes the chosen resource, as a `{!Resource}` reference, to the component's `value` input in single mode or `values` input in multi mode. In multi mode a typed value is refused: the field shows "Pick a text collection variable for multiple default selections." and nothing is written to `values`. `showSelectAll` exists in the config and the runtime honors it, but the editor has no control for it; set it by editing `selectorConfigJson`. See [Known limitations](known-limitations.md#no-editor-control-for-select-all).

## 04 Appearance

All keys below live under `gridConfig` except `layout` and `layoutGeometry`.

**Changing the layout keeps styling.** Only the geometry keys (`minWidth`, `size`, `aspectRatio`, `columns`, `gapH`, `gapV`) change: each layout's geometry is remembered in the top-level `layoutGeometry` object (keyed by layout) and restored when you switch back; a layout used for the first time gets its preset. **Reset appearance** (Layout style card) resets the whole `gridConfig` to the current layout's defaults and clears `layoutGeometry`; **Undo** restores both until the next appearance change.

### Layout and shape

| UI label     | Key           | Values (default in bold)                                                          |
| ------------ | ------------- | --------------------------------------------------------------------------------- |
| Layout       | `layout`      | **`grid`**, `list`, `horizontal`, `picklist`, `radio`, `columns`, `dualListbox`   |
| Tile size    | `size`        | **`small`** (7.5 rem), `medium` (12 rem), `large` (16 rem). Also sets `minWidth`. |
| Aspect ratio | `aspectRatio` | **`1:1`**, `4:3`, `16:9`, `3:4`. Grid and horizontal only.                        |
| Column count | `columns`     | Auto (default) or 1 to 6. Grid only.                                              |

The UI labels for the layouts are Grid, List, Horizontal, **Dropdown** (the `picklist` value), Radio, Columns and **Dual listbox** (the `dualListbox` value).

### Tile surface and state

| UI label            | Key                                                                             | Values (default in bold)                                                                           |
| ------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Tile elevation      | `elevation`                                                                     | `plain`, `subtle` (Subtle), **`outlined`**, `raised`, `floating`, `inset`                          |
| Surface style       | `surfaceStyle`                                                                  | **`solid`**, `gradient-top` (Top fade), `gradient-radial` (Spotlight), `gradient-diagonal`, `tint` |
| Surface colors      | `surfaceTone`, `surfaceHoverTone`, `surfaceSelectedTone`, `surfaceDisabledTone` | Normal: neutral. Hover: falls back to normal. Selected: brand. Disabled: neutral.                  |
| Selection indicator | `selectionIndicator`                                                            | `checkmark`, `fill`, `bar`, **`frame`**, `ribbon`, `pulse`                                         |
| Pattern overlay     | `pattern`                                                                       | **`none`**, `dots`, `lines`, `diagonal`, `grid`, `glow`, `noise`, `paper`, `waves`                 |
| Pattern colors      | `patternTone`, `patternHoverTone`, `patternSelectedTone`, `patternDisabledTone` | Same four state rows as surface.                                                                   |
| Corner flourish     | `cornerStyle`, `cornerTone`                                                     | **`none`**, `trim`, `brackets`, `dots`, plus one color                                             |

Tone chips: Neutral, Brand, Success, Warning, Error, Violet, Pink, Teal, Custom. Custom reveals a color picker and hex box (stored in the matching `...ToneHex` key).

### Icon

| UI label         | Key             | Values (default in bold)                                                                        |
| ---------------- | --------------- | ----------------------------------------------------------------------------------------------- |
| Show icons       | `showIcons`     | **on**. Off hides every icon.                                                                   |
| Icon size        | `iconSize`      | **Auto** (`auto`, scales with the tile size), `xx-small`, `x-small`, `small`, `medium`, `large` |
| Icon decoration  | `iconDecor`     | None, Ring, Halo, Medal, **Square**                                                             |
| Icon style       | `iconStyle`     | Filled, Outlined, **Soft**, Glow. Shown when decoration is not None.                            |
| Icon shading     | `iconShading`   | **Flat**, Gradient, Emboss. Shown only when style is Filled.                                    |
| Decoration color | `iconTone`      | **brand** or any tone                                                                           |
| Glyph color      | `iconGlyphTone` | **Auto**, Contrast, then the tones                                                              |

### Badge

| UI label    | Key              | Values (default in bold)                                                     |
| ----------- | ---------------- | ---------------------------------------------------------------------------- |
| Show badges | `showBadges`     | **on**                                                                       |
| Position    | `badge.position` | Top left, Top right, Bottom left, Bottom right, **Inline** (`bottom-inline`) |
| Color       | `badge.variant`  | **Neutral**, the tones, plus Inverse                                         |
| Shape       | `badge.shape`    | **Pill**, Square                                                             |

Badge text comes from the data (the badge field, collection map, custom item or override).

### Spacing

| UI label                          | Key                 | Notes                                                                                    |
| --------------------------------- | ------------------- | ---------------------------------------------------------------------------------------- |
| Minimum column width              | `minWidth`          | Slider, 6 to 32 rem. Grid and horizontal only.                                           |
| Horizontal gap                    | `gapH`              | Grid, horizontal, columns, multi-select.                                                 |
| Vertical gap                      | `gapV`              | Grid, list, picklist, radio, columns, multi-select.                                      |
| Outer margin / Inner tile padding | `margin`, `padding` | Four sides plus a **Link all sides** toggle. Stored as `{top,right,bottom,left,linked}`. |

Spacing values are **Auto** (empty), **None**, or a token from 1 to 9:

| Token | 1 (XXS) | 2 (XS) | 3 (S) | 4 (M) | 5 (L) | 6 (XL) | 7 (2XL) | 8 (3XL) | 9 (4XL) |
| ----- | ------- | ------ | ----- | ----- | ----- | ------ | ------- | ------- | ------- |
| Size  | 4px     | 8px    | 12px  | 16px  | 20px  | 24px   | 32px    | 40px    | 48px    |

When a gap is Auto, each layout applies its own preset at runtime:

| Layout      | Horizontal | Vertical |
| ----------- | ---------- | -------- |
| grid        | 2          | 2        |
| list        | none       | 1        |
| horizontal  | 2          | none     |
| picklist    | none       | 1        |
| radio       | none       | 1        |
| columns     | 3          | 1        |
| dualListbox | 3          | 1        |

List, picklist, radio, columns and dualListbox default to `minWidth: 100%` and `aspectRatio: auto`.

## Validation

Only the Data and Behavior chapters produce issues. Errors block Save. Warnings do not.

**Errors**

- Choose a data source.
- Choose the object that has the picklist field. (Picklist)
- Choose the picklist field. (Picklist)
- Choose the record collection variable. (Collection)
- Choose the field to show as each option's label. (Collection)
- Choose the object to query. (SOQL)
- Add at least one option. (Custom, only when manual input is off.)
- Minimum characters can't be negative.
- Maximum characters must be at least the minimum, and at least 1.
- Maximum selections must be at least the minimum, and at least 1. (Multi mode)
- Finish or remove the highlighted filter condition. (SOQL, when a WHERE condition is only partly filled in)

**Warnings**

- Option 2 needs a label. / Options 2 and 4 need a label. (Custom)

The panel in Flow Builder runs the same checks when you save the Flow, plus two of its own: "Choose a data source: click Configure selector." and "Finish setup: open Edit configuration and click Save." Those messages appear in a red strip on the panel.

In the WHERE builder, an untouched blank condition is ignored and shows no message. A partly filled condition is highlighted and blocks Save.

## How the editor stores your choices

The Flow screen component has these design-time inputs:

| Input                | Type              | Written by                                                                   |
| -------------------- | ----------------- | ---------------------------------------------------------------------------- |
| `selectorConfigJson` | String            | The CPE. The whole configuration serialized as JSON.                         |
| `sourceRecords`      | `{T[]}`           | The CPE, for the Collection source. A Flow reference to a record collection. |
| `T`                  | Generic SObject   | The CPE, through a generic-type-mapping event.                               |
| `value` / `values`   | String / String[] | The CPE, from **Default selection**. Optional.                               |

`T` is set from the picklist object, the SOQL object or the collection's object. For Custom options it falls back to `Account`.

On reopen, the CPE reads `selectorConfigJson` and deep-merges it over the defaults, so older saved configs gain any newly added settings. Saved JSON that does not parse shows an error in the panel; it is not silently replaced with defaults.

Boolean settings are JSON booleans (`true`, `false`). The strings `"true"` and `"false"` are not accepted.

Merge fields are stored as literal `{!Var}` text inside the JSON, whether typed or picked in a resource selector. Flow resolves them when it passes the string input to the component.

## Related

- [Flow component reference](reference-flow-component.md)
- [How to style a selector](howto-style-a-selector.md)
- [Architecture](architecture.md)
- [Known limitations](known-limitations.md)
