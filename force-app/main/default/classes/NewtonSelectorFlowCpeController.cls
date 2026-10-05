/** @description Apex entry point for the Newton Selector Flow CPE data pickers: object search and field describe. */
public with sharing class NewtonSelectorFlowCpeController {
  private static final Integer MAX_OBJECT_LOOKUP_ROWS = 80;
  private static final String OBJECT_ICON = 'box';
  /** @description Field types a selector cannot render as text: compound address/location and binary. */
  private static final Set<Schema.DisplayType> UNMAPPABLE_FIELD_TYPES = new Set<Schema.DisplayType>{
    Schema.DisplayType.BASE64,
    Schema.DisplayType.ADDRESS,
    Schema.DisplayType.LOCATION
  };

  /** @description Object search row. */
  public class ChoiceOption implements Comparable {
    @AuraEnabled
    public String value;
    @AuraEnabled
    public String label;
    @AuraEnabled
    public String subtitle;
    @AuraEnabled
    public String icon;
    @AuraEnabled
    public String sObjectType;

    /**
     * @description Sorts choice rows by label.
     * @param other ChoiceOption to compare.
     * @return Integer comparison result.
     */
    public Integer compareTo(Object other) {
      return label.compareTo(((ChoiceOption) other).label);
    }
  }

  /** @description Serializable field row for the CPE field pickers. */
  public class Field {
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String label;
    @AuraEnabled
    public String type;
    /** @description True when the field can be used in a WHERE filter (isFilterable). */
    @AuraEnabled
    public Boolean filterable;
    /** @description True when the field can be used in ORDER BY (isSortable). */
    @AuraEnabled
    public Boolean sortable;

    /**
     * @description Creates a field describe row.
     * @param name Field API name.
     * @param label Field label.
     * @param type Field display type.
     */
    public Field(String name, String label, String type) {
      this.name = name;
      this.label = label;
      this.type = type;
    }
  }

  /**
   * @description Finds accessible, queryable sObject types for Flow Builder search.
   * @param searchKey Optional API name or label search text.
   * @return Matching sObject choices capped for the CPE lookup.
   */
  @AuraEnabled(cacheable=true)
  public static List<ChoiceOption> searchSObjectTypes(String searchKey) {
    List<ChoiceOption> rows = new List<ChoiceOption>();
    String normalizedSearchKey = searchKey == null
      ? ''
      : searchKey.trim().toLowerCase();
    for (Schema.SObjectType sObjectType : Schema.getGlobalDescribe().values()) {
      Schema.DescribeSObjectResult describe = sObjectType.getDescribe(
        SObjectDescribeOptions.DEFERRED
      );
      if (
        describe.isAccessible() &&
        describe.isQueryable() &&
        matchesSearch(describe, normalizedSearchKey)
      ) {
        rows.add(objectChoice(describe));
      }
    }

    rows.sort();
    List<ChoiceOption> limited = new List<ChoiceOption>();
    for (
      Integer i = 0; i < Math.min(rows.size(), MAX_OBJECT_LOOKUP_ROWS); i++
    ) {
      limited.add(rows[i]);
    }
    return limited;
  }

  /**
   * @description Describes the fields of an object the running user can read.
   * A blank, unknown or inaccessible object fails with a message naming it.
   * @param objectName Source object API name (case-insensitive).
   * @return Accessible field rows, excluding BASE64, ADDRESS and LOCATION types,
   * each flagged filterable (usable in WHERE) and sortable (usable in ORDER BY).
   */
  @AuraEnabled(cacheable=true)
  public static List<Field> getObjectFields(String objectName) {
    Schema.DescribeSObjectResult describe;
    try {
      describe = NewtonSelectorQueryFieldAccess.describeAccessibleObject(
        objectName
      );
    } catch (NewtonSelectorException e) {
      throw NewtonSelectorException.toAuraException(e.getMessage());
    }

    List<Field> fields = new List<Field>();
    for (Schema.SObjectField fieldToken : describe.fields.getMap().values()) {
      Schema.DescribeFieldResult fieldDescribe = fieldToken.getDescribe();
      if (
        fieldDescribe.isAccessible() &&
        !UNMAPPABLE_FIELD_TYPES.contains(fieldDescribe.getType())
      ) {
        Field row = new Field(
          fieldDescribe.getName(),
          fieldDescribe.getLabel(),
          fieldDescribe.getType().name()
        );
        row.filterable = fieldDescribe.isFilterable();
        row.sortable = fieldDescribe.isSortable();
        fields.add(row);
      }
    }
    return fields;
  }

  private static ChoiceOption objectChoice(
    Schema.DescribeSObjectResult describe
  ) {
    ChoiceOption row = new ChoiceOption();
    row.value = describe.getName();
    row.label = describe.getLabel();
    row.subtitle = row.value;
    row.icon = OBJECT_ICON;
    row.sObjectType = row.value;
    return row;
  }

  private static Boolean matchesSearch(
    Schema.DescribeSObjectResult describe,
    String normalizedSearchKey
  ) {
    return describe.getName().toLowerCase().contains(normalizedSearchKey) ||
      describe.getLabel().toLowerCase().contains(normalizedSearchKey);
  }
}
