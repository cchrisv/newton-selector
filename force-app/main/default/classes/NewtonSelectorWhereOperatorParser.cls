/** @description Parses SOQL operators from a Newton Selector WHERE scanner. */
public with sharing class NewtonSelectorWhereOperatorParser {
  /**
   * @description Parses a SOQL comparison operator.
   * @param scanner WHERE clause scanner.
   * @param fieldName Canonical name of the field the operator follows, for error messages.
   * @return Normalized operator.
   */
  public static String parse(
    NewtonSelectorWhereScanner scanner,
    String fieldName
  ) {
    String keywordOperator = parseKeywordOperator(scanner, fieldName);
    if (keywordOperator != null) {
      return keywordOperator;
    }
    return parseSymbolOperator(scanner, fieldName);
  }

  private static String parseKeywordOperator(
    NewtonSelectorWhereScanner scanner,
    String fieldName
  ) {
    if (scanner.matchKeyword('NOT')) {
      return parseNotOperator(scanner, fieldName);
    }
    if (scanner.matchKeyword('LIKE')) {
      return 'LIKE';
    }
    if (scanner.matchKeyword('IN')) {
      return 'IN';
    }
    if (scanner.matchKeyword('INCLUDES')) {
      return 'INCLUDES';
    }
    if (scanner.matchKeyword('EXCLUDES')) {
      return 'EXCLUDES';
    }
    return null;
  }

  private static String parseNotOperator(
    NewtonSelectorWhereScanner scanner,
    String fieldName
  ) {
    if (scanner.matchKeyword('IN')) {
      return 'NOT IN';
    }
    throw new NewtonSelectorException(
      'Unsupported WHERE operator after ' +
        fieldName +
        ': NOT ' +
        scanner.near()
    );
  }

  private static String parseSymbolOperator(
    NewtonSelectorWhereScanner scanner,
    String fieldName
  ) {
    if (scanner.consume('!')) {
      scanner.expect('=');
      return '!=';
    }
    if (scanner.consume('<')) {
      return scanner.consume('=') ? '<=' : '<';
    }
    if (scanner.consume('>')) {
      return scanner.consume('=') ? '>=' : '>';
    }
    if (scanner.consume('=')) {
      return '=';
    }
    throw new NewtonSelectorException(
      'Expected WHERE operator after ' + fieldName + ' near: ' + scanner.near()
    );
  }
}
