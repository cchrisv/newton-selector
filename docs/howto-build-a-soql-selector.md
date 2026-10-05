# How to build a SOQL selector

Show a live, filtered list of records from your org (for example open Cases or active Products) as selectable tiles.

## Prerequisites

- Newton Selector deployed ([tutorial, step 1](tutorial-first-selector.md#step-1-deploy-the-component)).
- A Screen Flow with the **Professor Flow | Newton Selector** component on a screen.
- The people who run the Flow can read the object and every field you map. Queries run as the logged-in user and respect object and field access.

## Steps

1. Click **Configure selector** (or **Edit configuration**) and, in **01 Data**, click the **SOQL query** tile.

2. Under **Object**, search for and pick the object, for example `Product2`. Picking a different object later resets the WHERE and ORDER BY settings.

3. Map the fields. The **Label** field is required and defaults to `Name`. **Value** defaults to `Id`. Optionally set:
   - **Sublabel** (small second line), for example `Family`
   - **Icon** (a field holding an icon name)
   - **Badge** (short text chip)
   - **Help text** (read by screen readers)

4. Filter the rows in the **Where clause builder**.
   1. Click **Add condition**.
   2. Pick a field, an operator and a value. Operators depend on the field type (see the [WHERE reference](reference-where-clause.md#builder-operators-by-field-type)).
   3. For a value from your Flow, type a merge field such as `{!varRegion}` or pick a resource (stored as `{!varRegion}`).
   4. For `IN`, `NOT IN`, `INCLUDES` and `EXCLUDES` use a comma-separated list, or one `{!Collection}`.

   The value input follows the field type: numbers, booleans and dates are written unquoted, and booleans get a TRUE/FALSE picker. Date literals such as `TODAY` fail today; type explicit dates. See [Known limitations](known-limitations.md). A partly filled condition blocks Save with "Finish or remove the highlighted filter condition."

5. Set **Order by** and **Direction**.

6. Click **Validate query** in the **SOQL preview** card. This runs the query once as you, with `LIMIT 1`, and shows the real error if it fails.

7. Optionally, in **Display options**, set **Sort by** and **Maximum options**.

8. Click **Save**.

## Verification

- The **SOQL preview** card shows the query built from your settings, such as `SELECT Id, Name FROM Product2 WHERE IsActive = TRUE ORDER BY Name ASC LIMIT 50`, and **Validate query** reports `Query validated successfully.`
- Debug the Flow. The tiles should show real records. The `value` output holds the record's `Value` field (the Id by default).

## Things to know

- **Row limit.** The runtime honors the **Rows to load** setting; blank means 50 rows. The absolute ceiling is 2,000.
- **Preview.** The editor preview shows sample options, not your records. Only **Validate query** and the Flow itself touch real data.
- **Sample rows.** To override individual rows, click **Load sample rows** in the item-overrides area first.
- **Fields.** Only direct fields work. Relationship paths such as `Owner.Name` are not supported.

## Troubleshooting

| Message or symptom                     | Cause and fix                                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------------------- |
| `Object not accessible: X`             | The running user cannot access the object. Grant access, or choose another object.            |
| `Field not accessible on X: F`         | The user lacks field-level access. Grant it or remove the field mapping.                      |
| `Field not filterable on X: F`         | That field type cannot be in a WHERE clause. Filter on another field.                         |
| `Expected field name in WHERE clause.` | Unsupported syntax in the WHERE text. Rebuild the condition in the builder.                   |
| `Unsupported WHERE operator.`          | A hand-written operator Apex doesn't allow, such as `NOT LIKE`. Use `LIKE`, `!=` or `NOT IN`. |
| `Invalid value for F (TYPE): v`        | The value does not fit the field's type (for example `TODAY` on a Date). Fix the value.       |
| `Field not sortable on X: F`           | The **Order by** field cannot be sorted. Choose another field.                                |
| `Unable to load selector options.`     | An unexpected failure. Click **Validate query** in the editor to see the real error.          |

## Related

- [WHERE clause reference](reference-where-clause.md)
- [Configuration reference](reference-configuration.md#soql-query)
- [Security model](explanation-security-model.md)
