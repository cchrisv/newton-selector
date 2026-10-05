/** @description Reads one single-quoted WHERE value for NewtonSelectorWhereScanner. */
public with sharing class NewtonSelectorWhereQuotedString {
  /** @description Value between the quotes, with escape sequences resolved. */
  public final String value;
  /** @description Position just after the closing quote. */
  public final Integer endPos;

  private NewtonSelectorWhereQuotedString(String value, Integer endPos) {
    this.value = value;
    this.endPos = endPos;
  }

  /**
   * @description Reads the quoted string whose opening quote is at the given position.
   * @param input WHERE clause text.
   * @param start Position of the opening quote.
   * @param likePattern True for a LIKE value, which keeps the SOQL escapes \%, \_ and \\ for the LIKE bind.
   * @return The value and the position after the closing quote.
   */
  public static NewtonSelectorWhereQuotedString read(
    String input,
    Integer start,
    Boolean likePattern
  ) {
    String value = '';
    Integer pos = start + 1;
    while (pos < input.length()) {
      String ch = input.substring(pos, pos + 1);
      pos++;
      if (ch == '\\' && pos < input.length()) {
        value += parseEscape(input.substring(pos, pos + 1), likePattern);
        pos++;
      } else if (ch == '\'') {
        return new NewtonSelectorWhereQuotedString(value, pos);
      } else {
        value += ch;
      }
    }
    throw new NewtonSelectorException(
      'Unterminated string in WHERE clause: ' + input.substring(start)
    );
  }

  private static String parseEscape(String escaped, Boolean likePattern) {
    if (escaped == '\'') {
      return escaped;
    }
    if (likePattern && (escaped == '\\' || escaped == '%' || escaped == '_')) {
      return '\\' + escaped;
    }
    if (escaped == '\\') {
      return escaped;
    }
    throw new NewtonSelectorException(
      'Unsupported escape sequence \\' +
        escaped +
        ' in WHERE value. Use \\\' or \\\\ anywhere, and \\% or \\_ only in LIKE values.'
    );
  }
}
