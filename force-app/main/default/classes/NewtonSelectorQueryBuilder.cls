/** @description Builds validated SOQL text and bind values for Newton Selector runtime queries. Owns the query defaults. */
public with sharing class NewtonSelectorQueryBuilder {
  private static final Integer DEFAULT_LIMIT = 50;
  private static final Integer MAX_LIMIT = 2000;
  private static final String DEFAULT_DIRECTION = 'ASC';
  private static final String DEFAULT_LABEL_FIELD = 'Name';
  private static final Set<String> ALLOWED_DIRECTIONS = new Set<String>{
    'ASC',
    'DESC'
  };

  /** @description Validated SOQL plus bind values ready for Database.queryWithBinds. */
  public class QueryParts {
    /** @description SOQL statement. */
    public String soql;
    /** @description Named bind values referenced by the SOQL statement. */
    public Map<String, Object> binds = new Map<String, Object>();
  }

  /**
   * @description Builds validated SOQL and named bind values from a selector config.
   * Fills a blank labelField with the default in place so record mapping reads the same field.
   * @param config Selector query configuration.
   * @return Validated SOQL and bind values.
   */
  public static QueryParts build(NewtonSelectorQueryDTO config) {
    if (String.isBlank(config.labelField)) {
      config.labelField = DEFAULT_LABEL_FIELD;
    }
    NewtonSelectorQueryFieldAccess access = new NewtonSelectorQueryFieldAccess(
      config.sObjectApiName
    );

    QueryParts queryParts = new QueryParts();
    queryParts.soql =
      'SELECT ' +
      String.join(selectFields(config, access), ', ') +
      ' FROM ' +
      access.objectName +
      buildWhere(config, access, queryParts.binds) +
      buildOrderBy(config, access) +
      ' LIMIT ' +
      effectiveLimit(config.queryLimit);
    return queryParts;
  }

  private static List<String> selectFields(
    NewtonSelectorQueryDTO config,
    NewtonSelectorQueryFieldAccess access
  ) {
    Set<String> fields = new Set<String>{ 'Id' };
    for (
      String fieldApiName : new List<String>{
        config.labelField,
        config.valueField,
        config.sublabelField,
        config.iconField,
        config.badgeField,
        config.helpField,
        config.orderByField
      }
    ) {
      if (String.isNotBlank(fieldApiName)) {
        fields.add(access.readableField(fieldApiName).getName());
      }
    }
    return new List<String>(fields);
  }

  private static String buildWhere(
    NewtonSelectorQueryDTO config,
    NewtonSelectorQueryFieldAccess access,
    Map<String, Object> binds
  ) {
    if (String.isBlank(config.whereClause)) {
      return '';
    }
    return ' WHERE ' +
      new NewtonSelectorWhereParser(access, config.whereClause, binds).parse();
  }

  private static String buildOrderBy(
    NewtonSelectorQueryDTO config,
    NewtonSelectorQueryFieldAccess access
  ) {
    if (String.isBlank(config.orderByField)) {
      return '';
    }

    String direction = String.isBlank(config.orderByDirection)
      ? DEFAULT_DIRECTION
      : config.orderByDirection.toUpperCase();
    if (!ALLOWED_DIRECTIONS.contains(direction)) {
      throw new NewtonSelectorException(
        'Invalid sort direction: ' +
          config.orderByDirection +
          '. Use ASC or DESC.'
      );
    }
    return ' ORDER BY ' +
      access.sortableField(config.orderByField).getName() +
      ' ' +
      direction;
  }

  private static Integer effectiveLimit(Integer requested) {
    if (requested == null || requested <= 0) {
      return DEFAULT_LIMIT;
    }
    return Math.min(requested, MAX_LIMIT);
  }
}
