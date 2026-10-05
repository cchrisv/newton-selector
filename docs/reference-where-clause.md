# Reference: WHERE clause

The SOQL data source filters records with a WHERE clause. Admins normally build it in the CPE's visual **Where clause builder**. The builder saves plain text into the config (`sobject.whereClause`), and Apex parses that text at runtime. This page documents both sides, including where they disagree.

## Builder operators by field type

| Field type                                                                    | Operators                     | Value input                                                                          |
| ----------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------ |
| Text (STRING, TEXTAREA, URL, EMAIL, PHONE, ENCRYPTEDSTRING) and unknown types | `=` `!=` `LIKE` `IN` `NOT IN` | Text or merge field                                                                  |
| Number (INTEGER, LONG, DOUBLE, CURRENCY, PERCENT)                             | `=` `!=` `<` `>` `<=` `>=`    | Number or merge field                                                                |
| BOOLEAN                                                                       | `=` `!=`                      | TRUE / FALSE picker                                                                  |
| DATE, DATETIME, TIME                                                          | `=` `!=` `<` `>` `<=` `>=`    | Value in the field's format (see [Dates and times](#dates-and-times)) or merge field |
| PICKLIST, COMBOBOX                                                            | `=` `!=` `IN` `NOT IN`        | Text or merge field                                                                  |
| MULTIPICKLIST                                                                 | `INCLUDES` `EXCLUDES`         | Comma-separated list                                                                 |
| REFERENCE, ID                                                                 | `=` `!=` `IN` `NOT IN`        | Id text or merge field                                                               |

