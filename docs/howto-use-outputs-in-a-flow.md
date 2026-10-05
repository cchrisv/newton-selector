# How to use the selector's outputs in a Flow

Read what the user chose and use it in a Decision, an assignment, a Get Records, a Create Records, or a later screen.

## Prerequisites

- A configured Newton Selector with an API name, for example `Plan_Selector`. The API name is how you reference its outputs.

## Steps

1. **Know which outputs you get.** Single mode fills `value`, `selectedLabel`, `selectedRecord` and `selectionCount`. Multi mode fills `values`, `selectedLabels`, `selectedRecords` and `selectionCount`. `allValues` and `allLabels` are filled in both. Full table: [Flow component reference](reference-flow-component.md#outputs).

2. **Reference them after the screen.** In any later element, pick `{!Plan_Selector.value}` (or another output) from the resource picker.

3. **Branch on a choice.** Add a **Decision** after the screen. Create an outcome with **Resource** `{!Plan_Selector.value}`, **Operator** Equals, **Value** `enterprise`.

4. **Use several choices.** In multi mode, `values` is a text collection. Loop over it with a **Loop** element, or use it as the filter value for **Get Records** with the **In** operator.

5. **Store the value.** In **Create Records** or **Update Records**, set a text field to `{!Plan_Selector.value}`. For multi-select picklist fields, join the values with `;`, for example with a **Text** formula resource.

6. **Fetch the full record (SOQL or Collection sources).** `selectedRecord` and `selectedRecords` are filled only for these sources; for Custom and Picklist they stay empty. Set the SOQL **Value** field, or the collection **Value** map, to `Id`. After the screen, add **Get Records** where `Id` equals `{!Plan_Selector.value}`. This is more reliable than reading fields from `selectedRecord`.

7. **Pre-select a value.** In the editor's **03 Behavior** chapter, set **Default selection** to a Flow resource: a text variable in single mode, a text collection variable in multi mode. In multi mode the field refuses typed text with "Pick a text collection variable for multiple default selections." The editor stores it in the component's `value` (or `values`) input, and the screen opens with those options selected. Outputs are not rewritten until the user acts.

## Handling the special entries

| User action                 | `value` / `values` | `selectedLabel`         | `selectionCount` |
| --------------------------- | ------------------ | ----------------------- | ---------------- |
| Chooses an option           | The option's value | The option's label      | 1                |
| Chooses **None** (single)   | `""`               | `""`                    | 0                |
| Chooses **Other** and types | The typed text     | The manual option label | 1                |
| Nothing yet                 | `""` or `[]`       | `""`                    | 0                |

`allValues` and `allLabels` include the None entry (value `""`) and the Other entry (value `__newton_manual_input__`) when those are enabled. Filter them out if you use these lists for something other than display.

In a Decision, test for the Other value with the label rather than the sentinel, or check `selectedLabel` against your **Manual option label**.

## Verification

Add a temporary screen after the selector with a **Display Text** such as `{!Plan_Selector.value} | {!Plan_Selector.selectedLabel} | {!Plan_Selector.selectionCount}` and **Debug** the Flow. Try each path: one option, None, Other, and (in multi mode) several options.

## Troubleshooting

| Symptom                                | Fix                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| The output resources are not listed    | The selector's API name is wrong, or the screen is not before the element you are editing. |
| `value` holds a label, not an API name | For picklists, **Output value as** is set to Label. Change it to API name.                 |
| `selectedRecord.Field` is empty        | The field is not queried, or the source is Custom/Picklist. Use `value` plus Get Records.  |

## Related

- [Flow component reference](reference-flow-component.md)
- [How to configure multi-select and validation](howto-multi-select-and-validation.md)
