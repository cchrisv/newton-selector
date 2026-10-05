# How to build a SOQL selector

Show a live, filtered list of records from your org (for example open Cases or active Products) as selectable tiles.

## Prerequisites

- Newton Selector deployed ([tutorial, step 1](tutorial-first-selector.md#step-1-deploy-the-component)).
- A Screen Flow with the **Professor Flow | Newton Selector** component on a screen.
- The people who run the Flow can read the object and every field you map. Queries run as the logged-in user and respect object and field access.

## Steps

1. Click **Configure selector** (or **Edit configuration**) and, in **Data**, click the **SOQL query** tile.

2. Under **Object**, search for and pick the object, for example `Product2`. Picking an object resets the WHERE clause and **Order by**, and picking a different object also resets the field mapping.

3. Map the fields. The **Label** field is required and defaults to `Name`. **Value** defaults to `Id`. Optionally set:
   - **Sublabel** (small second line), for example `Family`
   - **Icon** (a field holding an icon name)
   - **Badge** (short text chip)
   - **Help text** (read by screen readers)

4. Filter the rows in the **Where clause builder**.
   1. Click **Add condition**.
   2. Pick a field, an operator and a value. The **Field** picker hides fields that can't be filtered. Operators depend on the field type (see the [WHERE reference](reference-where-clause.md#builder-operators-by-field-type)).
   3. For a value from your Flow, type a merge field such as `{!varRegion}` or pick a resource. A text merge field is stored quoted (`Region__c = '{!varRegion}'`); a number, date, time or boolean merge field is stored unquoted.
   4. For `IN`, `NOT IN`, `INCLUDES` and `EXCLUDES` type a comma-separated list of values. These operators don't take a Flow value.

   The value input follows the field type: numbers, booleans, dates and times are written unquoted, and booleans get a TRUE/FALSE picker. Typed values must match the field's format: a number, `yyyy-MM-dd` for a date, an ISO datetime such as `2026-01-31T14:30:00Z` for a datetime, and `HH:mm:ss` for a time. Literals such as `TODAY` aren't accepted. A partly filled condition, or a value in the wrong format, blocks Save with "Finish or remove the highlighted filter condition." and the row says what to fix.

   A Flow value is merged into the saved configuration as text, so it must not contain a quote, backslash or line break. See [Known limitations](known-limitations.md).

5. Set **Order by** and **Direction**.

6. Click **Validate query** in the **SOQL preview** card. This runs the query once as you, with `LIMIT 1`, and shows the real error if it fails. Flow values don't exist yet in the editor, so each one is checked with a sample value of its field's type, and the success message says so.

7. Optionally, in **Display options**, set **Sort by** and **Maximum options**.

8. Click **Save**.

## Verification

- The **SOQL preview** card shows the query built from your settings, such as `SELECT Id, Name FROM Product2 WHERE IsActive = TRUE ORDER BY Name ASC LIMIT 50`, and **Validate query** reports `Query validated successfully.`
- Debug the Flow. The tiles should show real records. The `value` output holds the record's `Value` field (the Id by default).

## Things to know

- **Row limit.** The runtime honors the **Rows to load** setting; blank means 50 rows. The absolute ceiling is 2,000.
- **Preview.** The editor preview shows sample options, not your records. Only the editor actions **Validate query** and **Load sample rows**, and the Flow itself, read real data.
- **Sample rows.** To override individual rows, set **Option overrides** to **Advanced**, then click **Load sample rows**. Changing the object, the WHERE clause, **Order by**, **Direction**, **Rows to load**, **Label** or **Value** clears the sample rows. When the WHERE clause uses Flow values, the sample rows ignore it and the card says "Sample rows ignore the WHERE clause because it uses Flow values."
- **Fields.** Only direct fields work. Relationship paths such as `Owner.Name` are not supported.

## Troubleshooting

| Message or symptom                                     | Cause and fix                                                                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Object not accessible: X`                             | The running user cannot access the object. Grant access, or choose another object.                                                                      |
| `Field not accessible on X: F`                         | The user lacks field-level access. Grant it or remove the field mapping.                                                                                |
| `Field not filterable on X: F`                         | That field type cannot be in a WHERE clause. Filter on another field.                                                                                   |
| `Expected field name in WHERE clause near: <text>`     | Unsupported syntax in the WHERE text. Rebuild the condition in the builder.                                                                             |
| `Unsupported WHERE operator after <field>: NOT <text>` | A hand-written operator Apex doesn't allow, such as `NOT LIKE`. Use `LIKE`, `!=` or `NOT IN`.                                                           |
| `Invalid value for F (TYPE): v`                        | The value does not fit the field's type (for example `TODAY` on a Date). Fix the value.                                                                 |
| `Field not sortable on X: F`                           | The **Order by** field cannot be sorted. The **Order by** picker hides such fields, so this only comes from a hand-edited config. Choose another field. |
| Any other message                                      | A database error, reported as the database gave it. Click **Validate query** to reproduce it.                                                           |

## Related

- [WHERE clause reference](reference-where-clause.md)
- [Configuration reference](reference-configuration.md#soql-query)
- [Security model](explanation-security-model.md)
