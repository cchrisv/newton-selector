# Known limitations

Things that behave differently from what you might expect, found while reading the code for this documentation. Each entry says what happens, why, and what to do. Items marked **verified in code** were traced through the source; nothing here was observed in a live org unless noted.

If you fix one of these, delete its entry and update the page that mentions it.

## Date literals

SOQL date literals such as `TODAY` and `LAST_N_DAYS:7` don't work. The visual builder blocks them on date fields with a row message, and Save stays disabled until the value is fixed. A clause the builder can't show as conditions stays as text in the **Manual WHERE clause** box; a date literal typed there still reaches Apex and fails at **Validate query** or at run time with `Invalid value for <field> (<type>): <value>`. Apex accepts `yyyy-MM-dd` for a Date, an ISO 8601 datetime (`yyyy-MM-ddTHH:mm:ssZ`, or with a `+hh:mm` offset) for a Datetime, and `HH:mm:ss` or `HH:mm:ss.SSSZ` for a Time. See the [WHERE reference](reference-where-clause.md#where-the-builder-and-apex-disagree).

## Flow values in the configuration

Flow merge fields (in a label, help text or WHERE value) are resolved by Flow and spliced into `selectorConfigJson` as text. Neither the editor nor the runtime can escape the resolved value, so:

- A resolved value that contains a double quote, backslash or line break breaks the configuration. The selector then shows "This selector's saved configuration can't be read (...)" instead of options.
- A single quote in a text value merged into a WHERE condition ends the quoted value early. The query then fails (a name such as `O'Brien` gives `Unsupported WHERE clause near: ...`), or a crafted value widens the filter, for example by adding an `OR` condition. It can only reach records the user can already see, because the query runs in `USER_MODE`.
- `IN`, `NOT IN`, `INCLUDES` and `EXCLUDES` don't take a Flow value; the builder blocks it with a message.
- In the editor, **Validate query** checks a WHERE clause that holds Flow values with a sample value of each field's type, not the real run-time values.

**Workaround:** merge only values you control, such as Ids, picklist values or numbers, and keep quotes, backslashes and line breaks out of merged text.

## Option overrides cover Picklist and SOQL only

The editor offers option overrides for Picklist and SOQL sources, not for Collection or Custom options (edit custom options directly). Switching **Option overrides** back to Default clears them; **Undo** brings them back until your next override change. Changing the data source, the picklist object or field, or the SOQL object also clears them, with no Undo. For SOQL you must click **Load sample rows** before the editor can list rows to override. Changing the object, the WHERE clause, **Order by**, **Direction**, **Rows to load**, **Label** or **Value** clears the sample rows.

## Smaller details

- **Apex error logging.** Apex failures are mapped to messages and not logged anywhere.
- **No image support.** Tiles show icons or geometric shapes. There is no image field.
- **E2E leaves Flows in the org.** `npm run test:e2e:builder` removes its Leads and local file but leaves a Draft Flow named `Newton_Selector_E2E`. `npm run test:e2e:runtime` leaves the active Flow `Newton_Selector_Features`.

## Related

- [Troubleshooting](howto-troubleshoot.md)
- [WHERE clause reference](reference-where-clause.md)
- [Apex API reference](reference-apex-api.md)
