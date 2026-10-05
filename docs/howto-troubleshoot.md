# How to troubleshoot a Newton Selector

Find out why a selector shows the wrong options, an error, or nothing at all. Start with where the problem appears.

## In the editor (Flow Builder)

| Symptom                                                                                                 | Cause and fix                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Save** is disabled                                                                                    | An error exists. The status line beside Save shows the error count and the first error; the chapter's issue list is below the chapter tabs at the top of the right column. Warnings do not block Save.                                                                                                                          |
| "Choose a data source." (the Flow Builder panel says "Choose a data source: click Configure selector.") | Choose a tile in **Data**.                                                                                                                                                                                                                                                                                                      |
| Behavior shows "Choose a data source in Data first." and Display options is missing                     | The Behavior cards and the Display options card appear only after a data source is chosen. The Behavior chapter header and tab always show.                                                                                                                                                                                     |
| Preview shows sample options, not my data                                                               | The preview never queries your org. It uses sample data (or your real Custom options). Use **Validate query** for SOQL.                                                                                                                                                                                                         |
| Red strip on the panel: "Finish setup: open Edit configuration and click Save."                         | Open **Edit configuration** and click **Save** once to write the object type.                                                                                                                                                                                                                                                   |
| My appearance changes vanished                                                                          | **Reset appearance** was clicked. Click **Undo** before making another change. Switching layouts keeps styling.                                                                                                                                                                                                                 |
| I cannot find the collection                                                                            | Only record collections (`{T[]}`) are offered, and the element creating it must run before the screen.                                                                                                                                                                                                                          |
| The record-type picker is missing                                                                       | It appears only when the object has non-master record types.                                                                                                                                                                                                                                                                    |
| **Validate query** fails                                                                                | Read the message; it is the real error. See the [Apex message catalog](reference-apex-api.md#message-catalog).                                                                                                                                                                                                                  |
| "Finish or remove the highlighted filter condition."                                                    | A WHERE condition is only partly filled in, or its value doesn't match the field's format (for example `TODAY` on a Date field). The row says what to fix. Complete it or delete it; Save stays disabled until then.                                                                                                            |
| The panel says "The saved configuration can't be read. Open Edit configuration to set it up again."     | The saved `selectorConfigJson` does not parse. Fix the Flow metadata, or reconfigure and Save.                                                                                                                                                                                                                                  |
| An object or field search shows a message instead of results                                            | The search failed. Read the message (often access to the object), then try again.                                                                                                                                                                                                                                               |
| Overrides disappeared                                                                                   | Switching **Option overrides** back to Default clears them; click **Undo** in the Option overrides card before your next override change. Changing the data source, the picklist object or field, or the SOQL object also clears them, for good: there is no Undo, because the overrides were keyed by the old source's values. |

## At runtime (Flow screen)

| Symptom                                                                           | Likely cause and fix                                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "No options available." (or your empty-state text)                                | No data source chosen, the source returned nothing, or the user cannot see any records. Check the filter and the user's access. (A Picklist source missing its object or field, or a SOQL source with no object, shows an error instead.)  |
| "Could not load options." or a specific error                                     | The load failed. A specific message (for example `Field not accessible on Contact: Email`) tells you what to fix. Generic text means an unexpected failure; reproduce as the same user. Only a SOQL load offers **Try again**.             |
| "The Picklist source needs an object and a picklist field (object: X, field: Y)." | The Picklist source has no object or no field saved. Pick both in **Data** and Save. A field the user can't access shows the platform's own message instead.                                                                               |
| "This selector's saved configuration can't be read (...)"                         | The saved `selectorConfigJson` does not parse. Usually a Flow value merged into it (a label, help text or WHERE value) contains a quote, backslash or line break. Remove that character from the value, or open the editor and Save again. |
| The selector shows a query error instead of options                               | The query fails. Read the message; open the editor and **Validate query**.                                                                                                                                                                 |
| "Expected field name in WHERE clause near: <text>"                                | The WHERE text is malformed (for example a missing field name). Rebuild the condition in the builder.                                                                                                                                      |
| 'Unexpected "<c>" in WHERE value near: <text>'                                    | A hand-written operator Apex doesn't read, such as `Status <> 'Closed'`. Use `!=`.                                                                                                                                                         |
| "Unsupported escape sequence ..."                                                 | A quoted WHERE value uses a backslash escape SOQL doesn't allow. Use `\'` or `\\` anywhere, and `\%` or `\_` only in `LIKE` values.                                                                                                        |
| An option is missing for one user only                                            | Sharing or field-level security. Queries run as the user.                                                                                                                                                                                  |
| The error message is not what I configured                                        | While Required is on, an **Error message** replaces all validation messages. Unset it to see specific ones.                                                                                                                                |
| Wrong value in the Flow                                                           | Picklist **Output value as**, or a field-map mix-up.                                                                                                                                                                                       |
| `selectedRecord` is empty or has no field values                                  | SOQL records hold only `Id` and the queried fields; Custom and Picklist sources have no record, so it stays empty. Use `value` and a Get Records.                                                                                          |

## Check the Apex path directly

For a SOQL source, run the same query yourself as the affected user:

1. In Developer Console or VS Code, open Anonymous Apex.
2. Call the controller with the config JSON the editor would send:

   ```apex
   String cfg = '{"sObjectApiName":"Account","labelField":"Name","valueField":"Id","queryLimit":5}';
   System.debug(NewtonSelectorRuntimeController.queryItems(cfg));
   ```

3. Anonymous Apex runs as you. To test as another user, use **Login as** on that user in Setup first, or write a small `System.runAs` test.

If the call throws an `AuraHandledException`, its message is exactly what the Flow user sees.

## Still stuck

1. Run the unit tests (`npm run test:unit`) and Apex tests to see whether a regression exists. See [How to develop and test](howto-develop-and-test.md).
2. Check [Known limitations](known-limitations.md). The behavior may be a documented gap.
3. Inspect the saved config: in Setup, open the Flow's metadata and read the screen component's `selectorConfigJson`. Compare it against the [configuration reference](reference-configuration.md).

## Related

- [Known limitations](known-limitations.md)
- [Apex API reference](reference-apex-api.md)
- [Using a Newton Selector](guide-using-the-selector.md)
