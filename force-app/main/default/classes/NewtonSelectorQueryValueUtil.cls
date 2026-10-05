/** @description Bind and value-coercion helpers for Newton Selector SOQL building. */
public with sharing class NewtonSelectorQueryValueUtil {
  private static final Pattern TIME_PATTERN = Pattern.compile(
    '([01]\\d|2[0-3]):([0-5]\\d):([0-5]\\d)(?:\\.(\\d{3})Z)?'
  );

  /**
   * @description Adds a named bind value to the bind map.
   * @param binds Bind map.
   * @param value Bind value.
   * @return SOQL bind token.
   */
  public static String addBind(Map<String, Object> binds, Object value) {
    String bindName = 'newtonBind' + binds.size();
    binds.put(bindName, value);
    return ':' + bindName;
  }

  /**
   * @description Converts a WHERE literal into the field's Apex value type.
   * DATETIME takes an ISO 8601 / SOQL datetime literal (2026-01-31T14:30:00Z or with a
   * +hh:mm offset) read as an absolute instant; TIME takes HH:mm:ss or HH:mm:ss.SSSZ.
   * @param field Field describe for type selection.
   * @param rawValue Literal text, or null for the bare NULL keyword.
   * @return Coerced Apex value.
   */
  public static Object coerceValue(
    Schema.DescribeFieldResult field,
    String rawValue
  ) {
    if (rawValue == null) {
      return null;
    }
    try {
      return coerceNonNull(field, rawValue);
    } catch (TypeException e) {
      throw invalidValue(field, rawValue);
    } catch (JSONException e) {
      throw invalidValue(field, rawValue);
    }
  }

  private static Object coerceNonNull(
    Schema.DescribeFieldResult field,
    String rawValue
  ) {
    switch on field.getType() {
      when BOOLEAN {
        return parseBoolean(field, rawValue);
      }
      when INTEGER {
        return Integer.valueOf(rawValue);
      }
      when LONG {
        return Long.valueOf(rawValue);
      }
      when DOUBLE, CURRENCY, PERCENT {
        return Decimal.valueOf(rawValue);
      }
      when DATE {
        return Date.valueOf(rawValue);
      }
      when DATETIME {
        return (Datetime) JSON.deserialize(
          JSON.serialize(rawValue),
          Datetime.class
        );
      }
      when TIME {
        return parseTime(field, rawValue);
      }
      when else {
        return rawValue;
      }
    }
  }

  private static Time parseTime(
    Schema.DescribeFieldResult field,
    String rawValue
  ) {
    Matcher parts = TIME_PATTERN.matcher(rawValue);
    if (!parts.matches()) {
      throw invalidValue(field, rawValue);
    }
    return Time.newInstance(
      Integer.valueOf(parts.group(1)),
      Integer.valueOf(parts.group(2)),
      Integer.valueOf(parts.group(3)),
      parts.group(4) == null ? 0 : Integer.valueOf(parts.group(4))
    );
  }

  private static Boolean parseBoolean(
    Schema.DescribeFieldResult field,
    String rawValue
  ) {
    if (rawValue.equalsIgnoreCase('TRUE')) {
      return true;
    }
    if (rawValue.equalsIgnoreCase('FALSE')) {
      return false;
    }
    throw invalidValue(field, rawValue);
  }

  private static NewtonSelectorException invalidValue(
    Schema.DescribeFieldResult field,
    String rawValue
  ) {
    return new NewtonSelectorException(
      'Invalid value for ' +
        field.getName() +
        ' (' +
        field.getType().name() +
        '): ' +
        rawValue
    );
  }
}
