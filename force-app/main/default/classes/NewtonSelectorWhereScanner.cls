/** @description Token scanner for Newton Selector WHERE clause parsing. */
public with sharing class NewtonSelectorWhereScanner {
  private static final String IDENTIFIER_CHAR = '[A-Za-z0-9_]';
  private final String input;
  private Integer pos = 0;

  /**
   * @description Creates a scanner for one WHERE clause.
   * @param input WHERE clause without the WHERE keyword.
   */
  public NewtonSelectorWhereScanner(String input) {
    this.input = input;
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
   * @description Describes the next unparsed text for error messages.
   * @return Remaining input after whitespace, or "end of WHERE clause" when none is left.
   */
  public String near() {
    skipWhitespace();
    String rest = remaining();
    return rest.length() == 0 ? 'end of WHERE clause' : rest;
  }

  /**
   * @description Parses a field identifier.
   * @return Field identifier.
   */
  public String parseIdentifier() {
    skipWhitespace();
    Integer start = pos;
    while (nextMatches(IDENTIFIER_CHAR)) {
      pos++;
    }
    if (start == pos) {
      throw new NewtonSelectorException(
        'Expected field name in WHERE clause near: ' + near()
      );
    }
    return input.substring(start, pos);
  }

  /**
   * @description Parses a parenthesized list of literals.
   * @return Parsed literal values.
   */
  public List<String> parseListLiterals() {
    expect('(');
    List<String> values = new List<String>();
    do {
      values.add(parseLiteral(false));
    } while (consume(','));
    expect(')');
    return values;
  }

  /**
   * @description Parses a single quoted or bare literal.
   * @param likePattern True for a LIKE value, which keeps the SOQL escapes \%, \_ and \\ for the LIKE bind.
   * @return Parsed literal value; null for the bare NULL keyword (a quoted 'null' stays text).
   */
  public String parseLiteral(Boolean likePattern) {
    if (peek('\'')) {
      NewtonSelectorWhereQuotedString quoted = NewtonSelectorWhereQuotedString.read(
        input,
        pos,
        likePattern
      );
      pos = quoted.endPos;
      return quoted.value;
    }
    if (nextMatches('[=<>!(]')) {
      throw new NewtonSelectorException(
        'Unexpected "' +
          input.substring(pos, pos + 1) +
          '" in WHERE value near: ' +
          remaining()
      );
    }

    Integer start = pos;
    while (nextMatches('[^\\s,)]')) {
      pos++;
    }
    if (start == pos) {
      throw new NewtonSelectorException('Expected WHERE value near: ' + near());
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
    if (!peek(expected)) {
      throw new NewtonSelectorException(
        'Expected "' + expected + '" in WHERE clause near: ' + near()
      );
    }
    pos++;
  }

  private Boolean matchesKeywordAt(String keyword, Integer endPos) {
    if (
      endPos > input.length() ||
      !input.substring(pos, endPos).equalsIgnoreCase(keyword)
    ) {
      return false;
    }
    return endPos >= input.length() ||
      !Pattern.matches(IDENTIFIER_CHAR, input.substring(endPos, endPos + 1));
  }

  private void skipWhitespace() {
    while (nextMatches('\\s')) {
      pos++;
    }
  }

  private Boolean nextMatches(String charClass) {
    return pos < input.length() &&
      Pattern.matches(charClass, input.substring(pos, pos + 1));
  }
}
