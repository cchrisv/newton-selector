# Reference: WHERE clause

The SOQL data source filters records with a WHERE clause. Admins normally build it in the CPE's visual **Where clause builder**. The builder saves plain text into the config (`sobject.whereClause`), and Apex parses that text at runtime. This page documents both sides, including where they disagree.

## Builder operators by field type

| Field type                                                                    | Operators                     | Value input                    |
| ----------------------------------------------------------------------------- | ----------------------------- | ------------------------------ |
| Text (STRING, TEXTAREA, URL, EMAIL, PHONE, ENCRYPTEDSTRING) and unknown types | `=` `!=` `LIKE` `IN` `NOT IN` | Text or merge field            |
| Number (INTEGER, LONG, DOUBLE, CURRENCY, PERCENT)                             | `=` `!=` `<` `>` `<=` `>=`    | Number or merge field          |
| BOOLEAN                                                                       | `=` `!=`                      | TRUE / FALSE picker            |
| DATE, DATETIME, TIME                                                          | `=` `!=` `<` `>` `<=` `>=`    | Raw text (see [Dates](#dates)) |
| PICKLIST, COMBOBOX                                                            | `=` `!=` `IN` `NOT IN`        | Text or merge field            |
| MULTIPICKLIST                                                                 | `INCLUDES` `EXCLUDES`         | Comma-separated list           |
| REFERENCE, ID                                                                 | `=` `!=` `IN` `NOT IN`        | Id text or merge field         |

List operators (`IN`, `NOT IN`, `INCLUDES`, `EXCLUDES`) accept a comma-separated list, or a single `{!Collection}` merge field that supplies the whole list.

The builder knows each field's type from the field picker, so the value input, the operators and the quoting follow the type. A Flow resource picked from the value's resource selector is stored as a merge field, for example `{!varRegion}`.

## Builder grouping and logic

- The root group has an **AND / OR** toggle. Every nested group has its own.
- Toolbar actions: Group, Group with next, Indent, Outdent, Ungroup, move up and down, drag and drop, Add condition.
- There is no NOT group and no numbered custom-logic string such as `1 AND (2 OR 3)`.

## What the builder writes

| Value kind                   | Serialized as                       |
| ---------------------------- | ----------------------------------- |
| Text, picklist, reference    | Single-quoted and escaped: `'Acme'` |
| Number                       | Unquoted: `42`                      |
| BOOLEAN                      | `TRUE` or `FALSE`                   |
| DATE, DATETIME               | Unquoted, exactly as typed          |
| List                         | `('a','b')` or `(1,2)`              |
| `LIKE` with no `%` or `_`    | Wrapped as `'%text%'`               |
| `LIKE` containing `%` or `_` | Used as typed                       |
| Merge field `{!Var}`         | Stored as `{!Var}`, unquoted        |

A nested group is wrapped in parentheses: `A = 'x' AND (B = 'y' OR C = 'z')`.

A blank condition you haven't touched is ignored. A condition that is only partly filled in is highlighted and blocks Save with "Finish or remove the highlighted filter condition." The saved clause contains only complete conditions, so a selector never saves with a filter silently dropped.

A clause the builder cannot rebuild (for example one using `NOT LIKE`, or mixing AND and OR without parentheses) switches the card to a **Manual WHERE clause** textarea with a **Rebuild visually** button.

## What Apex accepts

The parser (`NewtonSelectorWhereParser`) is a recursive-descent parser. Keywords are case-insensitive.

```
or        := and ( OR and )*
and       := factor ( AND factor )*
factor    := '(' or ')' | condition
condition := identifier operator literal
           | identifier ( IN | NOT IN | INCLUDES | EXCLUDES ) '(' literal ( ',' literal )* ')'
```

| Element        | Rule                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| Identifier     | Letters, digits and underscore only. Relationship paths such as `Owner.Name` are not supported.          |
| Operators      | `=` `!=` `<` `<=` `>` `>=` `LIKE` `IN` `NOT IN` `INCLUDES` `EXCLUDES`. `NOT LIKE` and `<>` are rejected. |
| Quoted literal | `'...'` with backslash escapes. A doubled `''` is not supported.                                         |
| Bare literal   | Ends at whitespace, comma or `)`.                                                                        |
| `NULL`         | A bare `NULL` (any case) becomes a null bind. A quoted `'null'` is the text `null`.                      |
| Booleans       | `TRUE` or `FALSE`, any case. Anything else is an error.                                                  |
| Numbers        | Parsed with `Integer`, `Long` or `Decimal` `valueOf` according to the field type.                        |
| Date           | `yyyy-MM-dd`                                                                                             |
| Datetime       | `yyyy-MM-dd HH:mm:ss`                                                                                    |

Every value becomes a named bind (`newtonBind0`, `newtonBind1`, …). The one exception is `INCLUDES` and `EXCLUDES`: their values are inlined as escaped literals, and the field must be a MULTIPICKLIST.

A value that does not fit the field's type fails with a message that names the field, its type and the value, for example `Invalid value for NumberOfEmployees (INTEGER): abc`.

Not supported: SOQL date literals (`TODAY`, `LAST_N_DAYS:7`), a `NOT` prefix, `IS NULL`, subqueries, and `ORDER BY` or `LIMIT` text. Use the dedicated **Order by** and **Rows to load** settings instead.

## Where the builder and Apex disagree

These gaps are real as of this writing. See [Known limitations](known-limitations.md) for workarounds.

1. **Dates and SOQL date literals.** The builder passes them through unquoted. `TODAY` and similar fail type coercion with `Invalid value for <field> (<type>): <value>`. Write explicit `yyyy-MM-dd` or `yyyy-MM-dd HH:mm:ss` values.

## Dates

Type `2026-01-31` for a Date field and `2026-01-31 14:30:00` for a Datetime field. Nothing else is accepted.

## Related

- [How to build a SOQL selector](howto-build-a-soql-selector.md)
- [Apex API reference](reference-apex-api.md)
- [Known limitations](known-limitations.md)
