# How to configure multi-select, required answers and an "Other" option

Let people pick several options, make an answer mandatory, offer a "None" choice, or let them type their own answer.

## Prerequisites

- A Newton Selector on a Flow screen with a data source already chosen. The **03 Behavior** chapter stays hidden until you pick a source.

## Allow several choices

1. Open the editor and go to **03 Behavior**.
2. Set **Mode** to **Multi**. Auto-advance is switched off automatically, because it only works in single mode.
3. Pick a layout that suits multiple choices in **04 Appearance**: Grid, List, Columns or **Dual listbox** all work. Switching layouts keeps your appearance settings.
4. Click **Save**.

The Flow now receives `values`, `selectedLabels`, `selectedRecords` and `selectionCount` (see [Flow component reference](reference-flow-component.md#outputs)).

## Make an answer required

1. In **03 Behavior**, turn **Required** on.
2. Optional: type a **Error message**. It **replaces every validation message** on the component, including the minimum, maximum and manual-input messages, so word it generally ("Choose at least one option to continue.").

Without a custom message the user sees **Please make a selection.** Choosing the None option counts as no selection.

## Offer a "None" option

1. Turn **None option** on.
2. Set **None option label**, or leave it blank to show `--None--` translated for each user.
3. Choose **At start** or **At end**.

Picking None clears the answer. In multi mode it clears every selection.

## Let people type their own answer ("Other")

1. Turn **Manual input** on.
2. Set **Manual option label**, or leave it blank to show `Other` translated for each user.
3. Optional: set **Minimum characters** and **Maximum characters**.

The option always appears last in the list. When chosen, a text box appears and the typed text becomes the output value and label.

If you use a Custom options source, manual input can stand alone with an empty list.

Manual input works with **Auto-advance**: typing in the "Other" box never advances the Flow, so the user types and then clicks **Next**.

## Add search

Turn **Search** on to add a filter box above the options. It matches label, sublabel and help text, ignoring case.

## Minimum and maximum selections

In multi mode, set **Minimum selections** and **Maximum selections** on the Selection mode card in **03 Behavior** (for example 2 and 4). Leave either blank for no limit. The user then sees "Please select at least 2 option(s)." or "Please select no more than 4 option(s)." Once the maximum is reached, the other tiles are disabled. The minimum is enforced even when **Required** is off.

## Verification

Debug the Flow and confirm each rule:

- Click Next with nothing selected and Required on: the error appears.
- In multi mode, select two options: `selectionCount` is 2 and `values` lists both.
- With Manual input on, choose **Other** and leave the box empty: "Enter a value for the manual option."

## Troubleshooting

| Symptom                                    | Fix                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------- |
| Auto-advance turned itself off             | Expected in Multi mode. Switch back to Single to use it.            |
| Custom error shows for every problem       | That is how it works. Clear it to get specific messages.            |
| Save is disabled with a manual-input error | Make Maximum characters at least the Minimum, and neither negative. |
| The 03 Behavior chapter is missing         | Choose a data source in 01 Data first.                              |

## Related

- [Configuration reference: Behavior](reference-configuration.md#03-behavior)
- [Flow component reference: Validation](reference-flow-component.md#validation)
