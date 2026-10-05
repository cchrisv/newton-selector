/** @description Describe/search service for Newton Selector Flow CPE data pickers. */
public with sharing class NewtonSelectorFlowCpeDescribeService {
  private static final Integer MAX_OBJECT_LOOKUP_ROWS = 80;
  private static final Integer MAX_FIELD_LOOKUP_ROWS = 2000;
  private static final String OBJECT_ICON = 'box';
  /** @description Lucide icon for text-like and unmapped field types. */
  private static final String DEFAULT_FIELD_ICON = 'type';
  /** @description Lucide icon name per Schema.DisplayType name. */
  private static final Map<String, String> FIELD_TYPE_ICONS = new Map<String, String>{
    'TEXTAREA' => 'file-text',
    'INTEGER' => 'hash',
    'LONG' => 'hash',
    'DOUBLE' => 'hash',
    'CURRENCY' => 'dollar-sign',
    'PERCENT' => 'percent',
    'BOOLEAN' => 'square-check',
    'DATE' => 'calendar',
    'DATETIME' => 'calendar-clock',
    'TIME' => 'clock',
    'PICKLIST' => 'list',
    'COMBOBOX' => 'list',
    'MULTIPICKLIST' => 'list-checks',
    'REFERENCE' => 'search',
    'EMAIL' => 'mail',
    'PHONE' => 'phone',
    'URL' => 'link',
    'ID' => 'key',
    'ENCRYPTEDSTRING' => 'lock',
    'COMPLEXVALUE' => 'braces',
    'DATACATEGORYGROUPREFERENCE' => 'braces',
    'SOBJECT' => 'box'
  };
  private static final Set<Schema.DisplayType> LOOKUP_FIELD_SKIP_TYPES = new Set<Schema.DisplayType>{
    Schema.DisplayType.BASE64,
    Schema.DisplayType.ADDRESS,
    Schema.DisplayType.LOCATION
  };

  /**
   * @description Finds accessible, queryable sObject types for Flow Builder search.
   * @param searchKey Optional API name or label search text.
   * @return Matching sObject choices capped for the CPE lookup.
   */
  public static List<NewtonSelectorFlowCpeController.ChoiceOption> searchSObjectTypes(
    String searchKey
  ) {
    List<NewtonSelectorFlowCpeController.ChoiceOption> rows = new List<NewtonSelectorFlowCpeController.ChoiceOption>();
    String normalizedSearchKey = normalizeSearchKey(searchKey);
    for (Schema.SObjectType sObjectType : Schema.getGlobalDescribe().values()) {
      Schema.DescribeSObjectResult describe = sObjectType.getDescribe(
        SObjectDescribeOptions.DEFERRED
      );
      if (
        describe.isAccessible() &&
        describe.isQueryable() &&
        matchesSearch(
          describe.getName(),
          describe.getLabel(),
          normalizedSearchKey
        )
      ) {
        rows.add(objectChoice(describe));
      }
    }

    rows.sort();
    return firstRows(rows, MAX_OBJECT_LOOKUP_ROWS);
  }

  /**
   * @description Finds accessible fields for the selected lookup dataset object.
   * @param objectApiName Source object API name (case-insensitive).
   * @param searchKey Optional field API name or label search text.
   * @return Matching field choices capped for the CPE lookup.
   */
  public static List<NewtonSelectorFlowCpeController.ChoiceOption> searchLookupDatasetFieldsForObject(
    String objectApiName,
    String searchKey
  ) {
    List<NewtonSelectorFlowCpeController.ChoiceOption> rows = new List<NewtonSelectorFlowCpeController.ChoiceOption>();
    Schema.SObjectType sObjectType = Schema.getGlobalDescribe()
      .get(objectApiName);
    if (sObjectType == null) {
      return rows;
    }

    String normalizedSearchKey = normalizeSearchKey(searchKey);
    Schema.DescribeSObjectResult describe = sObjectType.getDescribe(
      SObjectDescribeOptions.DEFERRED
    );
    for (Schema.SObjectField fieldToken : describe.fields.getMap().values()) {
      Schema.DescribeFieldResult field = fieldToken.getDescribe();
      if (
        isLookupSelectableField(field) &&
        matchesSearch(field.getName(), field.getLabel(), normalizedSearchKey)
      ) {
        rows.add(fieldChoice(field, describe.getName()));
      }
    }

    rows.sort();
    return firstRows(rows, MAX_FIELD_LOOKUP_ROWS);
  }

  /**
   * @description Describes accessible fields for a selected object.
   * @param objectName Source object API name (case-insensitive).
   * @return Accessible field rows; single-target lookups include their relationship name.
   */
  public static List<NewtonSelectorFlowCpeController.Field> getObjectFields(
    String objectName
  ) {
    List<NewtonSelectorFlowCpeController.Field> fields = new List<NewtonSelectorFlowCpeController.Field>();
    Schema.SObjectType sObjectType = Schema.getGlobalDescribe().get(objectName);
    if (sObjectType == null) {
      return fields;
    }

    Schema.DescribeSObjectResult describe = sObjectType.getDescribe(
      SObjectDescribeOptions.DEFERRED
    );
    if (!describe.isAccessible()) {
      return fields;
    }

    for (Schema.SObjectField fieldToken : describe.fields.getMap().values()) {
      Schema.DescribeFieldResult fieldDescribe = fieldToken.getDescribe();
      if (fieldDescribe.isAccessible()) {
        fields.add(objectField(fieldDescribe));
      }
    }
    return fields;
  }

  private static NewtonSelectorFlowCpeController.ChoiceOption objectChoice(
    Schema.DescribeSObjectResult describe
  ) {
    NewtonSelectorFlowCpeController.ChoiceOption row = new NewtonSelectorFlowCpeController.ChoiceOption();
    row.value = describe.getName();
    row.label = describe.getLabel();
    row.subtitle = row.value;
    row.icon = OBJECT_ICON;
    row.sObjectType = row.value;
    return row;
  }

  private static NewtonSelectorFlowCpeController.ChoiceOption fieldChoice(
    Schema.DescribeFieldResult field,
    String objectName
  ) {
    NewtonSelectorFlowCpeController.ChoiceOption row = new NewtonSelectorFlowCpeController.ChoiceOption();
    row.value = field.getName();
    row.label = field.getLabel();
    row.type = field.getType().name();
    row.subtitle = row.value + ' - ' + row.type;
    row.icon = FIELD_TYPE_ICONS.containsKey(row.type)
      ? FIELD_TYPE_ICONS.get(row.type)
      : DEFAULT_FIELD_ICON;
    row.sObjectType = objectName;
    return row;
  }

  private static NewtonSelectorFlowCpeController.Field objectField(
    Schema.DescribeFieldResult fieldDescribe
  ) {
    NewtonSelectorFlowCpeController.Field field = new NewtonSelectorFlowCpeController.Field(
      fieldDescribe.getName(),
      fieldDescribe.getLabel(),
      fieldDescribe.getType().name()
    );
    if (fieldDescribe.getReferenceTo().size() == 1) {
      field.relationshipName = fieldDescribe.getRelationshipName();
    }
    return field;
  }

  private static List<NewtonSelectorFlowCpeController.ChoiceOption> firstRows(
    List<NewtonSelectorFlowCpeController.ChoiceOption> rows,
    Integer maxRows
  ) {
    List<NewtonSelectorFlowCpeController.ChoiceOption> limited = new List<NewtonSelectorFlowCpeController.ChoiceOption>();
    for (Integer i = 0; i < Math.min(rows.size(), maxRows); i++) {
      limited.add(rows[i]);
    }
    return limited;
  }

  private static Boolean isLookupSelectableField(
    Schema.DescribeFieldResult fieldDescribe
  ) {
    return fieldDescribe.isAccessible() &&
      !LOOKUP_FIELD_SKIP_TYPES.contains(fieldDescribe.getType());
  }

  private static Boolean matchesSearch(
    String apiName,
    String label,
    String normalizedSearchKey
  ) {
    return apiName.toLowerCase().contains(normalizedSearchKey) ||
      label.toLowerCase().contains(normalizedSearchKey);
  }

  private static String normalizeSearchKey(String searchKey) {
    return searchKey == null ? '' : searchKey.trim().toLowerCase();
  }
}
