# Known limitations

Things that behave differently from what you might expect, found while reading the code for this documentation. Each entry says what happens, why, and what to do. Items marked **verified in code** were traced through the source; nothing here was observed in a live org unless noted.

If you fix one of these, delete its entry and update the page that mentions it.

## Date literals

The builder passes date values through unquoted, but Apex accepts only `yyyy-MM-dd` and `yyyy-MM-dd HH:mm:ss`, so `TODAY` and `LAST_N_DAYS:7` fail with `Invalid value for <field> (<type>): <value>`. See the [WHERE reference](reference-where-clause.md#where-the-builder-and-apex-disagree).

**Workaround:** type explicit dates.

## No editor control for select all

`showSelectAll` is part of the config and the runtime honors it, but the editor has no control for it.

**Workaround:** edit `selectorConfigJson` directly (in the Flow XML or an API-driven metadata change).

## Option overrides cover Picklist and SOQL only

Option overrides apply to Picklist and SOQL sources, not to Collection or Custom options (edit custom options directly). Switching **Option overrides** back to Default clears them; **Undo** brings them back until your next override change. For SOQL you must click **Load sample rows** before the editor can list rows to override.

## Smaller details

- **Direction fallback.** The editor's SOQL direction handler falls back to Descending when given an unrecognized value, while the stored default is Ascending.
- **Custom options with a blank Value** keep an empty-string value. Fill in Value on every item.
- **Dropdown layout meta line.** Option rows in the Dropdown layout may show the item's raw value as a secondary line. The None row can show its internal id. Check this visually in your org.
- **Missing object or field.** For the Picklist source, a missing object or field leaves the loading skeleton in place with no error text.
- **Apex error logging.** Apex failures are mapped to messages and not logged anywhere.
- **No image support.** Tiles show icons or geometric shapes. There is no image field.
- **E2E leaves Flows in the org.** `npm run test:e2e:builder` removes its Leads and local file but leaves a Draft Flow named `Newton_Selector_E2E`. `npm run test:e2e:runtime` leaves the active Flow `Newton_Selector_Features`.
- **Apex test gaps.** No tests for WHERE scanner errors (an unterminated string, a missing `)`) or for DESC ordering.

## Related

- [Troubleshooting](howto-troubleshoot.md)
- [WHERE clause reference](reference-where-clause.md)
- [Apex API reference](reference-apex-api.md)
