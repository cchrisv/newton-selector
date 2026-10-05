# Reference: configuration

Every setting in the Newton Selector Custom Property Editor (CPE), its stored key, allowed values and default. Settings are grouped the way the editor groups them: **Data**, **Content**, **Behavior**, **Appearance**.

Admins edit these through the UI. The keys matter when you read the saved Flow metadata, write tests, or hand-edit `selectorConfigJson`. See [How the editor stores your choices](#how-the-editor-stores-your-choices).

## Studio layout

Click **Configure selector** (or **Edit configuration** once configured) on the Newton Selector component in Flow Builder. A large modal titled **Configure Newton Selector** opens.

- **Left:** a live preview. Tabs: **Populated**, **Empty**, **Error**. The title reads `{Layout} · {Single|Multi}`.
- **Right:** chapter tabs (**Data**, **Content**, **Behavior**, **Appearance**) above one scrolling column with the four chapters: **Data** ("Where the options come from"), **Content** ("What the user reads"), **Behavior** ("How users interact") and **Appearance** ("How it looks"). A tab jumps to its chapter. The active chapter's issues sit in a strip under the tabs.
- **Between them:** a draggable splitter. Arrow keys move it 5%, Shift plus arrow moves it 10%.
- **Footer:** **Cancel** and **Save**. Save is disabled while any error exists, and a line beside it says why, for example "1 error to fix · Data: Add at least one option." Warnings never block Save. Nothing is written to the Flow until you click Save. With unsaved changes, Cancel or Esc asks "Discard your unsaved changes?" with **Keep editing** and **Discard changes**; the header X is disabled until then.

The preview never queries your org. Picklist, Collection and SOQL sources preview neutral sample options, captioned "Sample data. Your real options load when the flow runs." A Custom source previews your real options exactly as configured: blank fields stay blank, hidden options are left out, and if every option is hidden the preview shows the empty state. With no options yet, it shows sample options captioned "Sample options until you add your own." Until you pick a source the preview says "Pick a data source to see your selector come to life."

Until you pick a data source, the Behavior chapter shows only "Choose a data source in Data first. Behavior settings appear here then." and the Display options card in Data is hidden. The chapter header and its tab always show.

## Data

### Data source

| UI label       | Value        | Meaning                           |
| -------------- | ------------ | --------------------------------- |
| Picklist       | `picklist`   | Values of a picklist field        |
| Collection     | `collection` | A Flow record collection variable |
| SOQL query     | `sobject`    | A runtime query against an object |
| Custom options | `custom`     | A list you type in                |

Key: `dataSource`. Default: empty (nothing selected).

### Picklist

| UI label        | Key                      | Notes                                                                                                                                                                                                                                                                                                                                      |
| --------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Object          | `picklist.objectApiName` | Required.                                                                                                                                                                                                                                                                                                                                  |
| Picklist field  | `picklist.fieldApiName`  | Required. Only PICKLIST and MULTIPICKLIST fields are offered.                                                                                                                                                                                                                                                                              |
| Record type     | `picklist.recordTypeId`  | Shown only when the object has non-master record types. **Master (all values)** is stored as an empty string and loads the master record type's values; its row reads "Uses every active value of the field". Each other record type shows its ID under its name. The current user's default record type only carries a **Default** badge. |
| Output value as | `picklist.valueSource`   | `apiName` ("API name (default)") or `label`.                                                                                                                                                                                                                                                                                               |

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

| UI label             | Key                        | Default | Notes                                                                                                                  |
| -------------------- | -------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| Object               | `sobject.sObjectApiName`   |         | Choosing a different object resets the WHERE, ORDER BY and field mapping (Label `Name`, Value `Id`, the others blank). |
| Where clause builder | `sobject.whereClause`      | empty   | See the [WHERE reference](reference-where-clause.md).                                                                  |
| Order by             | `sobject.orderByField`     |         | Offers only sortable fields.                                                                                           |
| Direction            | `sobject.orderByDirection` | `ASC`   | `ASC` or `DESC`.                                                                                                       |
| Rows to load         | `sobject.queryLimit`       | 50      | 1 to 2,000. Blank uses 50.                                                                                             |
| Label (required)     | `sobject.labelField`       | `Name`  |                                                                                                                        |
| Value                | `sobject.valueField`       | `Id`    | A record with no value in this field outputs its record Id.                                                            |
| Sublabel             | `sobject.sublabelField`    |         |                                                                                                                        |
| Icon                 | `sobject.iconField`        |         |                                                                                                                        |
| Badge                | `sobject.badgeField`       |         |                                                                                                                        |
| Help text            | `sobject.helpField`        |         |                                                                                                                        |

Once an object is picked, a **SOQL preview** card appears under the Object picker, above the WHERE builder and the field map. It shows the query the editor builds from these settings, with **Validate query** (runs it once against your org and shows the result or the real error) and **Copy query**, which reports its result on its own status line. When the WHERE clause holds Flow values, Validate query checks it with sample values and says so; see [Flow values](reference-where-clause.md#flow-values-merge-fields).

### Custom options

An **Options** card with **Add option** and, per row, Move up, Move down, Duplicate and Delete. Each row has:

| Field       | Key        | Notes                                                                  |
| ----------- | ---------- | ---------------------------------------------------------------------- |
| Hide option | `hidden`   | Hidden rows are skipped at runtime and in the preview.                 |
| Icon        | `icon`     |                                                                        |
| Label       | `label`    |                                                                        |
| Value       | `value`    | Required, and unique among visible options. Save is blocked otherwise. |
| Sublabel    | `sublabel` |                                                                        |
| Badge       | `badge`    |                                                                        |
| Help text   | `helpText` |                                                                        |

Text fields accept merge fields. Row headers count from 1: "Option 1", or "Option 1: <label>" once the option has a label. Validation messages use the same numbers. Custom options carry only the fields above (plus `hidden`); the tile's look always comes from the Appearance chapter.

### Option overrides (Picklist and SOQL only)

Adjust how individual options render without changing the data. Stored in `overrides`, keyed by the option's value. Default `{}`.

- Toggle **Option overrides**: Default or Advanced. Switching back to Default clears every override and offers **Undo** until your next change to the overrides.
- Changing the data source, the picklist object or field, or the SOQL object clears every override, because overrides are keyed by the old source's values. They are gone for good: there is no **Undo** for this.
- Per-row fields: Hide option, Icon, Label override, Sublabel, Badge, Help text.
- Filter box, **Select all shown** (selects only the rows currently rendered), and **Bulk apply · N selected** (Icon, Sublabel, Badge, Help text; Clear and Apply to selected). Bulk apply never changes label or hide.
- A row checked for bulk apply shows as selected, and a row opened for editing shows as expanded, so you can see which rows a bulk apply will change. The **Bulk apply** card is drawn apart from the rows it edits.
- SOQL rows need **Load sample rows** first so the editor has values to key on. Sample rows clear when the object, the WHERE clause, Order by, Direction, Rows to load, or the Label or Value field changes; load them again. When the WHERE clause holds Flow values, sample rows ignore it and the card says "Sample rows ignore the WHERE clause because it uses Flow values."

### Display options (all sources)

| UI label        | Key                     | Values                                                | Default |
| --------------- | ----------------------- | ----------------------------------------------------- | ------- |
| Sort by         | `display.sortBy`        | `none` (Source order), `label`, `value`               | `none`  |
| Direction       | `display.sortDirection` | `asc`, `desc`. Shown only when Sort by is not `none`. | `asc`   |
| Maximum options | `display.limit`         | Positive whole number. Blank means no cap.            | none    |

## Content

All five fields accept merge fields and are always visible.

A blank message, None label or manual option label is saved blank, and the selector shows its Custom Label at run time, so each user sees the translation for their own language. Type your own text to override it for every user.

| UI label                            | Key                 | Default                                                                      |
| ----------------------------------- | ------------------- | ---------------------------------------------------------------------------- |
| Selector label                      | `label`             | empty                                                                        |
| Help text (description under label) | `helpText`          | empty                                                                        |
| Label tooltip (info icon)           | `fieldLevelHelp`    | empty                                                                        |
| No options message                  | `emptyStateMessage` | empty: shows `No options available.` (`Newton_Selector_EmptyStateDefault`)   |
| Load error message                  | `errorStateMessage` | empty: shows `Could not load options.` (`Newton_Selector_ErrorStateDefault`) |

## Behavior

| UI label                         | Key                                             | Values / default                                                                                                                                                                                                                |
| -------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mode (Single / Multi)            | `selectionMode`                                 | `single` (default), `multi`. Choosing Multi switches `autoAdvance` off.                                                                                                                                                         |
| Required                         | `required`                                      | Off by default.                                                                                                                                                                                                                 |
| Error message                    | `customErrorMessage`                            | Optional. Always shown in the Required card, but applied only while Required is on: then it replaces every validation message, including the min/max and manual-input messages.                                                 |
| Auto-advance                     | `autoAdvance`                                   | Off by default. Single mode only.                                                                                                                                                                                               |
| None option                      | `includeNoneOption`                             | Off by default. Works in single and multi.                                                                                                                                                                                      |
| None option label                | `noneOptionLabel`                               | empty: shows `--None--` (`Newton_Selector_NoneOptionDefault`). Shown when None option is on.                                                                                                                                    |
| Position                         | `noneOptionPosition`                            | `start` (default) or `end`.                                                                                                                                                                                                     |
| Manual input                     | `manualInput.enabled`                           | Off by default. Adds an "Other" choice with a text box.                                                                                                                                                                         |
| Manual option label              | `manualInput.label`                             | empty: shows `Other` (`Newton_Selector_ManualOptionDefault`)                                                                                                                                                                    |
| Minimum characters               | `manualInput.minLength`                         | `0`                                                                                                                                                                                                                             |
| Maximum characters               | `manualInput.maxLength`                         | Unlimited                                                                                                                                                                                                                       |
| Select all and Clear all buttons | `showSelectAll`                                 | Off by default. Multi mode only. Adds Select all and Clear all buttons above the options. They are hidden in the editor preview.                                                                                                |
| Search                           | `enableSearch`                                  | Off by default. Adds a filter box above the options.                                                                                                                                                                            |
| Default selection                | Flow input `value` (single) or `values` (multi) | Optional. Single mode: a Flow text resource whose value is selected when the screen opens. Multi mode: a text collection variable only. With manual input off, a value that matches no option is cleared when the options load. |

In multi mode, **Minimum selections** (`minSelections`, blank or 0 means none) and **Maximum selections** (`maxSelections`, blank means no maximum) sit on the Mode card.

**Default selection** is the one Behavior setting that is not stored in `selectorConfigJson`: the editor writes the chosen resource, as a `{!Resource}` reference, to the component's `value` input in single mode or `values` input in multi mode. In multi mode a typed value is refused: the field shows "Pick a text collection variable for multiple default selections." and nothing is written to `values`.

## Appearance

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
| Surface colors      | `surfaceTone`, `surfaceHoverTone`, `surfaceSelectedTone`, `surfaceDisabledTone` | Normal: neutral. Hover: neutral. Selected: brand. Disabled: neutral.                               |
| Selection indicator | `selectionIndicator`                                                            | `checkmark`, `fill`, `bar`, **`frame`**, `ribbon`, `pulse`                                         |
| Pattern overlay     | `pattern`                                                                       | **`none`**, `dots`, `lines`, `diagonal`, `grid`, `glow`, `noise`, `paper`, `waves`                 |
| Pattern colors      | `patternTone`, `patternHoverTone`, `patternSelectedTone`, `patternDisabledTone` | Same four state rows as surface.                                                                   |
| Corner flourish     | `cornerStyle`, `cornerTone`                                                     | **`none`**, `trim`, `brackets`, `dots`, plus one color                                             |

Tone chips: Neutral, Brand, Success, Warning, Error, Violet, Pink, Teal, Custom. Custom reveals a color picker and hex box (stored in the matching `...ToneHex` key).

### Icon

| UI label         | Key             | Values (default in bold)                                                                                                                                                                               |
| ---------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Show icons       | `showIcons`     | **on**. Off hides every icon.                                                                                                                                                                          |
| Icon size        | `iconSize`      | **Auto** (`auto`, scales with the tile size), `xx-small` (0.75rem), `x-small` (1rem), `small` (1.5rem), `medium` (2rem), `large` (3rem)                                                                |
| Icon decoration  | `iconDecor`     | None (`none`), Ring (`ring`, a circle with a thin outer ring), Halo (`halo`, a circle with a soft aura), Medal (`badge`, a circle with a notched rosette rim), **Square** (`square`, a rounded square) |
| Icon style       | `iconStyle`     | Filled, Outlined, **Soft**, Glow. Shown when decoration is not None.                                                                                                                                   |
| Icon shading     | `iconShading`   | **Flat**, Gradient, Emboss. Shown only when style is Filled.                                                                                                                                           |
| Decoration color | `iconTone`      | **brand** or any tone                                                                                                                                                                                  |
| Glyph color      | `iconGlyphTone` | **Auto**, Contrast (white on a Filled decoration, the decoration color otherwise), then the tones                                                                                                      |

### Badge

| UI label    | Key              | Values (default in bold)                                                     |
| ----------- | ---------------- | ---------------------------------------------------------------------------- |
| Show badges | `showBadges`     | **on**                                                                       |
| Position    | `badge.position` | Top left, Top right, Bottom left, Bottom right, **Inline** (`bottom-inline`) |
| Color       | `badge.variant`  | **Neutral**, the tones, plus Inverse                                         |
| Shape       | `badge.shape`    | **Pill**, Square                                                             |

Badge text comes from the data (the badge field, collection map, custom item or override).

### Spacing

| UI label                          | Key                 | Notes                                                                                                                                            |
| --------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Minimum column width              | `minWidth`          | Slider, 6 to 32 rem. Grid and horizontal only.                                                                                                   |
| Horizontal gap                    | `gapH`              | Grid, horizontal, columns, dual listbox.                                                                                                         |
| Vertical gap                      | `gapV`              | Grid, list, picklist, radio, columns, dual listbox.                                                                                              |
| Outer margin / Inner tile padding | `margin`, `padding` | Four sides plus a **Link all margin sides** / **Link all padding sides** toggle (Linked / Per side). Stored as `{top,right,bottom,left,linked}`. |

Gaps and margin are **None** or a token from 1 to 9. Margin defaults to None. Inner tile padding also offers **Auto** (empty, the default), which takes the padding from the tile size.

| Token | 1 (XXS) | 2 (XS) | 3 (S) | 4 (M) | 5 (L) | 6 (XL) | 7 (2XL) | 8 (3XL) | 9 (4XL) |
| ----- | ------- | ------ | ----- | ----- | ----- | ------ | ------- | ------- | ------- |
| Size  | 4px     | 8px    | 12px  | 16px  | 24px  | 32px   | 40px    | 48px    | 56px    |

Each layout's default gaps (set when the layout is first chosen or on **Reset appearance**):

| Layout      | Horizontal | Vertical |
| ----------- | ---------- | -------- |
| grid        | 2          | 2        |
| list        | none       | 1        |
| horizontal  | 2          | none     |
| picklist    | none       | 1        |
| radio       | none       | 1        |
| columns     | 3          | 1        |
| dualListbox | 3          | 1        |

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
- Option 2 needs a value. / Options 2 and 4 need a value. (Custom)
- Option 3 repeats an earlier option's value. (Custom)
- Minimum characters can't be negative.
- Maximum characters must be at least the minimum, and at least 1.
- Maximum selections must be at least the minimum, and at least 1. (Multi mode)
- Finish or remove the highlighted filter condition. (SOQL, when a WHERE condition is only partly filled in, holds a value in the wrong format, or puts a Flow resource in a list)

**Warnings**

- Option 2 needs a label. / Options 2 and 4 need a label. (Custom)

The panel in Flow Builder runs the same checks when you save the Flow, except the WHERE-condition check, plus three of its own: "The saved configuration can't be read. Open Edit configuration to set it up again.", "Choose a data source: click Configure selector." (which replaces "Choose a data source.") and "Finish setup: open Edit configuration and click Save." Those messages appear in a red strip on the panel.

In the WHERE builder, an untouched blank condition is ignored and shows no message. A partly filled condition is highlighted and blocks Save.

## How the editor stores your choices

The Flow screen component has these design-time inputs:

| Input                | Type              | Written by                                                                                                                      |
| -------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `selectorConfigJson` | String            | The CPE. The whole configuration serialized as JSON.                                                                            |
| `sourceRecords`      | `{T[]}`           | The CPE, for the Collection source. A Flow reference to a record collection. Cleared on save when the source is not Collection. |
| `T`                  | Generic SObject   | The CPE, through a generic-type-mapping event.                                                                                  |
| `value` / `values`   | String / String[] | The CPE, from **Default selection**. Optional.                                                                                  |

`T` is set from the picklist object, the SOQL object or the collection's object. Custom options have no object, but Flow still needs `T` because `sourceRecords`, `selectedRecord` and `selectedRecords` are typed `{T}`, so the CPE sets it to `Account`, which exists in every org. For the Custom and Picklist sources the record outputs keep that type but stay empty; use `value` and `selectedLabel` instead.

On reopen, the CPE reads `selectorConfigJson` and deep-merges it over the defaults, so older saved configs gain any newly added settings. Saved JSON that does not parse shows an error in the panel; it is not silently replaced with defaults.

Boolean settings are JSON booleans (`true`, `false`). The strings `"true"` and `"false"` are not accepted.

Merge fields are stored as literal `{!Var}` text inside the JSON, whether typed or picked in a resource selector. Flow resolves them when it passes the string input to the component. A merged value that contains a double quote, backslash or line break breaks the JSON, and the runtime shows the unreadable-configuration error instead of options. For merge fields in the WHERE clause, see [Flow values](reference-where-clause.md#flow-values-merge-fields).

Text resource pickers list text resources plus single record variables. Clicking a record variable, or pressing Right Arrow on it, opens its fields so you can pick a text field (Text, Text Area, Picklist, Email, Phone or URL), and you can go further through lookups (`{!acc.Owner.Name}`). The global variables (`$Record`, `$Record__Prior`, `$User`, `$Profile`, `$UserRole`, `$Flow`, `$System`) work like record variables here: they only open their fields, and the variable itself can't be picked as the value. **Back** (or Left Arrow) returns to the resource list without clearing the value. Pressing Escape or Tab, or clicking outside, while you are inside a record and before you pick a field closes the list and keeps the previous value; the partial path is never saved. The picker works from the keyboard: Up and Down Arrow move through the options, Enter picks one, Right and Left Arrow open and leave a resource, and Escape closes the list.

## Related

- [Flow component reference](reference-flow-component.md)
- [How to style a selector](howto-style-a-selector.md)
- [Architecture](architecture.md)
- [Known limitations](known-limitations.md)
