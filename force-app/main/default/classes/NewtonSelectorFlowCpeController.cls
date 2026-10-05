/**
 * @description Apex entry point for Newton Selector Flow CPE LWCs. The controller
 * delegates describe/search work to a service so Aura-facing contracts stay small.
 */
public with sharing class NewtonSelectorFlowCpeController {
  /** @description Shared row for selectors and lookup results. */
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
    /** @description Field rows only: Schema.DisplayType name, e.g. STRING, CURRENCY, REFERENCE. */
    @AuraEnabled
    public String type;

    /**
     * @description Sorts choice rows by label.
     * @param other ChoiceOption to compare.
     * @return Integer comparison result.
     */
    public Integer compareTo(Object other) {
      return label.compareTo(((ChoiceOption) other).label);
    }
  }

  /** @description Serializable field row for LWC resource selector / field selector. */
  public class Field {
    @AuraEnabled
    public String name;
    @AuraEnabled
    public String label;
    @AuraEnabled
    public String type;
    @AuraEnabled
    public String relationshipName;

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
    return NewtonSelectorFlowCpeDescribeService.searchSObjectTypes(searchKey);
  }

  /**
   * @description Finds accessible fields for the selected lookup dataset object.
   * @param objectApiName Source object API name.
   * @param searchKey Optional field API name or label search text.
   * @return Matching field choices capped for the CPE lookup.
   */
  @AuraEnabled(cacheable=true)
  public static List<ChoiceOption> searchLookupDatasetFieldsForObject(
    String objectApiName,
    String searchKey
  ) {
    return NewtonSelectorFlowCpeDescribeService.searchLookupDatasetFieldsForObject(
      objectApiName,
      searchKey
    );
  }

  /**
   * @description Describes accessible fields for a selected object.
   * @param objectName Source object API name.
   * @return Accessible field rows; single-target lookups include their relationship name.
   */
  @AuraEnabled(cacheable=true)
  public static List<Field> getObjectFields(String objectName) {
    return NewtonSelectorFlowCpeDescribeService.getObjectFields(objectName);
  }
}
