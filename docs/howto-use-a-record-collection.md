# How to use a record collection as the options

Turn records you already have in a Flow variable (for example the result of a Get Records element) into selectable tiles, with no Apex and no extra query.

## Prerequisites

- A Screen Flow with a record collection variable or a **Get Records** element that returns multiple records. Store all fields you plan to map.
- That element sits **before** the screen with the selector.
- The Newton Selector component on the screen.

## Steps

1. Add a **Get Records** element before the screen. Choose the object (for example `Contact`), **All records**, and **Automatically store all fields** (or at least the fields you will show). Name it `Get_Contacts`.

2. Open the selector editor with **Configure selector** and, in **01 Data**, click **Collection**.

3. Under **Flow record collection**, pick `{!Get_Contacts}`. Only record collections are offered. Changing it to a different object later blanks the field map.

4. Map the fields:

   | Map this                | To a field such as |
   | ----------------------- | ------------------ |
   | **Label** (required)    | `Name`             |
   | **Value**               | `Id`               |
   | **Sublabel**            | `Title`            |
   | **Badge**               | `Department`       |
   | **Icon**, **Help text** | optional           |

5. Optionally set **Sort by** and **Maximum options** under **Display options**.

6. Click **Save**.

## Verification

Debug the Flow. The tiles should show your records. Pick one and check the `value` output equals the mapped **Value** field.

## Notes

- **Value fallback.** If a record has no value for the mapped **Value** field, the selector falls back to the record Id, then to its position in the list. A blank **Label** shows `(row N)`.
- **Option overrides do not apply** to collections. Change the data or the field map instead.
- **Filtering** happens in the Flow, not in the selector. Use the **Get Records** filters or a Collection Filter element.
- **Preview.** The preview in the editor uses sample options, not your collection, because the collection does not exist at design time.
- **Large collections.** All records are rendered on the screen. Cap them with **Maximum options** or filter upstream.

## Troubleshooting

| Symptom                                            | Fix                                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| "Bind a Flow record collection variable."          | Pick a collection in **Flow record collection**.                                                  |
| "Map at least the Label field for the collection." | Set **Label** in the field map.                                                                   |
| The collection picker is empty                     | The collection must be a record collection (`{T[]}`), and its element must run before the screen. |
| Tiles are blank                                    | The Get Records element did not store the mapped fields. Store all fields.                        |

## Related

- [Configuration reference](reference-configuration.md#collection)
- [How to use the outputs in a Flow](howto-use-outputs-in-a-flow.md)
