# Explanation: the security model

Newton Selector lets an admin type an object name, a field name and a WHERE clause into a Flow Builder panel, and then runs a query built from that text for every end user who reaches the screen. That is a dynamic-query feature, which is the classic place for injection bugs and data leaks. This page explains how the Apex layer avoids both, and where the guarantees stop.

## The problem

Two things can go wrong with an admin-configurable query:

1. **Injection.** Text from the config ends up inside a SOQL string. If a value or field name can break out of its slot, it can change what the query does.
2. **Over-reading.** The query runs on behalf of an end user. If it ignores their permissions, a Flow screen becomes a way to read records and fields the user could never see in the UI.

## The approach

```
config JSON (from Flow)
     |
     v
 parse into QueryDTO ---- malformed? -> "Invalid selector configuration: <parser message>"
     |
     v
 FieldAccess (describe checks)         <- names are validated BEFORE they touch SOQL
   object exists + accessible + queryable
   every field exists + accessible (+ filterable if used in WHERE)
     |
     v
 QueryBuilder
   object / field names: canonical API names from describe, never raw input
   ORDER BY: sortable field; direction allowlist ASC | DESC (anything else is an error)
   LIMIT: default 50, clamped to 2000
   WHERE values: named binds (:newtonBind0, :newtonBind1 ...)
     |
     v
 Database.queryWithBinds(soql, binds, AccessLevel.USER_MODE)
     |
     v
 records the running user may see, with only the fields they may read
```

**Names are validated, then rebuilt.** An object or field name from the config is checked against the org's describe results. The SOQL uses the canonical name from describe, not the string the admin typed. A name that is not in the describe map is rejected before any SOQL exists.

**Values are binds.** Every value in a WHERE clause, including the values of `INCLUDES` and `EXCLUDES`, is passed as a named bind variable. The query text never contains the user's literal.

**The WHERE text is parsed, not passed through.** WHERE text is not appended to the query. A small parser turns it into an allowlisted predicate: known operators only, identifiers restricted to letters, digits and underscore, values extracted as literals and coerced to the field's type.

**Execution runs in user mode.** Every class that queries or describes is `with sharing`, and the query runs with `AccessLevel.USER_MODE`. Salesforce enforces sharing, object CRUD and field-level security on the actual query. The describe checks run first only to give friendlier error messages.

**Errors name the problem, not the internals.** Expected problems (unknown field, inaccessible object, WHERE syntax, a value that does not fit its field) produce specific messages. An unexpected database error is reported with the database's own message, never a stack trace. `validateQuery` runs only from the editor, so the admin sees the same message before saving. Flow values don't exist yet in the editor, so **Validate query** checks a WHERE clause that holds them by substituting a sample value of each field's type: `0`, `2000-01-01`, `2000-01-01T00:00:00Z`, `00:00:00`, `FALSE` or a placeholder Id. Text values stay as the quoted `'{!Var}'`. Syntax, fields, operators and types are still checked.

## What you get

- An end user sees only records and field values they could read anywhere else in the org.
- A typo or hostile string typed as a WHERE value in the editor cannot change the shape of the query. A Flow value is different: see the merge-field limit below.
- A row cap (2,000) protects the org and the browser from an accidental "all records" query.

## Trade-offs and limits

- **No object allowlist.** Any object the _admin_ can name and the _user_ can query is reachable. Newton Selector adds no extra restriction. If you want to limit which objects selectors can read, do it with permissions.
- **Merge fields are spliced into the config.** Flow resolves a `{!Var}` merge field and inserts its text into `selectorConfigJson` before Apex sees it. The builder writes a text merge value quoted (`'{!Var}'`) and blocks merge fields for `IN`, `NOT IN`, `INCLUDES` and `EXCLUDES`, but the resolved text is not escaped. A double quote, backslash or line break in it breaks the configuration, and the selector shows an error naming that cause. A single quote ends the quoted value early, so a crafted text value can add conditions and widen the filter. The added conditions still go through the parser, their values are still binds, and the query still runs in `USER_MODE`, so a widened filter only reaches records the user can already see.
- **No logging.** Failures are mapped to messages and not recorded anywhere. Debugging a user's failure means reproducing it as that user.
- **Design-time pickers are looser.** `getObjectFields` checks that the object exists and is accessible (failing with `Unknown object: X` or `Object not accessible: X`) and returns only fields the user can access, but it does not check that the object is queryable, and it is uncapped. It does not run the same checks as the runtime path.
- **Display data is not secret.** Whatever the query returns is sent to the browser. Do not point the Label, Sublabel or Help field at data the user should not see; USER_MODE already prevents the ones they cannot read, but data they can read is shown.
- **Object and field access is yours.** The `Newton_Selector_User` permission set grants the runtime Apex class and `Newton_Selector_Admin` adds the editor's controller. Neither grants object or field access; users need that for whatever each selector reads.

## Alternatives considered

The code does not record rejected designs, but the shape of the classes shows the obvious ones that were avoided:

- Passing the WHERE text through to SOQL with `Database.query` (simplest, unsafe).
- Escaping values with `String.escapeSingleQuotes` and inlining them (works for strings, weak for typed values, and still concatenation).
- Running in system mode and filtering by hand (easy to miss FLS on one field).

## Related

- [Apex API reference](reference-apex-api.md)
- [WHERE clause reference](reference-where-clause.md)
- [Architecture](architecture.md)
