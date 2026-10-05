/** @description Safe SOQL executor for Newton Selector runtime queries. */
public with sharing class NewtonSelectorRecordQuery {
  /**
   * @description Validates the config and executes the selector query in user mode.
   * @param config Selector query configuration.
   * @return Queried records.
   */
  public static List<SObject> query(NewtonSelectorQueryDTO config) {
    NewtonSelectorQueryBuilder.QueryParts queryParts = NewtonSelectorQueryBuilder.build(
      config
    );
    return Database.queryWithBinds(
      queryParts.soql,
      queryParts.binds,
      AccessLevel.USER_MODE
    );
  }
}
