/** @description Parses text WHERE clauses into validated bind-based SOQL fragments. */
public with sharing class NewtonSelectorWhereParser {
  private final NewtonSelectorQueryFieldAccess access;
  private final Map<String, Object> binds;
  private final NewtonSelectorWhereScanner scanner;

  /**
   * @description Creates a parser for one WHERE clause.
   * @param access Field access for the source object.
   * @param input WHERE clause without the WHERE keyword.
   * @param binds Shared query bind map.
   */
  public NewtonSelectorWhereParser(
    NewtonSelectorQueryFieldAccess access,
    String input,
    Map<String, Object> binds
  ) {
    this.access = access;
    this.binds = binds;
    this.scanner = new NewtonSelectorWhereScanner(input);
  }

  /**
   * @description Parses the configured WHERE clause.
   * @return Validated SOQL predicate fragment.
   */
  public String parse() {
    String expression = parseOrExpression();
    if (!scanner.isAtEnd()) {
      throw new NewtonSelectorException(
        'Unsupported WHERE clause near: ' + scanner.remaining()
      );
    }
    return expression;
  }

  private String parseOrExpression() {
    List<String> parts = new List<String>{ parseAndExpression() };
    while (scanner.matchKeyword('OR')) {
      parts.add(parseAndExpression());
    }
    return String.join(parts, ' OR ');
  }

  private String parseAndExpression() {
    List<String> parts = new List<String>{ parseFactor() };
    while (scanner.matchKeyword('AND')) {
      parts.add(parseFactor());
    }
    return String.join(parts, ' AND ');
  }

  private String parseFactor() {
    if (scanner.peek('(')) {
      scanner.consume('(');
      String expression = parseOrExpression();
      scanner.expect(')');
      return '(' + expression + ')';
    }
    return parseCondition();
  }

  private String parseCondition() {
    Schema.DescribeFieldResult field = access.filterableField(
      scanner.parseIdentifier()
    );
    String operator = NewtonSelectorWhereOperatorParser.parse(scanner);
    if (operator == 'INCLUDES' || operator == 'EXCLUDES') {
      return field.getName() +
        ' ' +
        operator +
        ' (' +
        multiPicklistLiterals(field, operator) +
        ')';
    }
    if (operator == 'IN' || operator == 'NOT IN') {
      return field.getName() + ' ' + operator + ' (' + inBinds(field) + ')';
    }
    return field.getName() +
      ' ' +
      operator +
      ' ' +
      bind(field, scanner.parseLiteral());
  }

  private String inBinds(Schema.DescribeFieldResult field) {
    List<String> bindNames = new List<String>();
    for (String rawValue : scanner.parseListLiterals()) {
      bindNames.add(bind(field, rawValue));
    }
    return String.join(bindNames, ', ');
  }

  private String bind(Schema.DescribeFieldResult field, String rawValue) {
    return NewtonSelectorQueryValueUtil.addBind(
      binds,
      NewtonSelectorQueryValueUtil.coerceValue(field, rawValue)
    );
  }

  private String multiPicklistLiterals(
    Schema.DescribeFieldResult field,
    String operator
  ) {
    if (field.getType() != Schema.DisplayType.MULTIPICKLIST) {
      throw new NewtonSelectorException(
        operator + ' is only supported for multi-select picklist fields.'
      );
    }

    List<String> literals = new List<String>();
    for (String rawValue : scanner.parseListLiterals()) {
      if (String.isNotBlank(rawValue)) {
        literals.add(quoteSoqlStringLiteral(rawValue.trim()));
      }
    }
    if (literals.isEmpty()) {
      throw new NewtonSelectorException(
        'At least one multi-select picklist value is required for ' +
          operator +
          '.'
      );
    }
    return String.join(literals, ', ');
  }

  private static String quoteSoqlStringLiteral(String value) {
    return '\'' + String.escapeSingleQuotes(value.replace('\\', '\\\\')) + '\'';
  }
}