The **Field** picker offers only fields that can be filtered (`filterable` in the [field describe](reference-apex-api.md#newtonselectorflowcpecontroller)). The builder knows each field's type from it, so the value input, the operators and the quoting follow the type. A Flow resource picked from the value's resource selector is stored as a merge field, for example `{!varRegion}`.

List operators (`IN`, `NOT IN`, `INCLUDES`, `EXCLUDES`) take a comma-separated list of typed values. They do not accept Flow resources: a row whose list holds a merge field shows "IN, NOT IN, INCLUDES and EXCLUDES need typed values. Remove the Flow resource or choose another operator." and blocks Save.

The builder checks the format of typed number, date, datetime and time values:

| Field type                | Accepted value                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| INTEGER, LONG             | A whole number, such as `42` or `-3`                                                                    |
| DOUBLE, CURRENCY, PERCENT | A number, such as `1500` or `12.5`                                                                      |
| DATE                      | `yyyy-MM-dd`                                                                                            |
| DATETIME                  | ISO 8601 `yyyy-MM-ddTHH:mm:ssZ`, optionally with `.SSS` or a `+hh:mm` / `-hh:mm` offset in place of `Z` |
| TIME                      | `HH:mm:ss` or `HH:mm:ss.SSSZ`                                                                           |

To compare with `NULL`, use the **Manual WHERE clause**: the builder can't reopen a `NULL` value. A value in the wrong format shows a message on its row, for example "Enter a whole number for NumberOfEmployees, or pick a resource.", and blocks Save. Merge fields are not format-checked, because Flow fills them in at run time.

## Builder grouping and logic

- The root group has an **AND / OR** toggle. Every nested group has its own.
- Toolbar actions: Group, Group with next, Indent, Outdent, Ungroup, move up and down, drag and drop, Add condition.
- There is no NOT group and no numbered custom-logic string such as `1 AND (2 OR 3)`.

## What the builder writes

| Value kind                                                     | Serialized as                       |
| -------------------------------------------------------------- | ----------------------------------- |
| Text, picklist, reference                                      | Single-quoted and escaped: `'Acme'` |
| Number                                                         | Unquoted: `42`                      |
| BOOLEAN                                                        | `TRUE` or `FALSE`                   |
| DATE, DATETIME, TIME                                           | Unquoted, exactly as typed          |
| List                                                           | `('a', 'b')` or `(1, 2)`            |
| `LIKE` with no `%` or `_`                                      | Wrapped as `'%text%'`               |
| `LIKE` containing `%` or `_`                                   | Used as typed                       |
| Merge field on a text, picklist, reference or unknown field    | Single-quoted: `'{!Var}'`           |
| Merge field on a number, date, datetime, time or boolean field | Unquoted: `{!Var}`                  |

`LIKE` never wraps a merge field in `%`. A nested group is wrapped in parentheses: `A = 'x' AND (B = 'y' OR C = 'z')`.

A blank condition you haven't touched is ignored. A condition that is only partly filled in, or whose value is in the wrong format, is highlighted and blocks Save with "Finish or remove the highlighted filter condition." The saved clause contains only complete conditions, so a selector never saves with a filter silently dropped.

A clause the builder cannot show, or cannot write back unchanged, switches the card to a **Manual WHERE clause** textarea with a **Rebuild visually** button. Examples:

- `Name NOT LIKE 'Acme%'` (`NOT LIKE`)
- `StageName <> 'Closed'` (`<>`)
- `Owner.Name = 'Ada'` (a relationship path)
- `A = 'x' AND B = 'y' OR C = 'z'` (AND and OR mixed without parentheses)
- `Industry = NULL` (a bare `NULL`, which the builder would write as text)
- `Name IN ('Smith, Jones', 'Lee')` (a list item containing a comma)
- `Name LIKE 'Acme'` (an exact-match `LIKE` with no `%` or `_`, which the builder would wrap in `%`)
- `Name LIKE '50\%'` (a `LIKE` value with an escaped `\%` or `\_`, which the builder would rewrite with a doubled backslash)

## What Apex accepts

The parser (`NewtonSelectorWhereParser`) is a recursive-descent parser. Keywords are case-insensitive.

```
or        := and ( OR and )*
and       := factor ( AND factor )*
factor    := '(' or ')' | condition
condition := identifier operator literal
           | identifier ( IN | NOT IN | INCLUDES | EXCLUDES ) '(' literal ( ',' literal )* ')'
```

| Element        | Rule                                                                                                                                                                                                                                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identifier     | Letters, digits and underscore only. Relationship paths such as `Owner.Name` are not supported.                                                                                                                                                                                                                  |
| Operators      | `=` `!=` `<` `<=` `>` `>=` `LIKE` `IN` `NOT IN` `INCLUDES` `EXCLUDES`. `NOT LIKE` is rejected. `<>` and `==` are rejected with `Unexpected "<c>" in WHERE value near: ...`.                                                                                                                                      |
| Quoted literal | `'...'`. `\'` and `\\` are accepted anywhere. `\%` and `\_` are accepted only in a `LIKE` value, where they match a literal `%` or `_`; a `LIKE` value also keeps `\\` as a literal backslash. Any other escape (`\n`, `\t`, ...) fails with `Unsupported escape sequence ...`. A doubled `''` is not supported. |
| Bare literal   | Ends at whitespace, comma or `)`, so a space inside an unquoted value is not allowed. It may not start with `=`, `<`, `>`, `!` or `(`.                                                                                                                                                                           |
| `NULL`         | A bare `NULL` (any case) becomes a null bind. A quoted `'null'` is the text `null`.                                                                                                                                                                                                                              |
| Booleans       | `TRUE` or `FALSE`, any case. Anything else is an error.                                                                                                                                                                                                                                                          |
| Numbers        | Parsed with `Integer`, `Long` or `Decimal` `valueOf` according to the field type.                                                                                                                                                                                                                                |
| Date           | `yyyy-MM-dd`                                                                                                                                                                                                                                                                                                     |
| Datetime       | ISO 8601 / SOQL `yyyy-MM-ddTHH:mm:ssZ`, or with a `+hh:mm` / `-hh:mm` offset. Read as an absolute instant.                                                                                                                                                                                                       |
| Time           | `HH:mm:ss` or `HH:mm:ss.SSSZ`                                                                                                                                                                                                                                                                                    |

Every value becomes a named bind (`newtonBind0`, `newtonBind1`, …), `INCLUDES` and `EXCLUDES` values included. `INCLUDES` and `EXCLUDES` require a MULTIPICKLIST field. List values are bound exactly as written; a quoted value keeps its spaces.

A value that does not fit the field's type fails with a message that names the field, its type and the value, for example `Invalid value for NumberOfEmployees (INTEGER): abc`.

Not supported: SOQL date literals (`TODAY`, `LAST_N_DAYS:7`), a `NOT` prefix, `IS NULL`, subqueries, and `ORDER BY` or `LIMIT` text. Use the dedicated **Order by** and **Rows to load** settings instead.

## Flow values (merge fields)

Flow replaces each merge field with its value inside `selectorConfigJson` before the component reads it, so the value becomes part of the clause text that Apex parses. That is why the builder quotes text-like merge fields and blocks them in lists. The remaining limits:

- A double quote, backslash or line break in a merged value breaks the saved configuration. The screen then shows "This selector's saved configuration can't be read (...)" with the cause instead of options.
- A single quote in a merged text value ends the text early, and the rest of the value is read as more of the clause. A crafted value can add conditions and widen the filter, but every value is still a bind and the query runs in `USER_MODE`, so it can only return records the user can already see. A value that does not parse fails with a WHERE error.

The editor has no run-time values for merge fields:

- **Validate query** swaps each merge field that is the whole value after `Field <operator>` for a sample value of its field's type (for example `0`, `2000-01-01` or `FALSE`; a text field keeps the quoted `'{!Var}'`), so the syntax, fields, operators and value types are still checked. A merge field inside a longer quoted value, such as `'%{!Var}%'`, stays as typed. Its success message adds "Flow values were checked with sample values; the flow fills in the real ones at run time."
- **Load sample rows** ignores the WHERE clause when it holds a Flow value anywhere, including inside a quoted value such as `'%{!Var}%'` or `'Acme {!Var}'`, and says "Sample rows ignore the WHERE clause because it uses Flow values."

## Where the builder and Apex disagree

These gaps are real as of this writing. See [Known limitations](known-limitations.md) for workarounds.

1. **The manual WHERE clause is not checked in the editor.** The **Manual WHERE clause** textarea saves whatever you type, and Save is not blocked. Several of the clauses that switch the card to manual mode are ones Apex rejects (`NOT LIKE`, `<>`, relationship paths). Click **Validate query** to see the real error before you save.

## Dates and times

Type `2026-01-31` for a Date field, `2026-01-31T14:30:00Z` for a Datetime field (or `2026-01-31T14:30:00-05:00` with an offset), and `14:30:00` for a Time field. A space-separated value such as `2026-01-31 14:30:00` is not accepted.

## Related

- [How to build a SOQL selector](howto-build-a-soql-selector.md)
- [Apex API reference](reference-apex-api.md)
- [Known limitations](known-limitations.md)
