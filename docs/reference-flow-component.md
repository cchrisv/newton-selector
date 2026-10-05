# Reference: the Flow screen component

The contract between Newton Selector and your Flow: the inputs it reads, the outputs it writes, what it validates, and when it moves the Flow forward.

- **Label in Flow Builder:** Professor Flow | Newton Selector
- **Bundle:** `newtonSelectorFlowScreen`
- **Target:** `lightning__FlowScreen`
- **API version:** 66.0
- **Custom Property Editor:** `c-newton-selector-flow-cpe`

## Inputs

| Name                 | Type     | Direction    | Set by                                                                                       |
| -------------------- | -------- | ------------ | -------------------------------------------------------------------------------------------- |
| `selectorConfigJson` | String   | Input only   | The CPE. Do not edit by hand in normal use.                                                  |
| `sourceRecords`      | `{T[]}`  | Input only   | The CPE, for the Collection data source.                                                     |
| `value`              | String   | Input/output | Optional. Default `""`. Set by **Default selection** in single mode; read back as an output. |
| `values`             | String[] | Input/output | Optional. Default `[]`. Set by **Default selection** in multi mode; read back as an output.  |

`T` is a generic SObject type, set automatically by the editor from the object you picked.

## Outputs

All outputs are available as Flow resources once the component is on a screen. Single mode fills the singular outputs. Multi mode fills the plural ones.

| Output            | Type     | Single | Multi | What it holds                                                           |
| ----------------- | -------- | :----: | :---: | ----------------------------------------------------------------------- |
| `value`           | String   |  yes   |       | The selected option's value                                             |
| `values`          | String[] |        |  yes  | The selected options' values                                            |
| `selectedLabel`   | String   |  yes   |       | Display label of the selected option                                    |
| `selectedLabels`  | String[] |        |  yes  | Display labels of the selected options                                  |
| `selectedRecord`  | `{T}`    |  yes   |       | The selected option's source record (see [note](#about-selectedrecord)) |
| `selectedRecords` | `{T[]}`  |        |  yes  | The selected options' source records                                    |
| `selectionCount`  | Integer  |  yes   |  yes  | How many options are selected (`0` or `1` in single mode)               |
| `allValues`       | String[] |  yes   |  yes  | Every value currently rendered, in display order                        |
| `allLabels`       | String[] |  yes   |  yes  | Every label currently rendered, in display order                        |

Details worth knowing:

- Outputs are written with `FlowAttributeChangeEvent` each time the selection changes.
- `allValues` and `allLabels` are written whenever the option list is rebuilt, including at first load. They **include** the None entry (value `""`) and the manual-input entry (value `__newton_manual_input__`) when those are enabled.
- A pre-selected `value` or `values` (from **Default selection**) shows those options selected. Nothing is written back until the user acts.
- Choosing the None option sets `value` to `""`, `selectedLabel` to `""` and `selectionCount` to `0`.
- When a user picks the manual "Other" option, `value` (or the entry in `values`) is the text they typed, the label is the manual label, and `selectedRecord` is null.
- For picklist sources, `value` is the API name by default, or the label if you set **Output value as** to Label.

### About `selectedRecord`

For SOQL and Collection sources, Flow receives the source record. SOQL records carry only `Id` and the fields the selector queries (label, value, sublabel, icon, badge and help fields). Custom and Picklist sources have no record, so `selectedRecord` and `selectedRecords` stay empty. Use `value` with a Get Records element when you need other fields.

## Validation

Flow calls the component's `validate()` when the user clicks Next. If it returns an error, Flow stays on the screen and shows the message.

| Rule                       | Message                                     | Applies when                                                    |
| -------------------------- | ------------------------------------------- | --------------------------------------------------------------- |
| Required, nothing selected | `Please make a selection.`                  | **Required** is on. Picking None counts as nothing.             |
| Manual option empty        | `Enter a value for the manual option.`      | Manual option is selected                                       |
| Manual text too short      | `Enter at least {n} character(s).`          | Manual minimum set                                              |
| Manual text too long       | `Enter no more than {n} character(s).`      | Manual maximum set                                              |
| Too few selections         | `Please select at least {n} option(s).`     | Multi mode, `minSelections` set. Enforced even if not Required. |
| Too many selections        | `Please select no more than {n} option(s).` | Multi mode, `maxSelections` set                                 |

If you fill in **Error message**, it **replaces every message above**, including the min/max and manual-input messages.

Set `minSelections` and `maxSelections` with **Minimum selections** and **Maximum selections** in the editor's Behavior chapter (multi mode).

## Auto-advance

With **Auto-advance** on in single mode, the component fires `FlowNavigationNextEvent` 150 ms after a selection, resetting the timer on each change. It does not fire for the None option or an empty value. It never fires in multi mode.

Typing in the manual "Other" box never auto-advances. The user types and then clicks **Next**.

## Empty, loading and error states

| State          | What the user sees                                                                                                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading        | Three skeleton cards and the text "Loading options" (announced as a status)                                                                                                                                                                                |
| Error          | An alert with the real error text (for example `Unknown object: X`), or your **Load error message** when there is no text, plus a **Try again** button                                                                                                     |
| Empty          | Your **No options message** (default `No options available.`). Layouts add their own line: "No items to display." (grid, list, horizontal, radio), "No options to display." (picklist), "No available options." / "No available cards." (transfer layouts) |
| Not configured | The empty state                                                                                                                                                                                                                                            |

The error state also appears when `selectorConfigJson` does not parse, and when a SOQL query fails after the configuration changes.

## Translating built-in text

Every piece of text the screen component shows on its own (the messages in [Validation](#validation), the loading, empty and error text above, the **Try again** button, the None and "Other" option defaults, search placeholders, the **Select all** button, the dual listbox and column headings and buttons, selected and available counts, and the accessible names screen readers announce) is a Custom Label. The labels are named `Newton_Selector_*` and grouped in the category `NewtonSelector`.

To translate them, open **Setup > Custom Labels**, pick a `Newton_Selector_*` label, and add a translation for each language, or use **Setup > Translation Workbench**. Each label's description says where it appears, and `{0}` and `{1}` mark the numbers or text filled in at run time; keep them in the translation. Users see the translation for their own language.

Text you type in the editor (the selector label, help text, option labels, **No options message**, **Load error message**, **Error message**, None and manual option labels) is shown exactly as typed and is not a Custom Label. To translate it, bind the field to a Flow resource that holds the translated text. The editor itself (the Custom Property Editor) is in English only.

## Related

- [Configuration reference](reference-configuration.md)
- [How to use the outputs in a Flow](howto-use-outputs-in-a-flow.md)
- [Architecture](architecture.md)
