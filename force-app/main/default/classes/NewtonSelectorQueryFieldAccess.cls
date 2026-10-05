/** @description Validates the source object once per query build and checks field access against its field map. */
public with sharing class NewtonSelectorQueryFieldAccess {
  /** @description Canonical object API name. */
  public final String objectName;
  private final Map<String, Schema.SObjectField> fieldMap;

  /**
   * @description Resolves and validates the configured source object.
   * @param objectApiName Source object API name.
   */
  public NewtonSelectorQueryFieldAccess(String objectApiName) {
    if (String.isBlank(objectApiName)) {
      throw new NewtonSelectorException('Object API name is required.');
    }

    Schema.SObjectType type = Schema.getGlobalDescribe().get(objectApiName);
    if (type == null) {
      throw new NewtonSelectorException('Unknown object: ' + objectApiName);
    }

    Schema.DescribeSObjectResult describe = type.getDescribe(
      SObjectDescribeOptions.DEFERRED
    );
    if (!describe.isQueryable() || !describe.isAccessible()) {
      throw new NewtonSelectorException(
        'Object not accessible: ' + objectApiName
      );
    }
    objectName = describe.getName();
    fieldMap = describe.fields.getMap();
  }

  /**
   * @description Returns the describe of a field the running user can read.
   * @param fieldApiName Field API name.
   * @return Field describe result.
   */
  public Schema.DescribeFieldResult readableField(String fieldApiName) {
    Schema.SObjectField token = fieldMap.get(fieldApiName.toLowerCase());
    if (token == null) {
      throw new NewtonSelectorException(
        'Unknown field on ' + objectName + ': ' + fieldApiName
      );
    }

    Schema.DescribeFieldResult describe = token.getDescribe();
    if (!describe.isAccessible()) {
      throw new NewtonSelectorException(
        'Field not accessible on ' + objectName + ': ' + fieldApiName
      );
    }
    return describe;
  }

  /**
   * @description Returns the describe of a readable field that can be used in WHERE.
   * @param fieldApiName Field API name.
   * @return Field describe result.
   */
  public Schema.DescribeFieldResult filterableField(String fieldApiName) {
    Schema.DescribeFieldResult describe = readableField(fieldApiName);
    if (!describe.isFilterable()) {
      throw new NewtonSelectorException(
        'Field not filterable on ' + objectName + ': ' + fieldApiName
      );
    }
    return describe;
  }

  /**
   * @description Returns the describe of a readable field that can be used in ORDER BY.
   * @param fieldApiName Field API name.
   * @return Field describe result.
   */
  public Schema.DescribeFieldResult sortableField(String fieldApiName) {
    Schema.DescribeFieldResult describe = readableField(fieldApiName);
    if (!describe.isSortable()) {
      throw new NewtonSelectorException(
        'Field not sortable on ' + objectName + ': ' + fieldApiName
      );
    }
    return describe;
  }
}
