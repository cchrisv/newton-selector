# Reference: Apex API

Every Apex class in Newton Selector, the methods the LWC layer calls, and the data shapes they exchange. Source lives in `force-app/main/default/classes/`. All classes are API 66.0.

For how these classes cooperate, read [Architecture](architecture.md). For the security reasoning, read [Security model](explanation-security-model.md). For the WHERE grammar, read [WHERE clause reference](reference-where-clause.md).

## Entry points (`@AuraEnabled`)

### `NewtonSelectorRuntimeController`

`public with sharing`. Called by the Flow screen at runtime and by the CPE at design time.

| Method                             | Cacheable | Returns                                  |
| ---------------------------------- | --------- | ---------------------------------------- |
| `queryItems(String configJson)`    | no        | `List<NewtonSelectorItemDTO>`            |
| `validateQuery(String configJson)` | no        | `NewtonSelectorQueryValidationResultDTO` |

`configJson` is a serialized [`NewtonSelectorQueryDTO`](#newtonselectorquerydto). `queryItems` is not cacheable, so each mount of the Flow screen reads current records, including records changed earlier in the Flow.

**`queryItems`** throws an `AuraHandledException` on failure. It never returns partial results.

| Cause                                           | Message the caller sees                            |
| ----------------------------------------------- | -------------------------------------------------- |
| Blank config, or the JSON literal `null`        | `Selector configuration is required.`              |
| Malformed JSON, or a key of the wrong JSON type | `Invalid selector configuration: <parser message>` |
| A `NewtonSelectorException` (see below)         | That exception's message                           |
| A database error                                | The database's own error message                   |

**`validateQuery`** never throws. It forces `queryLimit = 1` and runs the query once, so permission and query problems surface while the admin is still in the CPE.

| Outcome                                         | `valid` | `message`                                          |
| ----------------------------------------------- | ------- | -------------------------------------------------- |
| Success                                         | `true`  | `Query validated successfully.`                    |
| Malformed JSON, or a key of the wrong JSON type | `false` | `Invalid selector configuration: <parser message>` |
| Any other failure, including a database error   | `false` | The real error message                             |

The result carries no SOQL text. The editor's **SOQL preview** card builds its own readable query from the settings.

### `NewtonSelectorFlowCpeController`

`public with sharing`. Design time only. All methods are `cacheable=true`. They power the object and field pickers in the CPE.

| Method                                 | Returns              | Behavior                                                                                                                                                                                                  |
| -------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `searchSObjectTypes(String searchKey)` | `List<ChoiceOption>` | Queryable, accessible objects whose label or API name matches the key. Sorted by label and capped at 80 rows.                                                                                             |
| `getObjectFields(String objectName)`   | `List<Field>`        | Every accessible field on the object except BASE64, ADDRESS and LOCATION types, with name, label, type and the filterable and sortable flags. Unsorted and uncapped. The object name is case-insensitive. |

Inner types:

| Type           | Fields                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `ChoiceOption` | `value`, `label`, `subtitle`, `icon`, `sObjectType`. Sorts by label.                                                                 |
| `Field`        | `name`, `label`, `type`, `filterable` (usable in WHERE, from `isFilterable()`), `sortable` (usable in ORDER BY, from `isSortable()`) |

Notes:

- `getObjectFields` is the editor's Apex field describe. The field pickers, the WHERE builder, **Validate query** (for the sample values it puts in place of Flow values) and the resource picker's global-variable field lists (`$User`, `$Profile`, `$UserRole`, `$Record`, `$Record__Prior`) call it. The resource picker's record-variable drill-in uses the UI API `getObjectInfo` wire instead, so its field list can include types `getObjectFields` leaves out, such as compound address fields.
- `type` is the field's `Schema.DisplayType` name (for example `STRING`, `CURRENCY`, `BOOLEAN`). The WHERE builder uses it to choose operators, value inputs and quoting.
- The WHERE builder's Field picker offers only `filterable` fields. The **Order by** picker offers only `sortable` fields.
- Apex returns an icon only for object rows (`box`). Field-type icons come from `TYPE_ICON_MAP` in `newtonSelectorFlowCpeUtilityHelpers`; `npm run audit:lucide-icons` checks that every name in it exists.
- A blank, unknown or inaccessible object reaches the picker as an `AuraHandledException` carrying `Object API name is required.`, `Unknown object: <name>` or `Object not accessible: <name>`. The picker shows it as "Couldn't load fields: <message>".
- `getObjectFields` does not check that the object is queryable. `searchSObjectTypes` does.

## Data shapes

### `NewtonSelectorQueryDTO`

The request. No sharing keyword (pure data holder).

| Field              | Type    | Default | Meaning                                                              |
| ------------------ | ------- | ------- | -------------------------------------------------------------------- |
| `sObjectApiName`   | String  |         | Object to query. Required.                                           |
| `whereClause`      | String  |         | WHERE text (without the `WHERE` keyword). See the grammar reference. |
| `orderByField`     | String  |         | Field to sort by. Must be accessible and sortable.                   |
| `orderByDirection` | String  | `ASC`   | `ASC` or `DESC`. Anything else is an error.                          |
| `queryLimit`       | Integer | `50`    | Clamped to a hard maximum of 2,000.                                  |
| `labelField`       | String  | `Name`  | Becomes `label`.                                                     |
| `valueField`       | String  | `Id`    | Becomes `value`. A record with a blank value gets its Id instead.    |
| `sublabelField`    | String  |         | Becomes `sublabel`.                                                  |
| `iconField`        | String  |         | Becomes `icon`.                                                      |
| `badgeField`       | String  |         | Becomes `badge`.                                                     |
| `helpField`        | String  |         | Becomes `helpText`.                                                  |

### `NewtonSelectorItemDTO`

One selectable option.

| Field      | Type    | Notes                                                                     |
| ---------- | ------- | ------------------------------------------------------------------------- |
| `id`       | String  | The record Id                                                             |
| `label`    | String  | From `labelField`                                                         |
| `sublabel` | String  | From `sublabelField`                                                      |
| `icon`     | String  | From `iconField`                                                          |
| `badge`    | String  | From `badgeField`                                                         |
| `helpText` | String  | From `helpField`                                                          |
| `value`    | String  | From `valueField`; the record Id when that field is blank on the record   |
| `record`   | SObject | The queried row (`Id` plus the configured fields); feeds `selectedRecord` |

### `NewtonSelectorQueryValidationResultDTO`

`valid` (Boolean) and `message` (String). Built with the constructor `new NewtonSelectorQueryValidationResultDTO(valid, message)`.

### `NewtonSelectorException`

A typed exception for expected, user-readable problems (bad field name, inaccessible object, WHERE syntax error). The controller turns its message into an `AuraHandledException`, so these messages reach the admin's screen verbatim. See [message catalog](#message-catalog).

## Internal classes

| Class                               | Role                                                                                                                                                                                                                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NewtonSelectorService`             | `fetchItems(config)`: runs the query and maps each record to a `NewtonSelectorItemDTO` using the field mappings in the config.                                                                                                                                        |
| `NewtonSelectorRecordQuery`         | `query(config)`. Runs `Database.queryWithBinds(soql, binds, AccessLevel.USER_MODE)`.                                                                                                                                                                                  |
| `NewtonSelectorQueryBuilder`        | Builds the SOQL string and bind map. Enforces the default (50) and hard cap (2,000) limits, the ASC/DESC allowlist and a sortable ORDER BY field.                                                                                                                     |
| `NewtonSelectorQueryFieldAccess`    | Describe-based checks: object exists and is accessible, each field exists, is accessible and (in WHERE) filterable or (in ORDER BY) sortable. Resolves canonical API names. Its `describeAccessibleObject` is shared with the CPE field describe (`getObjectFields`). |
| `NewtonSelectorQueryValueUtil`      | Coerces WHERE values to the field's type (String, Boolean, Integer, Long, Decimal, Date, Datetime as ISO 8601, Time) and names the field and value when one does not fit.                                                                                             |
| `NewtonSelectorWhereParser`         | Recursive-descent parser for the WHERE text. Emits predicate text plus binds.                                                                                                                                                                                         |
| `NewtonSelectorWhereScanner`        | Character-level tokenizer used by the parser (identifiers, keywords, literals, parentheses).                                                                                                                                                                          |
| `NewtonSelectorWhereQuotedString`   | Reads one single-quoted WHERE value for the scanner. Resolves the `\'` and `\\` escapes, keeps `\%`, `\_` and `\\` for LIKE binds, and reports an unterminated string.                                                                                                |
| `NewtonSelectorWhereOperatorParser` | Reads and validates the comparison operator.                                                                                                                                                                                                                          |

## Limits and caps

| Limit                     | Value | Where                             |
| ------------------------- | ----- | --------------------------------- |
| Default query limit       | 50    | `NewtonSelectorQueryBuilder`      |
| Hard maximum query limit  | 2,000 | `NewtonSelectorQueryBuilder`      |
| Validation preview limit  | 1     | `validateQuery`                   |
| CPE object search results | 80    | `NewtonSelectorFlowCpeController` |

## Message catalog

These are the messages an admin can see from `validateQuery` or a failed `queryItems`. In the WHERE messages, `<text>` is the unparsed rest of the clause, or `end of WHERE clause` when the input runs out.

| Message                                                                                                     | Trigger                                                                                             |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `Selector configuration is required.`                                                                       | Blank config or JSON `null`                                                                         |
| `Invalid selector configuration: <parser message>`                                                          | Malformed JSON, or a key with the wrong JSON type (for example an array where a string is expected) |
| `Object API name is required.`                                                                              | No `sObjectApiName`                                                                                 |
| `Unknown object: <name>`                                                                                    | Object not in the org                                                                               |
| `Object not accessible: <name>`                                                                             | User lacks access to the object                                                                     |
| `Object not queryable: <name>`                                                                              | The user can read the object but it cannot be queried                                               |
| `Unknown field on <object>: <field>`                                                                        | Field does not exist                                                                                |
| `Field not accessible on <object>: <field>`                                                                 | User lacks field-level access                                                                       |
| `Field not filterable on <object>: <field>`                                                                 | Field cannot appear in WHERE                                                                        |
| `Field not sortable on <object>: <field>`                                                                   | The ORDER BY field cannot be sorted                                                                 |
| `Invalid sort direction: <dir>. Use ASC or DESC.`                                                           | `orderByDirection` is not `ASC` or `DESC`                                                           |
| `Invalid value for <field> (<TYPE>): <value>`                                                               | A WHERE value does not fit the field's type                                                         |
| `<OP> is only supported for multi-select picklist fields: <field>`                                          | INCLUDES/EXCLUDES on another field type                                                             |
| `Expected field name in WHERE clause near: <text>`                                                          | WHERE parse error (see [known limitations](known-limitations.md))                                   |
| `Expected WHERE operator after <field> near: <text>`                                                        | WHERE parse error                                                                                   |
| `Unsupported WHERE operator after <field>: NOT <text>`                                                      | `NOT` followed by anything but `IN`, for example `NOT LIKE`                                         |
| `Expected WHERE value near: <text>`                                                                         | WHERE parse error                                                                                   |
| `Unexpected "<char>" in WHERE value near: <rest>`                                                           | A value that starts with `=`, `<`, `>`, `!` or `(`, for example after `<>` or `==`                  |
| `Unterminated string in WHERE clause: <text from the opening quote>`                                        | Missing closing quote                                                                               |
| `Unsupported escape sequence \<c> in WHERE value. Use \' or \\ anywhere, and \% or \_ only in LIKE values.` | A backslash escape other than `\'` and `\\`, or `\%` / `\_` outside a LIKE value                    |
| `Expected "<token>" in WHERE clause near: <text>`                                                           | Missing `)` or similar                                                                              |
| `Unsupported WHERE clause near: <rest>`                                                                     | Trailing text the parser cannot consume                                                             |

`queryItems` and `validateQuery` report a database error (an unexpected failure while running the query) with the database's own message, never a stack trace. That includes objects served by a platform data source, which reject some queries: FlexQueueItem, for example, fails with `data.api.DataSourceUnsupportedQueryException: The WHERE clause must contain a JobType field expression.` until the filter names a JobType.

## Tests

| Class                                 | Methods | Covers                                                                                                                                                                                                                                                                                                          |
| ------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NewtonSelectorRecordQueryTest`       | 15      | ASC and DESC ordering; value coercion for each primitive type, including ISO datetime and TIME values, and malformed TIME values; sort errors; default, applied and capped limits; blank, unknown and inaccessible object errors; unknown, inaccessible and non-filterable field errors; sharing                |
| `NewtonSelectorWhereParserTest`       | 14      | The comparison, LIKE, IN, NOT IN and INCLUDES operators, with comparison boundaries; INCLUDES rejected on a single picklist; grouped AND/OR clauses; unsafe and malformed WHERE text; `NOT LIKE` rejection; LIKE escapes; bare and quoted `null`; literals that do not fit the field type; ISO datetime filters |
| `NewtonSelectorRuntimeControllerTest` | 11      | `queryItems` and `validateQuery` success and error paths, exact error messages, database and platform data-source errors reported by both                                                                                                                                                                       |
| `NewtonSelectorServiceTest`           | 3       | DTO mapping, default label (Name) and value (Id), 251-row bulk                                                                                                                                                                                                                                                  |
| `NewtonSelectorFlowCpeControllerTest` | 7       | Object search; `getObjectFields` types and filterable/sortable flags; omitted unreadable and compound address fields; blank, unknown and inaccessible object errors; case-insensitive object names                                                                                                              |

`NewtonSelectorTestDataFactory` creates the Accounts the tests share and the test users: a Standard User whose test permission set grants read-only access to Account, Contact and a few of their fields, and a user who also has View Setup for the FlexQueueItem tests. Tests run as these users through `System.runAs`.

## Related

- [Architecture](architecture.md)
- [Security model](explanation-security-model.md)
- [WHERE clause reference](reference-where-clause.md)
- [Known limitations](known-limitations.md)
