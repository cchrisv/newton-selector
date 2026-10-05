# Reference: Apex API

Every Apex class in Newton Selector, the methods the LWC layer calls, and the data shapes they exchange. Source lives in `force-app/main/default/classes/`. All classes are API 66.0.

For how these classes cooperate, read [Architecture](architecture.md). For the security reasoning, read [Security model](explanation-security-model.md). For the WHERE grammar, read [WHERE clause reference](reference-where-clause.md).

## Entry points (`@AuraEnabled`)

### `NewtonSelectorRuntimeController`

`public with sharing`. Called by the Flow screen at runtime and by the CPE at design time.

| Method                             | Cacheable | Returns                                  |
| ---------------------------------- | --------- | ---------------------------------------- |
| `queryItems(String configJson)`    | yes       | `List<NewtonSelectorItemDTO>`            |
| `validateQuery(String configJson)` | no        | `NewtonSelectorQueryValidationResultDTO` |

`configJson` is a serialized [`NewtonSelectorQueryDTO`](#newtonselectorquerydto).

**`queryItems`** throws an `AuraHandledException` on failure. It never returns partial results.

| Cause                                    | Message the caller sees               |
| ---------------------------------------- | ------------------------------------- |
| Blank config, or the JSON literal `null` | `Selector configuration is required.` |
| Malformed JSON                           | `Invalid selector configuration.`     |
| A `NewtonSelectorException` (see below)  | That exception's message              |
| A database error                         | The database's own error message      |

**`validateQuery`** never throws. It forces `queryLimit = 1` and runs the query once, so permission and query problems surface while the admin is still in the CPE.

| Outcome                                       | `valid` | `message`                         |
| --------------------------------------------- | ------- | --------------------------------- |
| Success                                       | `true`  | `Query validated successfully.`   |
| Malformed JSON                                | `false` | `Invalid selector configuration.` |
| Any other failure, including a database error | `false` | The real error message            |

The result carries no SOQL text. The editor's **SOQL preview** card builds its own readable query from the settings.

### `NewtonSelectorFlowCpeController`

`public with sharing`. Design time only. All methods are `cacheable=true`. They power the object and field pickers in the CPE.

| Method                                                                       | Returns              | Behavior                                                                                                                       |
| ---------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `searchSObjectTypes(String searchKey)`                                       | `List<ChoiceOption>` | Queryable, accessible objects whose label or API name matches the key. Capped at 80 rows.                                      |
| `searchLookupDatasetFieldsForObject(String objectApiName, String searchKey)` | `List<ChoiceOption>` | Fields on one object matching the key. Capped at 2,000 rows. Skips inaccessible fields and BASE64, ADDRESS and LOCATION types. |
| `getObjectFields(String objectName)`                                         | `List<Field>`        | Every accessible field on the object with type and relationship metadata. Unsorted and uncapped.                               |

Inner types:

| Type           | Fields                                                                       |
| -------------- | ---------------------------------------------------------------------------- |
| `ChoiceOption` | `value`, `label`, `subtitle`, `icon`, `sObjectType`, `type`. Sorts by label. |
| `Field`        | `name`, `label`, `type`, `relationshipName`                                  |

Notes:

- Field options carry `type`, the field's `Schema.DisplayType` name (for example `STRING`, `CURRENCY`, `BOOLEAN`). The WHERE builder uses it to choose operators, value inputs and quoting.
- Icons come back as Lucide icon names for the field type (for example `type`, `hash`, `calendar`), defaulting to `type`. The type-to-icon map lives in `NewtonSelectorFlowCpeDescribeService`; `npm run audit:lucide-icons` checks that every name in it exists.
- Single-target reference fields carry `relationshipName`. Polymorphic references do not.
- An unexpected database error while searching or describing reaches the editor as an `AuraHandledException` with a clear message, which the picker shows in place of results.
- `searchLookupDatasetFieldsForObject` does not check that the object itself is accessible or queryable. `searchSObjectTypes` does.

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
| `valueField`       | String  | `Id`    | Becomes `value`.                                                     |
| `sublabelField`    | String  |         | Becomes `sublabel`.                                                  |
| `iconField`        | String  |         | Becomes `icon`.                                                      |
| `badgeField`       | String  |         | Becomes `badge`.                                                     |
| `helpField`        | String  |         | Becomes `helpText`.                                                  |

### `NewtonSelectorItemDTO`

One selectable option.

| Field      | Type   | Notes                |
| ---------- | ------ | -------------------- |
| `id`       | String | The record Id        |
| `label`    | String | From `labelField`    |
| `sublabel` | String | From `sublabelField` |
| `icon`     | String | From `iconField`     |
| `badge`    | String | From `badgeField`    |
| `helpText` | String | From `helpField`     |
| `value`    | String | From `valueField`    |

### `NewtonSelectorQueryValidationResultDTO`

`valid` (Boolean) and `message` (String). Built with the static helpers `success(message)` and `failure(message)`.

### `NewtonSelectorException`

A typed exception for expected, user-readable problems (bad field name, inaccessible object, WHERE syntax error). The controller turns its message into an `AuraHandledException`, so these messages reach the admin's screen verbatim. See [message catalog](#message-catalog).

## Internal classes

| Class                                  | Role                                                                                                                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NewtonSelectorService`                | `fetchItems(config)`: runs the query and maps each record to a `NewtonSelectorItemDTO` using the field mappings in the config. A null config yields an empty list.          |
| `NewtonSelectorRecordQuery`            | `query(config)`. Runs `Database.queryWithBinds(soql, binds, AccessLevel.USER_MODE)`.                                                                                        |
| `NewtonSelectorQueryBuilder`           | Builds the SOQL string and bind map. Enforces the default (50) and hard cap (2,000) limits, the ASC/DESC allowlist and a sortable ORDER BY field.                           |
| `NewtonSelectorQueryFieldAccess`       | Describe-based checks: object exists and is accessible, each field exists, is accessible and (in WHERE) filterable or (in ORDER BY) sortable. Resolves canonical API names. |
| `NewtonSelectorQueryValueUtil`         | Coerces WHERE values to the field's type (String, Boolean, Integer, Long, Decimal, Date, Datetime) and names the field and value when one does not fit.                     |
| `NewtonSelectorWhereParser`            | Recursive-descent parser for the WHERE text. Emits predicate text plus binds.                                                                                               |
| `NewtonSelectorWhereScanner`           | Character-level tokenizer used by the parser (identifiers, keywords, literals, parentheses).                                                                                |
| `NewtonSelectorWhereOperatorParser`    | Reads and validates the comparison operator.                                                                                                                                |
| `NewtonSelectorFlowCpeDescribeService` | Describe work behind `FlowCpeController`, including the field-type icon map.                                                                                                |

## Limits and caps

| Limit                     | Value | Where                                  |
| ------------------------- | ----- | -------------------------------------- |
| Default query limit       | 50    | `NewtonSelectorQueryBuilder`           |
| Hard maximum query limit  | 2,000 | `NewtonSelectorQueryBuilder`           |
| Validation preview limit  | 1     | `validateQuery`                        |
| CPE object search results | 80    | `NewtonSelectorFlowCpeDescribeService` |
| CPE field search results  | 2,000 | `NewtonSelectorFlowCpeDescribeService` |

## Message catalog

These are the messages an admin can see from `validateQuery` or a failed `queryItems`.

| Message                                                          | Trigger                                                           |
| ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| `Selector configuration is required.`                            | Blank config or JSON `null`                                       |
| `Invalid selector configuration.`                                | Malformed JSON                                                    |
| `Object API name is required.`                                   | No `sObjectApiName`                                               |
| `Unknown object: <name>`                                         | Object not in the org                                             |
| `Object not accessible: <name>`                                  | User lacks access or the object is not queryable                  |
| `Unknown field on <object>: <field>`                             | Field does not exist                                              |
| `Field not accessible on <object>: <field>`                      | User lacks field-level access                                     |
| `Field not filterable on <object>: <field>`                      | Field cannot appear in WHERE                                      |
| `Field not sortable on <object>: <field>`                        | The ORDER BY field cannot be sorted                               |
| `Invalid sort direction: <dir>. Use ASC or DESC.`                | `orderByDirection` is not `ASC` or `DESC`                         |
| `Invalid value for <field> (<TYPE>): <value>`                    | A WHERE value does not fit the field's type                       |
| `<OP> is only supported for multi-select picklist fields.`       | INCLUDES/EXCLUDES on another field type                           |
| `At least one multi-select picklist value is required for <op>.` | INCLUDES/EXCLUDES with no values                                  |
| `Expected field name in WHERE clause.`                           | WHERE parse error (see [known limitations](known-limitations.md)) |
| `Expected WHERE operator.`                                       | WHERE parse error                                                 |
| `Unsupported WHERE operator.`                                    | WHERE parse error                                                 |
| `Expected WHERE value.`                                          | WHERE parse error                                                 |
| `Unterminated string in WHERE clause.`                           | Missing closing quote                                             |
| `Expected "<token>" in WHERE clause.`                            | Missing `)` or similar                                            |
| `Unsupported WHERE clause near: <rest>`                          | Trailing text the parser cannot consume                           |

`queryItems` and `validateQuery` report a database error (an unexpected failure while running the query) with the database's own message, never a stack trace. That includes objects served by a platform data source, which reject some queries: FlexQueueItem, for example, fails with `data.api.DataSourceUnsupportedQueryException: The WHERE clause must contain a JobType field expression.` until the filter names a JobType.

## Tests

| Class                                 | Methods | Covers                                                                                                                                                                                 |
| ------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NewtonSelectorRecordQueryTest`       | 27      | Ordering, every WHERE operator, grouped AND/OR clauses, INCLUDES, `NOT LIKE` rejection, bare and quoted `null`, type errors, sort errors, limits, access errors, sharing, 251-row bulk |
| `NewtonSelectorRuntimeControllerTest` | 15      | `queryItems` and `validateQuery` success and error paths, exact error messages, database and platform data-source errors reported by both                                              |
| `NewtonSelectorServiceTest`           | 3       | DTO mapping, null config, bulk                                                                                                                                                         |
| `NewtonSelectorFlowCpeControllerTest` | 13      | Object search, field search, `getObjectFields`, reference metadata                                                                                                                     |

`NewtonSelectorTestDataFactory` creates the Accounts the tests share. Tests run as a Standard User through `System.runAs`.

Not yet covered by tests: WHERE scanner errors (an unterminated string, a missing `)`) and DESC ordering.

## Related

- [Architecture](architecture.md)
- [Security model](explanation-security-model.md)
- [WHERE clause reference](reference-where-clause.md)
- [Known limitations](known-limitations.md)
