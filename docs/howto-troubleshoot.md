# How to troubleshoot a Newton Selector

Find out why a selector shows the wrong options, an error, or nothing at all. Start with where the problem appears.

## In the editor (Flow Builder)

| Symptom                                                                         | Cause and fix                                                                                                                 |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Save** is disabled                                                            | An error exists. Hover Save for the count and read the issue list at the top of the right column. Warnings do not block Save. |
| "Pick a data source to continue."                                               | Choose a tile in **01 Data**.                                                                                                 |
| 03 Behavior and Display options are missing                                     | They stay hidden until a data source is chosen.                                                                               |
| Preview shows sample options, not my data                                       | The preview never queries your org. It uses sample data (or your real Custom options). Use **Validate query** for SOQL.       |
| Red strip on the panel: "Finish setup: open Edit configuration and click Save." | Open **Edit configuration** and click **Save** once to write the object type.                                                 |
| My appearance changes vanished                                                  | **Reset appearance** was clicked. Click **Undo** before making another change. Switching layouts keeps styling.               |
| I cannot find the collection                                                    | Only record collections (`{T[]}`) are offered, and the element creating it must run before the screen.                        |
| The record-type picker is missing                                               | It appears only when the object has non-master record types.                                                                  |
| **Validate query** fails                                                        | Read the message; it is the real error. See the [Apex message catalog](reference-apex-api.md#message-catalog).                |
| "Finish or remove the highlighted filter condition."                            | A WHERE condition is only partly filled in. Complete it or delete it; Save stays disabled until then.                         |
| The panel shows an error about the saved configuration                          | The saved `selectorConfigJson` does not parse. Fix the Flow metadata, or reconfigure and Save.                                |
| An object or field search shows a message instead of results                    | The search failed. Read the message (often access to the object), then try again.                                             |
| Overrides disappeared                                                           | Switching **Option overrides** back to Default clears them. Click **Undo** before your next override change.                  |

## At runtime (Flow screen)

| Symptom                                                          | Likely cause and fix                                                                                                                                                                    |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "No options available." (or your empty-state text)               | Not configured, the source returned nothing, or the user cannot see any records. Check the filter and the user's access.                                                                |
| "Could not load options." or a specific error with **Try again** | The load failed. A specific message (for example `Field not accessible on Contact: Email`) tells you what to fix. Generic text means an unexpected failure; reproduce as the same user. |
| Loading skeleton never ends (Picklist source)                    | The object or picklist field is missing or inaccessible. The selector does not show an error for this today. Recheck the picklist configuration.                                        |
| The selector shows an error instead of options                   | The saved configuration does not parse, or the query fails. Read the message; open the editor and **Validate query** for SOQL.                                                          |
| "Expected field name in WHERE clause."                           | The WHERE text is malformed (for example a missing field name). Rebuild the condition in the builder.                                                                                   |
| An option is missing for one user only                           | Sharing or field-level security. Queries run as the user.                                                                                                                               |
| The error message is not what I configured                       | A **Error message** replaces all validation messages. Unset it to see specific ones.                                                                                                    |
| Wrong value in the Flow                                          | Picklist **Output value as**, an empty **Value** on a custom item, or a field-map mix-up.                                                                                               |
| `selectedRecord` is empty or has no field values                 | SOQL records hold only `Id` and the queried fields; Custom and Picklist sources have no record, so it stays empty. Use `value` and a Get Records.                                       |

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
