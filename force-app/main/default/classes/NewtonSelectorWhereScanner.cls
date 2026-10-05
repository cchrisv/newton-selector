/** @description Token scanner for Newton Selector WHERE clause parsing. */
public with sharing class NewtonSelectorWhereScanner {
  private final String input;
  private Integer pos = 0;

  /**
   * @description Creates a scanner for one WHERE clause.
   * @param input WHERE clause without the WHERE keyword.
   */
  public NewtonSelectorWhereScanner(String input) {
    this.input = input == null ? '' : input;
  }

  /**
   * @description Returns true when the scanner consumed the full input.
   * @return True when there are no remaining characters.
   */
  public Boolean isAtEnd() {
    skipWhitespace();
    return pos == input.length();
  }

  /**
   * @description Returns the remaining unparsed input.
   * @return Remaining input.
   */
  public String remaining() {
    return input.substring(pos);
  }

  /**
   * @description Parses a field identifier.
   * @return Field identifier.
   */
  public String parseIdentifier() {
    skipWhitespace();
    Integer start = pos;
    while (
      pos < input.length() && isIdentifierChar(input.substring(pos, pos + 1))
    ) {
      pos++;
    }
    if (start == pos) {
      throw new NewtonSelectorException('Expected field name in WHERE clause.');
    }
    return input.substring(start, pos);
  }

  /**
   * @description Parses a parenthesized list of literals.
   * @return Parsed literal values.
   */
  public List<String> parseListLiterals() {
    skipWhitespace();
    expect('(');
    List<String> values = new List<String>();
    do {
      values.add(parseLiteral());
      skipWhitespace();
    } while (consume(','));
    expect(')');
    return values;
  }

  /**
   * @description Parses a single quoted or bare literal.
   * @return Parsed literal value; null for the bare NULL keyword (a quoted 'null' stays text).
   */
  public String parseLiteral() {
    skipWhitespace();
    if (peek('\'')) {
      return parseQuotedString();
    }

    Integer start = pos;
    while (
      pos < input.length() && !isLiteralBoundary(input.substring(pos, pos + 1))
    ) {
      pos++;
    }
    if (start == pos) {
      throw new NewtonSelectorException('Expected WHERE value.');
    }
    String literal = input.substring(start, pos);
    return literal.equalsIgnoreCase('NULL') ? null : literal;
  }

  /**
   * @description Consumes a keyword when present at the current position.
   * @param keyword Keyword text.
   * @return True when consumed.
   */
  public Boolean matchKeyword(String keyword) {
    skipWhitespace();
    Integer endPos = pos + keyword.length();
    if (!matchesKeywordAt(keyword, endPos)) {
      return false;
    }
    pos = endPos;
    return true;
  }

  /**
   * @description Returns true when the next non-space character matches.
   * @param expected Expected single-character token.
   * @return True when the token is next.
   */
  public Boolean peek(String expected) {
    skipWhitespace();
    return pos < input.length() && input.substring(pos, pos + 1) == expected;
  }

  /**
   * @description Consumes the token when it is next.
   * @param expected Expected single-character token.
   * @return True when consumed.
   */
  public Boolean consume(String expected) {
    skipWhitespace();
    if (!peek(expected)) {
      return false;
    }
    pos++;
    return true;
  }

  /**
   * @description Consumes a required token.
   * @param expected Expected single-character token.
   */
  public void expect(String expected) {
    skipWhitespace();
    if (!peek(expected)) {
      throw new NewtonSelectorException(
        'Expected "' + expected + '" in WHERE clause.'
      );
    }
    pos++;
  }

  private String parseQuotedString() {
    expect('\'');
    String value = '';
    while (pos < input.length()) {
      String ch = input.substring(pos, pos + 1);
      pos++;
      if (ch == '\\' && pos < input.length()) {
        value += input.substring(pos, pos + 1);
        pos++;
      } else if (ch == '\'') {
        return value;
      } else {
        value += ch;
      }
    }
    throw new NewtonSelectorException('Unterminated string in WHERE clause.');
  }

  private Boolean matchesKeywordAt(String keyword, Integer endPos) {
    if (
      endPos > input.length() ||
      !input.substring(pos, endPos).equalsIgnoreCase(keyword)
    ) {
      return false;
    }
    return endPos >= input.length() ||
      !isIdentifierChar(input.substring(endPos, endPos + 1));
  }

  private void skipWhitespace() {
    while (
      pos < input.length() &&
      Pattern.matches('\\s', input.substring(pos, pos + 1))
    ) {
      pos++;
    }
  }

  private Boolean isIdentifierChar(String ch) {
    return Pattern.matches('[A-Za-z0-9_]', ch);
  }

  private Boolean isLiteralBoundary(String ch) {
    return Pattern.matches('[\\s,)]', ch);
  }
}
